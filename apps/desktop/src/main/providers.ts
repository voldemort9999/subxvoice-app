// Where the STT and LLM plugs get their credentials.
//
// AGENTS.md rule 3 is "no API keys in the app", and this is now how it is met: both vendors sit
// behind Edge Functions that the user's Supabase session unlocks, and the app holds no vendor key
// at all. The engines are built once; the token behind them is a function, because a session
// expires while the app is open.

import { join } from "node:path";
import type { LlmProvider, SttProvider } from "@subx/core";
import { createLlm, createStt, isGnaniFormat, isGnaniLanguage } from "@subx/providers";
import { app } from "electron";
import type { Account } from "./auth";
import { LLM_URL, STT_URL } from "./auth";

export interface Engines {
  stt?: SttProvider;
  llm?: LlmProvider;
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

export function createEngines(account: Account): Engines {
  const problems: string[] = [];
  let stt: SttProvider | undefined;
  let llm: LlmProvider | undefined;

  // Read per dictation. An empty string means nobody is signed in, and the backend will say so.
  const token = () => account.token();

  // These are developer settings from .env, so a typo is reported rather than silently sent to
  // the service — which would reject the whole session over one bad header.
  const languageEnv = process.env.GNANI_LANGUAGE?.trim();
  if (languageEnv && !isGnaniLanguage(languageEnv)) {
    problems.push(`Ignoring GNANI_LANGUAGE="${languageEnv}": expected a locale such as hi-IN or en-IN.`);
  }
  const formatEnv = process.env.GNANI_FORMAT?.trim();
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
      model: process.env.GNANI_MODEL,
      language: languageEnv && isGnaniLanguage(languageEnv) ? languageEnv : undefined,
      format: formatEnv && isGnaniFormat(formatEnv) ? formatEnv : undefined,
    });
  } catch (error) {
    problems.push(describe("Speech-to-text", error));
  }

  try {
    llm = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      model: process.env.OPENROUTER_MODEL,
      // Cerebras is fastest + most consistent on Hindi-English; groq as fallback.
      order: ["cerebras", "groq"],
    });
  } catch (error) {
    problems.push(describe("Rewriting", error));
  }

  return { stt, llm, problems };
}

const describe = (what: string, error: unknown) =>
  `${what} is off: ${error instanceof Error ? error.message : String(error)}`;
