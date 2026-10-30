import { type LlmProvider, type SttProvider, SubxError } from "@subx/core";
import { FakeLlm, FakeStt } from "@subx/core/fakes";
import { OpenRouterLlm } from "./llm/openrouter";
import { type GnaniFormat, type GnaniLanguage, GnaniStt } from "./stt/gnani";

export interface ProviderConfig {
  /** e.g. "gnani", "openrouter", "fake". */
  id: string;
  model?: string;
  /** Short-lived token from our backend — never a raw vendor API key. */
  token?: string;
  baseUrl?: string;
  /** Recognition locale for STT, e.g. "hi-IN". One only; Gnani takes no language list. */
  language?: GnaniLanguage;
  /** STT output style: "verbatim" | "transcribe" | "codemix" | "transliterate". */
  format?: GnaniFormat;
  /** Pin the upstream provider where the vendor routes to several (OpenRouter). */
  only?: string[];
  /** Preferred upstream providers in order, with fallback (OpenRouter). */
  order?: string[];
}

// To add a vendor: create stt/<vendor>.ts (or llm/<vendor>.ts) implementing the
// interface from @subx/core, then add one `case` below.

export function createStt(config: ProviderConfig): SttProvider {
  switch (config.id) {
    case "gnani":
      return new GnaniStt({
        token: requireToken(config, "Gnani"),
        model: config.model,
        baseUrl: config.baseUrl,
        language: config.language,
        format: config.format,
      });
    case "fake":
      return new FakeStt("hello from the fake speech-to-text provider");
    default:
      throw new SubxError("unsupported", `Unknown STT provider: ${config.id}`);
  }
}

export function createLlm(config: ProviderConfig): LlmProvider {
  switch (config.id) {
    case "openrouter":
      return new OpenRouterLlm({
        token: requireToken(config, "OpenRouter"),
        model: config.model,
        baseUrl: config.baseUrl,
        only: config.only,
        order: config.order,
      });
    case "fake":
      return new FakeLlm("Hello from the fake LLM provider.");
    default:
      throw new SubxError("unsupported", `Unknown LLM provider: ${config.id}`);
  }
}

function requireToken(config: ProviderConfig, name: string): string {
  if (!config.token) throw new SubxError("provider", `${name} needs a token`);
  return config.token;
}

export { OpenRouterLlm, type OpenRouterOptions } from "./llm/openrouter";
export {
  GNANI_FORMATS,
  GNANI_LANGUAGES,
  GNANI_STT_URL,
  type GnaniFormat,
  type GnaniLanguage,
  type GnaniOptions,
  GnaniStt,
  headerSafeTerms,
  isGnaniFormat,
  isGnaniLanguage,
  toLocale,
} from "./stt/gnani";
