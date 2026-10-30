import type { SessionRecord } from "@subx/core";
import { useMemo, useState } from "react";
import { dayLabel, formatCount, startOfDay } from "../shared/format";
import { HistoryRow } from "../shared/HistoryRow";
import { useHistory } from "../shared/hooks";
import { DownloadIcon, SearchIcon } from "../shared/icons";
import { hasDevanagari, totalWords, wordCount } from "../shared/stats";
import { Badge, Card, Empty, IconButton, Segmented } from "../shared/ui";

type Filter = "all" | "devanagari" | "long";

/** A dictation worth calling long — about a paragraph, where re-reading it is the point. */
const LONG_WORDS = 40;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "devanagari", label: "Hindi" },
  { value: "long", label: "Long" },
];

export function HistoryPage({ hotkey }: { hotkey: string }) {
  const records = useHistory();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const matches = useMemo(() => {
    if (!records) return [];
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === "devanagari" && !hasDevanagari(record.rawText)) return false;
      if (filter === "long" && wordCount(record.finalText) < LONG_WORDS) return false;
      if (!needle) return true;
      return (
        record.finalText.toLowerCase().includes(needle) ||
        record.rawText.toLowerCase().includes(needle) ||
        (record.context.appName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [records, query, filter]);

  if (!records) return null;

  const groups = new Map<number, SessionRecord[]>();
  for (const record of matches) {
    const day = startOfDay(record.createdAt);
    groups.set(day, [...(groups.get(day) ?? []), record]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search what you said"
            aria-label="Search dictations"
            className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-9 text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </label>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Filter dictations" />
        <IconButton
          icon={DownloadIcon}
          label="Export as a text file"
          onClick={() => exportTranscripts(matches)}
        />
      </div>

      <Card
        title={
          query || filter !== "all" ? `${matches.length} of ${records.length}` : "Everything you've said"
        }
        action={<Badge>{formatCount(totalWords(matches))} words</Badge>}
      >
        {records.length === 0 ? (
          <Empty>Nothing here yet. Hold {hotkey} in any app and start talking.</Empty>
        ) : matches.length === 0 ? (
          <Empty>No dictation matches that. Try a different word, or clear the filter.</Empty>
        ) : (
          <div className="space-y-5">
            {[...groups].map(([day, dayRecords]) => (
              <section key={day}>
                <p className="mb-1 font-medium text-muted">{dayLabel(day)}</p>
                <ul className="divide-y divide-line-soft">
                  {dayRecords.map((record) => (
                    <HistoryRow key={record.id} record={record} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

      <p className="px-1 text-xs text-faint">Recordings and transcripts are stored only on this computer.</p>
    </div>
  );
}

/**
 * Plain text, because the thing worth keeping is the words. A download rather than a file dialog:
 * the renderer has no filesystem access, and Chromium already handles this.
 */
function exportTranscripts(records: SessionRecord[]): void {
  const body = records
    .map((record) => `[${new Date(record.createdAt).toLocaleString()}] ${record.finalText}`)
    .join("\n\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `subxvoice-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
