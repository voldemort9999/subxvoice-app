// Where the STT and LLM plugs get their credentials.
//
// AGENTS.md rule 3 is "no API keys in the app", and this is now how it is met: both vendors sit
// behind Edge Functions that the user's Supabase session unlocks, and the app holds no vendor key
// at all. The engines are built once; the token behind them is a function, because a session
// expires while the app is open.

import { join } from "node:path";
import type { DeciderProvider, LlmProvider, SttProvider } from "@subx/core";
import {
  createDecider,
  createLlm,
  createStt,
  isGnaniFormat,
  isGnaniLanguage,
  RaceLlm,
} from "@subx/providers";
import { app } from "electron";
import type { Account } from "./auth";
import { DECISIONS_URL, LLM_URL, STT_URL } from "./auth";

export interface Engines {
  stt?: SttProvider;
  llm?: LlmProvider;
  /** Decides dictation vs. "write me an email". Absent means only trigger phrases route. */
  decider?: DeciderProvider;
  /** Fills in a command's details — the volume level, the URL. Absent means no command mode. */
  writer?: LlmProvider;
  /** Why an engine is missing, shown in Settings. */
  problems: string[];
}

/**
 * Reads the repo-root .env in development. Nothing here needs a vendor key any more; the file is
 * still read so GNANI_LANGUAGE and GNANI_FORMAT can be tried out without a rebuild.
 */
export function loadDevEnv(): void {
  if (app.isPackaged) return;
  for (const path of [join(app.getAppPath(), "../../.env"), join(process.cwd(), ".env")]) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // Missing or unreadable: try the next location, then fall back to the real environment.
    }
  }
}

/**
 * A setting from .env, or undefined when it is blank. `.env.example` ships every optional key with
 * an empty value, so "present but empty" means "not set" — and passing "" through as a model name
 * is worse than passing nothing: OpenRouter answers `400 No models provided`.
 */
const fromEnv = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/** How long the primary rewrite model answers alone before gpt-oss-120b joins the race. */
const PRIMARY_HEAD_START_MS = 1500;

export function createEngines(account: Account): Engines {
  const problems: string[] = [];
  let stt: SttProvider | undefined;
  let llm: LlmProvider | undefined;
  let decider: DeciderProvider | undefined;
  let writer: LlmProvider | undefined;

  // Read per dictation. An empty string means nobody is signed in, and the backend will say so.
  const token = () => account.token();

  // These are developer settings from .env, so a typo is reported rather than silently sent to
  // the service — which would reject the whole session over one bad header.
  const languageEnv = fromEnv("GNANI_LANGUAGE");
  if (languageEnv && !isGnaniLanguage(languageEnv)) {
    problems.push(`Ignoring GNANI_LANGUAGE="${languageEnv}": expected a locale such as hi-IN or en-IN.`);
  }
  const formatEnv = fromEnv("GNANI_FORMAT");
  if (formatEnv && !isGnaniFormat(formatEnv)) {
    problems.push(
      `Ignoring GNANI_FORMAT="${formatEnv}": expected verbatim, transcribe, codemix or transliterate.`,
    );
  }

  try {
    stt = createStt({
      id: "gnani",
      token,
      viaBackend: true,
      baseUrl: STT_URL,
      model: fromEnv("GNANI_MODEL"),
      language: languageEnv && isGnaniLanguage(languageEnv) ? languageEnv : undefined,
      format: formatEnv && isGnaniFormat(formatEnv) ? formatEnv : undefined,
    });
  } catch (error) {
    problems.push(describe("Speech-to-text", error));
  }

  try {
    // Gemini 3.5 Flash Lite answers first, pinned to Google's priority tier only. OpenRouter
    // honours the endpoint tags strictly: an unknown tag is a 404, not a quiet reroute. Measured
    // 2026-11-16 on Hinglish transliteration and an email: ~0.7–1.1 s, with one cold 1.8 s.
    // Reasoning cannot be turned off on this endpoint, and setting its effort made no difference.
    const primary = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      model: fromEnv("OPENROUTER_MODEL") ?? "google/gemini-3.5-flash-lite",
      only: ["google-ai-studio/priority", "google-vertex/global/priority"],
      reasoning: false,
      // Not the race's head start: past that point it keeps running alongside the backup.
      timeoutMs: 10000,
    });
    // gpt-oss-120b as the fallback, set up as before. Groq comes first: on a 693-character
    // Hindi-English dictation it was both correct and the fastest (~750 ms, against Cerebras'
    // ~2 s). Cerebras is excluded, not merely put last: it silently returns long input
    // unconverted, and a fallback that corrupts the result is worse than one that is slow.
    const backup = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      model: "openai/gpt-oss-120b",
      order: ["groq"],
      ignore: ["cerebras"],
    });
    // Race mode, for dictation only: Follow My Words uses `writer`, never this. After the head
    // start gpt-oss-120b is asked too, and whichever answers first is typed. Both failing is
    // the only case that reaches the user as an error.
    llm = new RaceLlm(primary, backup, PRIMARY_HEAD_START_MS, (reason) =>
      console.warn(`[llm] racing gpt-oss-120b: ${reason}`),
    );
  } catch (error) {
    problems.push(describe("Rewriting", error));
  }

  try {
    decider = createDecider({ id: "jev", token, baseUrl: DECISIONS_URL, model: fromEnv("JEV_MODEL") });
  } catch (error) {
    // Not fatal, and deliberately not in `problems`: without it every dictation is simply typed
    // out, which is the behaviour the app had before composing existed.
    console.error("Intent classifier unavailable:", error);
  }

  try {
    writer = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      // Not gpt-oss-120b, which dictation uses. Measured on 17 Hinglish commands, 3 runs each,
      // 2026-11-11: gpt-oss-120b understood them but took over 2 s on 19 of 51 calls, up to 15 s,
      // on a step the user is waiting on. gemini-2.5-flash-lite got 51/51 at a steady ~1 s, and
      // was right on Devanagari input too. No reasoning: it was not needed, and only slows it.
      // Then gemini-2.5-flash, once screen control made the plans longer: on the same 22-command
      // end-to-end suite flash-lite broke a different command with every prompt change (repeated
      // steps, "hi likho" typed literally), flash held 20–22/22 for ~0.3 s more a command.
      model: fromEnv("COMMAND_MODEL") ?? "google/gemini-2.5-flash",
      reasoning: false,
      timeoutMs: 8000,
    });
  } catch (error) {
    console.error("Command writer unavailable:", error);
  }

  return { stt, llm, decider, writer, problems };
}

const describe = (what: string, error: unknown) =>
  `${what} is off: ${error instanceof Error ? error.message : String(error)}`;
