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
import { CopyButton, Empty, Figure, Figures, Section, Segmented } from "../shared/ui";

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
    return <Empty>Nothing to show yet. Hold {hotkey} in any app, and what you dictate turns up here.</Empty>;
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
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[14px] text-ink-soft">
          {inRange.length === 0
            ? "Nothing dictated in this period."
            : `${formatCount(inRange.length)} dictations, ${formatCount(totalWords(inRange))} words.`}
        </p>
        <Segmented options={RANGES} value={range} onChange={setRange} label="Time range" />
      </div>

      <Figures>
        <Figure label="Words" value={formatCount(totalWords(inRange))} note={`Over ${days} days`} />
        <Figure label="Spoken" value={formatDuration(speakingMs(inRange))} note="Microphone time" />
        <Figure
          label="Time saved"
          value={formatSpan(timeSavedMs(inRange))}
          note="Against 40 wpm typing"
          mark
        />
        <Figure
          label="Rate"
          value={wordsPerMinute(inRange) ? String(wordsPerMinute(inRange)) : "—"}
          unit={wordsPerMinute(inRange) ? "wpm" : undefined}
          note="While speaking"
        />
      </Figures>

      <Section title="Words per day">
        <DailyBars buckets={buckets} />
      </Section>

      <div className="grid gap-10 md:grid-cols-2">
        <Section title="Where the words went">
          {apps.length === 0 ? (
            <Empty>No app recorded yet for these dictations.</Empty>
          ) : (
            <ul className="space-y-3">
              {apps.map((app) => {
                const share = app.count / (apps[0]?.count || 1);
                return (
                  <li key={app.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold">{app.name}</span>
                      <span className="figure-num shrink-0 text-xs text-ink-soft">
                        {app.count} · {formatCount(app.words)} words
                      </span>
                    </div>
                    <Track percent={Math.max(3, share * 100)} tone="bg-ink-soft" />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="When you dictate">
          <HourStrip hours={hours} />
        </Section>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <Section title="How long you wait after letting go">
          {wait.samples === 0 ? (
            <Empty>No completed dictations in this period.</Empty>
          ) : (
            <>
              <p className="figure text-[34px]">
                {wait.total}
                <span className="ml-1 font-sans text-[13px] font-medium tracking-normal text-ink-soft">
                  ms median
                </span>
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                Measured from key-release across {wait.samples}{" "}
                {wait.samples === 1 ? "dictation" : "dictations"}
              </p>
              {/* Three weights of Aubergine: these are parts of one wait, not rivals for attention. */}
              <dl className="mt-5 space-y-3">
                <Stage label="Speech to text" ms={wait.stt} total={wait.total} tone="bg-ink" />
                <Stage label="Rewriting" ms={wait.llm} total={wait.total} tone="bg-ink-soft" />
                <Stage label="Typing it out" ms={wait.insert} total={wait.total} tone="bg-ink-faint" />
              </dl>
            </>
          )}
        </Section>

        <Section title="What the pipeline did">
          {mix.total === 0 ? (
            <Empty>No transcripts in this period.</Empty>
          ) : (
            <ul className="space-y-3">
              <Mix label="Came back in Devanagari" value={mix.devanagari} total={mix.total} />
              <Mix label="Rewritten before typing" value={mix.cleaned} total={mix.total} />
              <Mix label="Typed in Roman script" value={mix.romanOut} total={mix.total} />
            </ul>
          )}
        </Section>
      </div>

      {best?.finalText && (
        <Section
          title="Longest dictation"
          action={
            <div className="flex items-center gap-3">
              <span className="figure-num text-xs text-ink-soft">{wordCount(best.finalText)} words</span>
              <CopyButton text={best.finalText} />
            </div>
          }
        >
          <p className="voice-text max-h-40 max-w-[68ch] overflow-y-auto text-[14px]">{best.finalText}</p>
        </Section>
      )}
    </div>
  );
}

function Track({ percent, tone }: { percent: number; tone: string }) {
  return (
    <div className="h-1.5 overflow-hidden bg-well">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function DailyBars({ buckets }: { buckets: ReturnType<typeof byDay> }) {
  const max = Math.max(...buckets.map((bucket) => bucket.words), 1);
  const dense = buckets.length > 30;
  const last = buckets.length - 1;

  return (
    <figure className="m-0">
      <div
        className="flex h-32 items-end gap-[3px]"
        role="img"
        aria-label={`Words dictated per day over the last ${buckets.length} days`}
      >
        {buckets.map((bucket, index) => (
          <div
            key={bucket.start}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${new Date(bucket.start).toLocaleDateString()}: ${bucket.words} words`}
          >
            <div
              // Today is the one bar still growing, so it carries the accent.
              className={`w-full rounded-t-[2px] ${
                bucket.words ? (index === last ? "bg-marigold" : "bg-ink-soft") : "bg-rule-strong"
              }`}
              style={{ height: bucket.words ? `${Math.max(4, (bucket.words / max) * 100)}%` : 2 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-rule pt-2 text-xs text-ink-faint">
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
    <figure className="m-0">
      <div className="flex gap-[3px]" role="img" aria-label="Dictations by hour of day">
        {HOURS_OF_DAY.map((hour) => {
          const count = hours[hour] ?? 0;
          return (
            <div
              key={hour}
              className="h-9 flex-1 rounded-[2px]"
              style={{
                background: count
                  ? `color-mix(in oklab, var(--ink) ${Math.round((count / max) * 85 + 15)}%, var(--page))`
                  : "var(--well)",
              }}
              title={`${hour}:00 — ${count} ${count === 1 ? "dictation" : "dictations"}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-faint">
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
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <dt className="text-ink-soft">{label}</dt>
        <dd className="figure-num m-0 font-semibold">{ms} ms</dd>
      </div>
      <Track percent={(ms / (total || 1)) * 100} tone={tone} />
    </div>
  );
}

function Mix({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = Math.round((value / total) * 100);
  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-ink-soft">{label}</span>
        <span className="figure-num font-semibold">
          {value}
          <span className="ml-1.5 text-xs font-normal text-ink-faint">{percent}%</span>
        </span>
      </div>
      <Track percent={percent} tone="bg-ink-soft" />
    </li>
  );
}
