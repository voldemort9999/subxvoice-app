import {
  type AudioClip,
  type SttOptions,
  type SttProvider,
  type SttStream,
  SubxError,
  type Transcript,
} from "@subx/core";

/** Gnani's realtime speech-to-text socket. One global endpoint — there are no regional variants. */
export const GNANI_STT_URL = "wss://api.vachana.ai/stt/v3/stream";

/**
 * Prisma v3.0 over v2.5 because of what each does with Indian-accented English: v3.0 writes it in
 * Latin script ("I am currently in my viva") while v2.5 writes the same words in Devanagari
 * ("आई एम करन्ट्ली इन माइ विवा"), which is the input that used to come out as "Pleez note dait".
 * v2.5 finalises faster (~90 ms vs ~450 ms measured) — worth revisiting if latency ever matters
 * more than the script.
 */
const DEFAULT_MODEL = "prisma-v3.0";

/**
 * One locale, not auto-detection. `indic-auto` is accepted by the service but guesses from the
 * audio: on a Hindi-English clip it decided Telugu and returned Telugu script. "hi-IN" transcribes
 * Hindi and English together, which is the code-mixed case we actually have.
 */
const DEFAULT_LANGUAGE = "hi-IN";

const OPEN_TIMEOUT_MS = 8000;
const COMMIT_TIMEOUT_MS = 5000;

/**
 * How long the batch path gives the service to start working through a clip that was handed over
 * all at once. Streaming never needs this: audio arrives over seconds, so `speech_start` is always
 * in before the hotkey comes up. A clip pushed in one go commits before the service has reached
 * the audio, leaving nothing to wait on and finish() returning empty.
 */
const BATCH_SETTLE_MS = 1500;

/** 512 signed 16-bit samples. The service reports this as `chunk_size` and documents it as fixed. */
const FRAME_BYTES = 1024;

/** The service accepts only these; another rate would be transcribed at the wrong pitch. */
const SUPPORTED_SAMPLE_RATES = [8000, 16000, 44100, 48000];

/** The ten Indian languages plus Indian English, each needing its region suffix. */
export const GNANI_LANGUAGES = [
  "bn-IN",
  "en-IN",
  "gu-IN",
  "hi-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
] as const;

export type GnaniLanguage = (typeof GNANI_LANGUAGES)[number];

export function isGnaniLanguage(value: string): value is GnaniLanguage {
  return (GNANI_LANGUAGES as readonly string[]).includes(value);
}

/**
 * `verbatim` keeps what was said; `transcribe` also normalises numbers and currency; `codemix` and
 * `transliterate` are Prisma v3.0 only. `transliterate` returns Roman script directly and could in
 * principle stand in for the LLM pass, but it paraphrases — "मैं अभी वाइवा दे रहा हूँ" came back as
 * "main abhi vaivada de raavu". The LLM stays the thing that produces Hinglish.
 */
export const GNANI_FORMATS = ["verbatim", "transcribe", "codemix", "transliterate"] as const;

export type GnaniFormat = (typeof GNANI_FORMATS)[number];

export function isGnaniFormat(value: string): value is GnaniFormat {
  return (GNANI_FORMATS as readonly string[]).includes(value);
}

/**
 * How a request proves who it is. A Supabase session expires while the app is open, so this is
 * asked for each time rather than captured once when the provider is built.
 */
export type TokenSource = string | (() => string | Promise<string>);

export const resolveToken = async (token: TokenSource): Promise<string> =>
  typeof token === "function" ? await token() : token;

export interface GnaniOptions {
  /** The user's session, read fresh for every dictation. */
  token: TokenSource;
  /**
   * Set when the socket goes through our own backend, which authenticates the user instead of
   * carrying Gnani's key. The key never reaches the app, so the app never sends one.
   */
  viaBackend?: boolean;
  model?: string;
  /** Full endpoint override, for tests or a future private deployment. */
  baseUrl?: string;
  /** Recognition locale. One only — see DEFAULT_LANGUAGE. */
  language?: GnaniLanguage;
  format?: GnaniFormat;
}

/**
 * What the service sends. A `transcript` is always final: there are no interim results, so nothing
 * already delivered is ever revised.
 */
interface GnaniMessage {
  type?: string;
  text?: string;
  message?: string;
  utterance_id?: string;
  detected_language_code?: string;
}

/**
 * Gnani realtime speech-to-text. Streams while the user talks, so when the hotkey comes up only
 * the utterance still in progress is outstanding.
 */
export class GnaniStt implements SttProvider {
  readonly id = "gnani";
  readonly capabilities = { streaming: true, codeSwitching: true, vocabularyHints: true };

  private readonly options: GnaniOptions;

  constructor(options: GnaniOptions) {
    if (!options.token) throw new SubxError("provider", "Gnani needs a token");
    this.options = options;
  }

  /**
   * Batch path, built on the streaming one so there is only one protocol implementation to trust.
   * It differs in one way: the clip arrives complete, so finish() has to allow for the service not
   * having reached the audio yet (see BATCH_SETTLE_MS).
   */
  async transcribe(audio: AudioClip, options: SttOptions): Promise<Transcript> {
    const stream = await this.connect(options, audio.sampleRate, true);
    stream.push(audio.samples);
    return stream.finish();
  }

  async startStream(options: SttOptions, sampleRate = 16000): Promise<SttStream> {
    return this.connect(options, sampleRate, false);
  }

  private async connect(options: SttOptions, sampleRate: number, batch: boolean): Promise<GnaniStream> {
    if (!SUPPORTED_SAMPLE_RATES.includes(sampleRate)) {
      throw new SubxError(
        "provider",
        `Gnani cannot transcribe ${sampleRate} Hz audio — it accepts ${SUPPORTED_SAMPLE_RATES.join(", ")}.`,
      );
    }
    const token = await resolveToken(this.options.token);
    const stream = new GnaniStream(this.options, token, options, sampleRate, batch);
    await stream.ready();
    return stream;
  }
}

class GnaniStream implements SttStream {
  private readonly socket: WebSocket;
  /** Audio recorded before the socket finished opening — flushed, never dropped. */
  private backlog: Int16Array[] = [];
  /** Bytes left over from the last push: the service wants exactly FRAME_BYTES per frame. */
  private carry = new Uint8Array(0);
  private opened = false;
  private committed = false;
  private readonly parts: string[] = [];
  private readonly languages = new Set<string>();
  /**
   * Utterances the service has started but not yet returned text for. A `commit` with nothing to
   * flush is answered with silence — no ack, no empty transcript — so this is the only way to know
   * whether finish() should wait for one more message or return straight away.
   */
  private readonly openUtterances = new Set<string>();
  private failure: Error | null = null;
  private settleOpen: (() => void) | null = null;
  private failOpen: ((error: Error) => void) | null = null;
  private settleDrained: ((arrived: boolean) => void) | null = null;
  private readonly openPromise: Promise<void>;

  constructor(
    connection: GnaniOptions,
    token: string,
    options: SttOptions,
    sampleRate: number,
    private readonly batch: boolean,
  ) {
    this.openPromise = new Promise((resolve, reject) => {
      this.settleOpen = resolve;
      this.failOpen = reject;
    });

    // Gnani configures the session entirely through the upgrade request — there is no config
    // message to send once connected. Node's and Electron's WebSocket (undici) accepts headers;
    // the DOM type in our lib list does not describe that overload.
    const WithHeaders = WebSocket as unknown as new (
      url: string,
      init: { headers: Record<string, string> },
    ) => WebSocket;

    const keyterms = headerSafeTerms(options.vocabulary);
    this.socket = new WithHeaders(connection.baseUrl ?? GNANI_STT_URL, {
      headers: {
        // Through our backend the session identifies the user and the key stays server-side;
        // talking to Gnani directly, the key is the credential.
        ...(connection.viaBackend ? { Authorization: `Bearer ${token}` } : { "x-api-key-id": token }),
        "x-sample-rate": String(sampleRate),
        // A per-dictation hint wins; otherwise the provider's configured locale.
        language_code: options.languageHint
          ? toLocale(options.languageHint)
          : (connection.language ?? DEFAULT_LANGUAGE),
        // `||`, not `??`: an empty model name is not a choice.
        model: connection.model?.trim() || DEFAULT_MODEL,
        ...(connection.format ? { format: connection.format } : {}),
        ...(keyterms.length > 0 ? { keyterms: keyterms.join(",") } : {}),
      },
    });
    this.socket.binaryType = "arraybuffer";

    this.socket.onmessage = (event) => this.receive(event.data);
    this.socket.onerror = () =>
      this.fail(
        new SubxError(
          "provider",
          connection.viaBackend
            ? "Speech-to-text refused the connection. Sign in again, then try once more."
            : "Gnani refused the connection — check the API key and that it is active",
        ),
      );
    this.socket.onclose = (event) => {
      // Whatever was heard before the close is kept; finish() reports it rather than throwing.
      this.drain(false);
      if (!event.wasClean && !this.failure && !this.committed) {
        this.fail(new SubxError("provider", `Gnani closed the connection (${event.code})`));
      }
    };

    setTimeout(() => {
      if (!this.opened) {
        this.fail(
          new SubxError(
            "provider",
            connection.viaBackend
              ? "Speech-to-text did not answer in time. Check your connection and try again."
              : "Gnani did not accept the connection",
          ),
        );
      }
    }, OPEN_TIMEOUT_MS);
  }

  ready(): Promise<void> {
    return this.openPromise;
  }

  push(samples: Int16Array): void {
    if (this.failure) return;
    if (!this.opened) {
      this.backlog.push(samples);
      return;
    }
    this.sendAudio(samples);
  }

  /**
   * Gnani has no interim results, so "recognised so far" is the utterances it has already closed.
   * Text therefore appears a phrase at a time rather than a word at a time.
   */
  partial(): string {
    return this.parts.join(" ").trim();
  }

  async finish(): Promise<Transcript> {
    if (this.failure && this.parts.length === 0) throw this.failure;

    if (this.socket.readyState === WebSocket.OPEN) {
      this.flushCarry();
      this.committed = true;
      // Close the open utterance now instead of waiting for the service's own silence detection.
      this.socket.send(JSON.stringify({ type: "commit" }));
      if (this.batch) {
        // Nothing announces that a committed clip is finished, and the service may not even have
        // reached the audio yet, so settle on quiet: keep waiting while transcripts arrive and
        // stop once a window passes without one.
        while (await this.waitForTranscript(BATCH_SETTLE_MS)) {
          // keep draining
        }
      } else {
        // Streaming: wait only for utterances the service has actually opened. A commit with none
        // open gets no reply at all, and waiting on it would stall every dictation that happened
        // to end in a pause.
        while (this.openUtterances.size > 0) {
          if (!(await this.waitForTranscript(COMMIT_TIMEOUT_MS))) break;
        }
      }
    }

    this.close();
    const text = this.partial();
    if (this.failure && !text) throw this.failure;
    return { text, languages: [...this.languages] };
  }

  /** Re-frames arbitrary mic chunks into the fixed-size frames the service expects. */
  private sendAudio(samples: Int16Array): void {
    const incoming = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
    let buffer: Uint8Array;
    if (this.carry.length === 0) {
      buffer = incoming;
    } else {
      buffer = new Uint8Array(this.carry.length + incoming.length);
      buffer.set(this.carry, 0);
      buffer.set(incoming, this.carry.length);
    }

    let offset = 0;
    for (; offset + FRAME_BYTES <= buffer.length; offset += FRAME_BYTES) {
      this.socket.send(buffer.slice(offset, offset + FRAME_BYTES));
    }
    this.carry = buffer.slice(offset);
  }

  /** Pad the last part-frame with silence so the tail of the recording is not dropped. */
  private flushCarry(): void {
    if (this.carry.length === 0) return;
    const frame = new Uint8Array(FRAME_BYTES);
    frame.set(this.carry, 0);
    this.carry = new Uint8Array(0);
    this.socket.send(frame);
  }

  private receive(data: unknown): void {
    if (typeof data !== "string") return;
    let message: GnaniMessage;
    try {
      message = JSON.parse(data) as GnaniMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case "connected":
        this.opened = true;
        for (const chunk of this.backlog) this.sendAudio(chunk);
        this.backlog = [];
        this.settleOpen?.();
        this.settleOpen = null;
        this.failOpen = null;
        return;

      case "speech_start":
        if (message.utterance_id) this.openUtterances.add(message.utterance_id);
        return;

      case "transcript": {
        if (message.utterance_id) this.openUtterances.delete(message.utterance_id);
        const text = message.text?.trim();
        if (text) this.parts.push(text);
        // The service tags a whole utterance with one language, not each word.
        if (message.detected_language_code) {
          this.languages.add(baseLanguage(message.detected_language_code));
        }
        this.drain(true);
        return;
      }

      case "error":
        this.fail(new SubxError("provider", `Gnani: ${message.message ?? "unknown error"}`));
        return;

      default:
        // `processing`, `settings_updated` and anything added later carry nothing we need.
        return;
    }
  }

  /** True if another transcript arrived within the budget, false on timeout or a dead socket. */
  private waitForTranscript(budgetMs: number): Promise<boolean> {
    return Promise.race([
      new Promise<boolean>((resolve) => {
        this.settleDrained = resolve;
      }),
      delay(budgetMs).then(() => false),
    ]);
  }

  private drain(arrived: boolean): void {
    this.settleDrained?.(arrived);
    this.settleDrained = null;
  }

  private fail(error: Error): void {
    this.failure ??= error;
    this.failOpen?.(error);
    this.failOpen = null;
    this.settleOpen = null;
    this.drain(false);
    this.close();
  }

  private close(): void {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

/**
 * Dictionary words travel on the upgrade request, which bounds what they may contain: a character
 * above U+00FF makes the WebSocket constructor throw outright, a comma would be read as a term
 * separator, and a CR or LF would let a dictionary entry inject a header. Devanagari terms cannot
 * be sent at all, so they are dropped — recognition then runs without that hint instead of the
 * whole dictation failing.
 */
export function headerSafeTerms(terms: string[]): string[] {
  const safe: string[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (trimmed.length > 0 && !trimmed.includes(",") && /^[ -ÿ]+$/.test(trimmed)) {
      safe.push(trimmed);
    }
  }
  return safe;
}

/** Accepts "hi" as well as "hi-IN", since settings and callers use the bare code. */
export function toLocale(language: string): GnaniLanguage {
  if (isGnaniLanguage(language)) return language;
  const candidate = `${language.toLowerCase()}-IN`;
  return isGnaniLanguage(candidate) ? candidate : DEFAULT_LANGUAGE;
}

/** "en-IN" → "en", to match the bare codes the Transcript contract uses. */
function baseLanguage(code: string): string {
  return code.split("-")[0] ?? code;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
