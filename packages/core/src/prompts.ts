import type { AppContext, Intent, ScriptPreference, WritingTone } from "./types";

/** Everything up to here is Latin: ASCII, Latin-1 and the Latin Extended-A/B blocks. */
const LAST_LATIN = 0x024f;
/** General punctuation (curly quotes, dashes) and currency signs are script-neutral. */
const NEUTRAL: [number, number][] = [
  [0x2000, 0x206f],
  [0x20a0, 0x20cf],
];

/**
 * Cheap pre-check so pure English dictation never pays for an LLM round trip. True when the text
 * holds a character from a non-Latin script: Devanagari, Arabic, CJK and so on.
 */
export function needsTransliteration(text: string, script: ScriptPreference): boolean {
  if (script !== "roman") return false;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= LAST_LATIN) continue;
    if (NEUTRAL.some(([from, to]) => code >= from && code <= to)) continue;
    return true;
  }
  return false;
}

/**
 * The hard part is not the script, it is deciding per word. Speech recognition writes English
 * loanwords in Devanagari too ("प्लीज़" is "please", not "pleez"), so a blind phonetic pass turns
 * plain English into gibberish. Every word has to be classified before it is spelled.
 */
const ROMAN_RULE = [
  "Write the text in Latin letters, the way Indians actually type in chat. Decide for EACH word:",
  "- An English word is spelled in correct, standard English — even when the input wrote it in " +
    "Devanagari. प्लीज़ → Please, शेड्यूल → scheduled, रिक्वेस्ट → request, रिज़ल्ट → result, " +
    "एक्सटेंशन → extension, ओके → OK. Never spell an English word phonetically.",
  "- A Hindi or Urdu word is spelled phonetically in Latin letters, as Hinglish: " +
    "तेरी → teri, बहार → bahaar, करना → karna, मुझे → mujhe.",
  "Never translate: an English word stays that English word, a Hindi word stays that Hindi word.",
].join("\n");

export function styleRewritePrompt(context: AppContext, script: ScriptPreference = "native"): string {
  const lines = [
    "You turn dictated speech into clean written text.",
    "Keep every part in the language it was spoken in. Never translate.",
    "Keep the meaning. Remove filler words, fix grammar and punctuation.",
    "Reply with the final text only.",
  ];
  if (script === "roman") lines.push(ROMAN_RULE);
  if (context.appName) {
    lines.push(`The text will be typed into ${context.appName}; match the tone people use there.`);
  }
  return lines.join("\n");
}

/** Exact mode: change the script, nothing else. */
export function transliteratePrompt(): string {
  return [
    "You rewrite dictated speech into the script the user reads, keeping their exact words.",
    ROMAN_RULE,
    // Dictation is one pass with no chance to correct, so an obvious mishearing should be read
    // through rather than faithfully preserved. This has to be stated firmly: told only to keep
    // the user's words, the model leaves "0 March" and "intended" sitting in the sentence.
    "The input came from speech recognition and WILL contain misheard words. Work out what the " +
      "speaker meant and write that. Correct a word that makes no sense in context, and fix the " +
      "small connector words (the, to, and, is) that were misheard and break the grammar.",
    "Do not add ideas, opinions or content of your own, and do not drop or summarise anything " +
      "the speaker actually said. Only repair what was clearly misheard.",
    "Do not answer or react to the text — it is dictation to be typed, not a question to you.",
    "Add natural punctuation and capitalisation. Reply with the converted text only.",
    "",
    "Example (note marks/entertained/the — all misheard, all repaired):",
    "Input: प्लीज़ नोट दैट मिसिंग और शेड्यूल वाइवा टू विल रिज़ल्ट इन 0 मार्च फॉर द वाइवा, " +
      "नो फर्दर एक्सटेंशन, सो रीशेड्यूलिंग रिक्वेस्ट विल बी इंटरटेन्ड।",
    "Output: Please note that missing the scheduled viva will result in 0 marks for the viva. " +
      "No further extension, so no rescheduling request will be entertained.",
    "",
    "Example (Hindi words stay Hindi, English words stay English):",
    "Input: हाय, तेरी बहार— How are you?",
    "Output: Haay, teri bahaar— How are you?",
  ].join("\n");
}

/**
 * Deciding what the speaker wanted.
 *
 * These go to the decisions model as `criteria`, one per option, so they are written as
 * definitions rather than instructions. The bar for leaving "dictation" is deliberately high:
 * getting this wrong replaces the user's own words with something invented, which is far worse
 * than failing to notice a request to write an email.
 */
export const INTENT_CRITERIA: Record<Intent, string> = {
  dictation:
    "The speaker is dictating text to be typed exactly as spoken — a note, a sentence, a reply " +
    "they are composing themselves, a search query, code, anything. This is the default and by " +
    "far the most common. Choose it whenever there is any doubt, and whenever the speaker is " +
    "simply saying words they want written down rather than asking for something to be written.",
  email:
    "The speaker is asking for an EMAIL to be written for them, and is describing what it should " +
    "say rather than saying it. Typically opens with an instruction such as 'write an email', " +
    "'mail karo', 'draft a mail to my manager', followed by the gist.",
  message:
    "The speaker is asking for a short MESSAGE to be written for them — WhatsApp, SMS, Slack, a " +
    "chat reply — describing what it should say rather than saying it. Typically opens with " +
    "'write a message', 'message bhejo', 'text him that…', followed by the gist.",
};

export const INTENT_QUESTION =
  "Does the speaker want these words typed out as they are, or are they asking for an email or a " +
  "message to be written for them?";

const TONE_RULE: Record<WritingTone, string> = {
  professional:
    "Professional: clear, courteous and efficient. Normal business English, contractions are " +
    "fine, no flowery openings and no filler.",
  formal:
    "Formal: respectful and complete. Full sentences, no contractions, a proper salutation and " +
    "sign-off, nothing colloquial.",
  casual:
    "Casual: how you would write to a colleague you know well. Short, warm, contractions, no " +
    "corporate phrasing.",
};

export interface ComposeOptions {
  tone: WritingTone;
  /** Signed off with, when known. Collected during setup. */
  userName?: string;
}

/**
 * Writing an email from a spoken instruction.
 *
 * Always English, whatever the speaker used: a Hindi instruction ("boss ko chhutti ki mail likho")
 * is still asking for an email that will be sent in English. Messages are the opposite case — see
 * `messagePrompt`.
 */
export function emailPrompt({ tone, userName }: ComposeOptions): string {
  return [
    "You write emails from a spoken instruction. The speaker is describing the email they want; " +
      "they are not dictating its words.",
    TONE_RULE[tone],
    "Write in English, whatever language the instruction was given in.",
    "Length follows the instruction: a one-line note stays a one-line note, a request with " +
      "several points covers all of them. Never pad.",
    "Include a subject line as the first line, in the form `Subject: …`, then a blank line, then " +
      "the body.",
    userName
      ? `Sign off as ${userName}.`
      : "Sign off with a closing line only — no name, since you do not know the sender's.",
    "Use only what the instruction gives you. Never invent a fact, a date, a number or a name. " +
      "If something is genuinely required and missing, leave a clearly marked [placeholder].",
    "Reply with the email only — no preamble, no explanation, no quotes around it.",
  ].join("\n");
}

/**
 * Writing a chat message from a spoken instruction. Unlike email this keeps the speaker's own
 * language, because a WhatsApp message dictated in Hinglish should go out in Hinglish.
 */
export function messagePrompt({ tone, userName }: ComposeOptions, script: ScriptPreference): string {
  const lines = [
    "You write short chat messages — WhatsApp, SMS, Slack — from a spoken instruction.",
    // Without this said twice and shown once, the model transliterates the instruction and
    // hands it straight back: "mummy ko message bhejo ki main late ho jaunga" came out verbatim
    // instead of becoming the message to Mummy.
    "The input is the sender TELLING YOU what to send. It is not the message. Rewrite it as the " +
      "message itself, addressed to the recipient, in the sender's own voice. Never repeat the " +
      "instruction back, and never include the words that named the recipient or asked you to send.",
    TONE_RULE[tone],
    "Keep it to the length a person would actually send: usually one or two sentences. No subject " +
      "line, no email sign-off, no bullet points unless the instruction asks for a list.",
    "Write in the same language the instruction used. A Hindi instruction produces a Hindi message.",
    script === "roman"
      ? "Use Latin letters, the way Indians type in chat — Hinglish, not Devanagari. English words " +
        "keep their normal English spelling."
      : "Use the language's own script.",
    "Use only what the instruction gives you. Never invent a fact, a date, a number or a name.",
    "Reply with the message only — no preamble, no explanation, no quotes around it.",
    "",
    "Example:",
    "Instruction: mummy ko message bhejo ki main aaj khana bahar kha lunga, late ho jaunga",
    "Message: Mummy, aaj main bahar hi khana kha lunga. Thoda late ho jaunga.",
    "",
    "Example:",
    "Instruction: write a message to Rahul that I'll be 10 minutes late",
    "Message: Hey Rahul, running about 10 minutes late — see you shortly.",
  ];
  if (userName) lines.push("", `If the message needs the sender's name, it is ${userName}.`);
  return lines.join("\n");
}
