import type { WritingTone } from "@subx/core";

/**
 * The three ways a composed email or message can read. Defined once because setup and Settings
 * must offer exactly the same choice — the hints are the only explanation the user ever gets of
 * what the difference actually is, so they show the difference rather than name it.
 */
export const TONE_OPTIONS: { value: WritingTone; label: string; hint: string }[] = [
  {
    value: "professional",
    label: "Professional",
    hint: "Clear and courteous. “Could you send this across by Friday?”",
  },
  {
    value: "formal",
    label: "Formal",
    hint: "Respectful and complete, no contractions. “I would be grateful if you could…”",
  },
  {
    value: "casual",
    label: "Casual",
    hint: "How you'd write to someone you know. “hey, can you send this by friday?”",
  },
];
