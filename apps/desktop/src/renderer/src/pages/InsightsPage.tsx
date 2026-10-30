import { useState } from "react";
import { formatCount, formatDuration, formatSpan } from "../shared/format";
import { useHistory } from "../shared/hooks";
import {
  byApp,
  byDay,
  byHour,
  latency,
  longest,
  pipelineMix,
  speakingMs,
  timeSavedMs,
  totalWords,
  wordCount,
  wordsPerMinute,
} from "../shared/stats";
import { Badge, Card, CopyButton, Empty, Segmented, Stat } from "../shared/ui";

type Range = "7" | "30" | "90";

const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export function InsightsPage({ hotkey }: { hotkey: string }) {
  const records = useHistory();
  const [range, setRange] = useState<Range>("30");
  if (!records) return null;

  if (records.length === 0) {
    return (
      <Card title="Insights">
        <Empty>Nothing to show yet. Hold {hotkey} in any app, and what you dictate turns up here.</Empty>
      </Card>
    );
  }

  const days = Number(range);
  const buckets = byDay(records, days);
  const inRange = buckets.flatMap((bucket) => bucket.records);
  const apps = byApp(inRange);
  const hours = byHour(inRange);
  const wait = latency(inRange);
  const mix = pipelineMix(inRange);
  const best = longest(inRange);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted">
          {inRange.length === 0
            ? "Nothing dictated in this period."
            : `${formatCount(inRange.length)} dictations, ${formatCount(totalWords(inRange))} words.`}
        </p>
        <Segmented options={RANGES} value={range} onChange={setRange} label="Time range" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Words" value={formatCount(totalWords(inRange))} note={`Over ${days} days`} />
        <Stat
          label="Spoken"
          value={formatDuration(speakingMs(inRange))}
          note="Microphone time"
          tone="speech"
        />
        <Stat
          label="Time saved"
          value={formatSpan(timeSavedMs(inRange))}
          note="Against 40 wpm typing"
          tone="accent"
        />
        <Stat
          label="Rate"
          value={wordsPerMinute(inRange) ? String(wordsPerMinute(inRange)) : "—"}
          unit={wordsPerMinute(inRange) ? "wpm" : undefined}
          note="While speaking"
        />
      </div>

      <Card title="Words per day">
        <DailyBars buckets={buckets} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Where the words went">
          {apps.length === 0 ? (
            <Empty>No app recorded yet for these dictations.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {apps.map((app) => {
                const share = app.count / (apps[0]?.count || 1);
                return (
                  <li key={app.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{app.name}</span>
                      <span className="figure-num shrink-0 text-xs text-muted">
                        {app.count} · {formatCount(app.words)} words
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(3, share * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="When you dictate">
          <HourStrip hours={hours} />
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="How long you wait after letting go">
          {wait.samples === 0 ? (
            <Empty>No completed dictations in this period.</Empty>
          ) : (
            <>
              <p className="figure-num text-[26px] leading-none font-semibold">
                {wait.total}
                <span className="ml-1 text-[13px] font-medium text-muted">ms median</span>
              </p>
              <p className="mt-1 text-xs text-faint">
                Measured from key-release across {wait.samples}{" "}
                {wait.samples === 1 ? "dictation" : "dictations"}
              </p>
              <dl className="mt-4 space-y-2">
                <Stage label="Speech to text" ms={wait.stt} total={wait.total} tone="bg-speech" />
                <Stage label="Rewriting" ms={wait.llm} total={wait.total} tone="bg-accent" />
                <Stage label="Typing it out" ms={wait.insert} total={wait.total} tone="bg-warn" />
              </dl>
            </>
          )}
        </Card>

        <Card title="What the pipeline did">
          {mix.total === 0 ? (
            <Empty>No transcripts in this period.</Empty>
          ) : (
            <ul className="space-y-3">
              <Mix label="Came back in Devanagari" value={mix.devanagari} total={mix.total} />
              <Mix label="Rewritten before typing" value={mix.cleaned} total={mix.total} />
              <Mix label="Typed in Roman script" value={mix.romanOut} total={mix.total} />
            </ul>
          )}
        </Card>
      </div>

      {best?.finalText && (
        <Card
          title="Longest dictation"
          action={
            <div className="flex items-center gap-2">
              <Badge tone="speech">{wordCount(best.finalText)} words</Badge>
              <CopyButton text={best.finalText} />
            </div>
          }
        >
          <p className="voice-text max-h-40 overflow-y-auto text-muted">{best.finalText}</p>
        </Card>
      )}
    </div>
  );
}

function DailyBars({ buckets }: { buckets: ReturnType<typeof byDay> }) {
  const max = Math.max(...buckets.map((bucket) => bucket.words), 1);
  const dense = buckets.length > 30;

  return (
    <figure>
      <div
        className="flex h-32 items-end gap-[3px]"
        role="img"
        aria-label={`Words dictated per day over the last ${buckets.length} days`}
      >
        {buckets.map((bucket) => (
          <div
            key={bucket.start}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${new Date(bucket.start).toLocaleDateString()}: ${bucket.words} words`}
          >
            <div
              className={`w-full rounded-sm ${bucket.words ? "bg-accent" : "bg-line-soft"}`}
              style={{ height: bucket.words ? `${Math.max(4, (bucket.words / max) * 100)}%` : 2 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>
          {new Date(buckets[0]?.start ?? Date.now()).toLocaleDateString([], {
            day: "numeric",
            month: "short",
          })}
        </span>
        {!dense && <span className="figure-num">{max} words at most</span>}
        <span>Today</span>
      </div>
    </figure>
  );
}

/** 24 cells, so the hours you never dictate in are as visible as the ones you do. */
/** Fixed positions, so the key is the hour itself rather than a list index. */
const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour);

function HourStrip({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1);
  return (
    <figure>
      <div className="flex gap-[3px]" role="img" aria-label="Dictations by hour of day">
        {HOURS_OF_DAY.map((hour) => {
          const count = hours[hour] ?? 0;
          return (
            <div
              key={hour}
              className="h-9 flex-1 rounded-sm"
              style={{
                background: count
                  ? `color-mix(in oklab, var(--accent) ${Math.round((count / max) * 85 + 15)}%, var(--raised))`
                  : "var(--line-soft)",
              }}
              title={`${hour}:00 — ${count} ${count === 1 ? "dictation" : "dictations"}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>midnight</span>
        <span>noon</span>
        <span>midnight</span>
      </div>
    </figure>
  );
}

function Stage({ label, ms, total, tone }: { label: string; ms: number; total: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted">{label}</dt>
        <dd className="figure-num font-medium">{ms} ms</dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, (ms / (total || 1)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Mix({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = Math.round((value / total) * 100);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="figure-num font-medium">
          {value}
          <span className="ml-1 text-xs text-faint">{percent}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-speech" style={{ width: `${percent}%` }} />
      </div>
    </li>
  );
}
