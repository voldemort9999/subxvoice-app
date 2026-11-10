import type { DictionaryEntry } from "@subx/core";
import { type FormEvent, useEffect, useState } from "react";
import { TrashIcon } from "../shared/icons";
import { Button, Empty, FIELD, IconButton, Section } from "../shared/ui";

/**
 * Terms above U+00FF cannot ride on the speech-to-text upgrade request, so they are kept as
 * corrections applied after recognition rather than as hints sent before it. Worth saying in the
 * UI, because a Devanagari entry behaves differently from a Latin one.
 */
const isLatin = (word: string) => /^[ -ÿ]+$/.test(word);

export function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [word, setWord] = useState("");
  const [heardAs, setHeardAs] = useState("");

  const load = () => void window.subx.dictionary.list().then(setEntries);
  useEffect(load, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!word.trim()) return;
    const misheardAs = heardAs
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await window.subx.dictionary.upsert({ word: word.trim(), misheardAs });
    setWord("");
    setHeardAs("");
    load();
  }

  async function remove(entryWord: string) {
    await window.subx.dictionary.remove(entryWord);
    load();
  }

  return (
    <div className="space-y-10">
      <Section title="Add a word">
        <p className="mb-5 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          Names, products and terms to spell your way. List what SUBXVoice tends to hear instead, separated by
          commas, and it will correct them.
        </p>
        <form onSubmit={add} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <label className="space-y-1.5">
            <span className="font-semibold">Word</span>
            <input
              className={FIELD}
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder="SUBXVoice"
            />
          </label>
          <label className="space-y-1.5">
            <span className="font-semibold">Often heard as</span>
            <input
              className={`${FIELD} font-mono`}
              value={heardAs}
              onChange={(event) => setHeardAs(event.target.value)}
              placeholder="sub x voice, subex voice"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!word.trim()} className="py-2">
            Add word
          </Button>
        </form>
      </Section>

      <Section
        title={entries.length ? `${entries.length} ${entries.length === 1 ? "word" : "words"}` : "Your words"}
      >
        {entries.length === 0 ? (
          <Empty>No words yet. Start with the names you say most often.</Empty>
        ) : (
          <ul className="divide-y divide-rule">
            {entries.map((entry) => (
              <li key={entry.word} className="group flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="voice-text flex items-baseline gap-3 text-[15px] font-semibold">
                    {entry.word}
                    {!isLatin(entry.word) && (
                      <span className="text-xs font-normal text-ink-faint">corrected after recognition</span>
                    )}
                  </p>
                  {entry.misheardAs.length > 0 && (
                    <p className="mt-0.5 truncate text-ink-soft">
                      Fixes <span className="spoken">{entry.misheardAs.join(", ")}</span>
                    </p>
                  )}
                </div>
                <IconButton
                  icon={TrashIcon}
                  label={`Remove ${entry.word}`}
                  onClick={() => remove(entry.word)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
