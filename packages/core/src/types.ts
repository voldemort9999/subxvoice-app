/** 16 kHz mono PCM — the one audio format every STT plug receives. */
export interface AudioClip {
  samples: Int16Array;
  sampleRate: number;
}

/** Chosen by the hotkey: keep the user's exact words, or rewrite them in their style. */
/**
 * What a held key means. "exact" and "style" dictate; "command" acts on what was said instead of
 * typing it (docs/command-mode.md).
 */
export type Mode = "exact" | "style" | "command";

/**
 * How non-Latin speech is written down. "native" keeps the language's own script (Devanagari for
 * Hindi); "roman" spells it phonetically in Latin letters (Hinglish). This is transliteration, not
 * translation — the words stay the user's.
 */
export type ScriptPreference = "native" | "roman";

/**
 * What the speaker actually wanted out of this dictation.
 *
 * "dictation" is the default and the overwhelming majority: type what I said. The other two mean
 * the words were an instruction — write me an email, write me a message — and the text that gets
 * pasted is composed rather than transcribed.
 */
export type Intent = "dictation" | "email" | "message";

/** How a composed email or message should read. Set per kind, because most people write formal
 * email and casual chat. */
export type WritingTone = "professional" | "formal" | "casual";

/** What the user is looking at while speaking. Every field is optional — OS support varies. */
export interface AppContext {
  appName?: string;
  appId?: string;
  windowTitle?: string;
  url?: string;
  selectedText?: string;
}

/** A word the user cares about, plus the spellings STT tends to produce instead. */
export interface DictionaryEntry {
  word: string;
  misheardAs: string[];
}

/** Milliseconds spent in each pipeline stage. */
export interface Timings {
  sttMs: number;
  rulesMs: number;
  llmMs: number;
  insertMs: number;
  totalMs: number;
}

/** One dictation, as stored in local history. */
export interface SessionRecord {
  id: string;
  createdAt: number;
  mode: Mode;
  /** Absent on records written before composing existed; treat as "dictation". */
  intent?: Intent;
  context: AppContext;
  rawText: string;
  finalText: string;
  audioPath?: string;
  /** Length of the recording. */
  audioMs?: number;
  /**
   * Set when rewriting or transliteration could not run, so the text went in as it was heard.
   * The words are never lost, but the user is told why they are in the wrong script.
   */
  rewriteError?: string;
  timings: Timings;
}
