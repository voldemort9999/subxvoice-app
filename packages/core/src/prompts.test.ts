import { describe, expect, it } from "vitest";
import { dictationPrompt, needsTransliteration, styleRewritePrompt, tidyDictation } from "./prompts";

describe("needsTransliteration", () => {
  it("is off unless the user asked for Roman letters", () => {
    expect(needsTransliteration("मुझे कल जाना है", "native")).toBe(false);
  });

  it("spots a non-Latin script", () => {
    expect(needsTransliteration("मुझे kal jaana hai", "roman")).toBe(true);
  });

  it("skips text that is already Latin, accents and punctuation included", () => {
    expect(needsTransliteration("Please add the meeting — café, 9am!", "roman")).toBe(false);
  });
});

describe("prompts", () => {
  it("both prompts forbid translation", () => {
    expect(dictationPrompt()).toMatch(/never translate/i);
    expect(styleRewritePrompt({})).toMatch(/never translate/i);
  });

  // Speech recognition writes English loanwords in Devanagari ("प्लीज़"), and spelling those
  // phonetically turns plain English into gibberish ("Pleez note dait").
  it("tells the model to spell English words in English, even from Devanagari", () => {
    const prompt = dictationPrompt();
    expect(prompt).toMatch(/standard English/i);
    expect(prompt).toContain("प्लीज़");
    expect(prompt).toMatch(/never spell an English word phonetically/i);
  });

  it("writes every Indian language phonetically in Latin letters, keeping that language", () => {
    expect(dictationPrompt()).toMatch(/Gujarati/);
    expect(dictationPrompt()).toMatch(/phonetically in Latin letters/i);
  });

  it("repairs a misheard word only when a sound-alike is more likely, and never invents", () => {
    const prompt = dictationPrompt();
    expect(prompt).toMatch(/sounds like what was said/i);
    expect(prompt).toMatch(/more than half sure/i);
    expect(prompt).toMatch(/never add an idea/i);
  });

  it("says a danda is a pause, not the end of a sentence", () => {
    expect(dictationPrompt()).toMatch(/does not mean the thought has ended/i);
  });

  it("asks for chat style: no full stops, lowercase but names", () => {
    const prompt = dictationPrompt();
    expect(prompt).toMatch(/no full stops at all/i);
    expect(prompt).toMatch(/lowercase/i);
  });

  it("tells the model the text is dictation, not a question to answer", () => {
    expect(dictationPrompt()).toMatch(/not a question to you/i);
  });

  it("hands the model the user's dictionary, and says nothing when there is none", () => {
    expect(dictationPrompt(["Aarnav", "SUBXVoice"])).toContain("Aarnav, SUBXVoice");
    expect(dictationPrompt()).not.toMatch(/Names and words this person uses/);
  });

  it("style mode folds the script rule in, so there is only ever one LLM call", () => {
    expect(styleRewritePrompt({}, "roman")).toMatch(/Latin letters/);
    expect(styleRewritePrompt({}, "native")).not.toMatch(/Latin letters/);
  });
});

describe("tidyDictation", () => {
  it("drops full stops and leftover dandas, but keeps decimals and addresses", () => {
    expect(tidyDictation("Kal meeting hai. Slides ready rakhna.")).toBe(
      "Kal meeting hai Slides ready rakhna",
    );
    expect(tidyDictation("main। 3 din tak")).toBe("main 3 din tak");
    expect(tidyDictation("version 2.5 on subxvoice.vercel.app")).toBe("version 2.5 on subxvoice.vercel.app");
    expect(tidyDictation("wait...")).toBe("wait");
  });

  it("keeps question marks and commas, and tightens the spaces around them", () => {
    expect(tidyDictation("fix hua ya nahi ? aur kya hai?")).toBe("fix hua ya nahi? aur kya hai?");
    expect(tidyDictation("fix hua ya nahi?, aur")).toBe("fix hua ya nahi? aur");
  });

  it("turns typographic dashes and quotes into plain ones", () => {
    expect(tidyDictation("10‑20 example, Kesar‑iya — theek")).toBe("10-20 example, Kesar-iya, theek");
    expect(tidyDictation("‘ok’")).toBe("'ok'");
  });
});
