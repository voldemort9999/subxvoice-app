import type { DeciderProvider, Decision, DecisionRequest } from "@subx/core";
import { SubxError } from "@subx/core";
import { resolveToken, type TokenSource } from "../stt/gnani";

/**
 * TypeSafe's Jev, through OpenRouter's Decisions API.
 *
 * Not a chat model and not reachable as one — asking for it on /chat/completions answers
 * "typesafe/jev-1.14 is a decisions model". It takes a `state` to look at and a map of named
 * criteria, and returns the chosen name with a probability for every option, which is what lets
 * the pipeline hold a real confidence threshold rather than parse a sentence.
 */
const DEFAULT_URL = "https://openrouter.ai/api/alpha/decisions";
const DEFAULT_MODEL = "typesafe/jev-1.14";
/** This runs between the user letting go of the key and the text appearing, so it cannot hang. */
const TIMEOUT_MS = 6000;
/** The question's name in the request; answers come back keyed by the same name. */
const QUESTION = "intent";

export interface JevOptions {
  /** The user's session, read fresh for every request — it expires while the app is open. */
  token: TokenSource;
  model?: string;
  baseUrl?: string;
}

interface DecisionsResponse {
  answers?: Record<string, { choice?: string; confidence?: number; probabilities?: Record<string, number> }>;
  error?: { message?: string };
}

export class JevDecider implements DeciderProvider {
  readonly id = "jev";

  private readonly options: JevOptions;

  constructor(options: JevOptions) {
    if (!options.token) throw new SubxError("provider", "Jev needs a token");
    this.options = options;
  }

  async decide(request: DecisionRequest): Promise<Decision> {
    const response = await fetch(this.options.baseUrl ?? DEFAULT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await resolveToken(this.options.token)}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        // `||`, not `??`: an empty model name is not a choice.
        model: this.options.model?.trim() || DEFAULT_MODEL,
        state: request.state,
        questions: {
          [QUESTION]: {
            type: "choice",
            criteria: request.criteria,
            ...(request.instructions ? { instructions: request.instructions } : {}),
          },
        },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as DecisionsResponse;
    if (!response.ok) {
      throw new SubxError("provider", `Jev: ${body.error?.message ?? `HTTP ${response.status}`}`);
    }

    const answer = body.answers?.[QUESTION];
    if (!answer?.choice) throw new SubxError("provider", "Jev returned no choice");
    if (!(answer.choice in request.criteria)) {
      // A name that was never offered cannot be acted on, and guessing which option was meant is
      // how the wrong text gets pasted.
      throw new SubxError("provider", `Jev chose "${answer.choice}", which was not an option`);
    }
    return {
      choice: answer.choice,
      confidence: answer.confidence ?? 0,
      ...(answer.probabilities ? { probabilities: answer.probabilities } : {}),
    };
  }
}
