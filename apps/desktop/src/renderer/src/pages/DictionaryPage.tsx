import type { DictionaryEntry } from "@subx/core";
import { type FormEvent, useEffect, useState } from "react";
import { TrashIcon } from "../shared/icons";
import { Badge, Button, Card, Empty, IconButton } from "../shared/ui";

const INPUT =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none placeholder:text-faint focus:border-accent";

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
    <div className="space-y-6">
      <Card title="Add a word">
        <p className="mb-4 max-w-xl text-muted">
          Names, products and terms to spell your way. List what SUBXVoice tends to hear instead, separated by
          commas, and it will correct them.
        </p>
        <form onSubmit={add} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <label className="space-y-1.5">
            <span className="font-medium">Word</span>
            <input
              className={INPUT}
              value={word}
              onChange={(event) => setWord(event.target.value)}
              placeholder="SUBXVoice"
            />
          </label>
          <label className="space-y-1.5">
            <span className="font-medium">Often heard as</span>
            <input
              className={INPUT}
              value={heardAs}
              onChange={(event) => setHeardAs(event.target.value)}
              placeholder="sub x voice, subex voice"
            />
          </label>
          <Button type="submit" variant="primary" disabled={!word.trim()} className="py-2">
            Add word
          </Button>
        </form>
      </Card>

      <Card
        title={entries.length ? `${entries.length} ${entries.length === 1 ? "word" : "words"}` : "Your words"}
      >
        {entries.length === 0 ? (
          <Empty>No words yet. Start with the names you say most often.</Empty>
        ) : (
          <ul className="divide-y divide-line-soft">
            {entries.map((entry) => (
              <li key={entry.word} className="group flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="voice-text flex items-center gap-2 font-medium">
                    {entry.word}
                    {!isLatin(entry.word) && <Badge>corrected after recognition</Badge>}
                  </p>
                  {entry.misheardAs.length > 0 && (
                    <p className="truncate text-muted">Fixes {entry.misheardAs.join(", ")}</p>
                  )}
                </div>
                <IconButton
                  icon={TrashIcon}
                  label={`Remove ${entry.word}`}
                  tone="danger"
                  onClick={() => remove(entry.word)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
