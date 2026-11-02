import type { LlmProvider, LlmRequest, LlmResponse } from "@subx/core";
import { SubxError } from "@subx/core";
import { resolveToken, type TokenSource } from "../stt/gnani";

const DEFAULT_URL = "https://openrouter.ai/api/v1/chat/completions";
/**
 * Benchmarked against gpt-oss-20b, llama-4-scout, llama-3.3-70b and qwen3-32b on Hindi-English
 * samples: this was both the fastest and the only one that never left Devanagari untouched. Groq
 * rejects gpt-oss with reasoning disabled, so "low" is the floor.
 *
 * Which upstream serves it matters as much as the model — see `ignore` below.
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_MAX_TOKENS = 1200;
const TIMEOUT_MS = 20000;

export interface OpenRouterOptions {
  /** The user's session, read fresh for every request — it expires while the app is open. */
  token: TokenSource;
  model?: string;
  baseUrl?: string;
  /** Restrict routing to only these upstream providers. */
  only?: string[];
  /** Preferred upstream providers, tried in order, with fallback to the rest. */
  order?: string[];
  /**
   * Upstream providers that must never serve this request, whatever `order` falls back to.
   *
   * The same model behaves differently depending on who runs it: Cerebras-served gpt-oss-120b
   * stops following the system prompt once the input gets long, and hands back the Devanagari it
   * was asked to convert. Measured on a 693-character dictation, 7 attempts, 7 failures — while
   * the same request succeeded on Groq, CoreWeave, BaseTen and Near AI every time.
   */
  ignore?: string[];
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

export class OpenRouterLlm implements LlmProvider {
  readonly id = "openrouter";

  private readonly options: OpenRouterOptions;

  constructor(options: OpenRouterOptions) {
    if (!options.token) throw new SubxError("provider", "OpenRouter needs a token");
    this.options = options;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const { only, order, ignore } = this.options;
    const provider = {
      ...(order?.length ? { order } : {}),
      ...(only?.length ? { only } : {}),
      ...(ignore?.length ? { ignore } : {}),
    };
    const response = await fetch(this.options.baseUrl ?? DEFAULT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await resolveToken(this.options.token)}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        // `||`, not `??`: an empty model name is not a choice, and OpenRouter rejects it.
        model: this.options.model?.trim() || DEFAULT_MODEL,
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
        temperature: 0,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        reasoning: { effort: "low" },
        // An empty object is still a routing preference to OpenRouter, so send nothing.
        ...(Object.keys(provider).length ? { provider } : {}),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as ChatResponse;
    if (!response.ok) {
      // OpenRouter puts the real reason in the body, not the status line.
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      const hint =
        response.status === 401 || response.status === 402 || response.status === 403
          ? " — check OPENROUTER_API_KEY"
          : "";
      throw new SubxError("provider", `OpenRouter: ${detail}${hint}`);
    }

    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new SubxError("provider", "OpenRouter returned an empty response");
    // Tool calling is wired when the command router needs it; dictation never asks for tools.
    return { text, toolCalls: [] };
  }
}
