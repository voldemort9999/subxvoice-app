import type { SessionRecord } from "@subx/core";
import { DAY_MS, formatSpeechTotal, startOfDay } from "./format";

const DAYS = 14;

/**
 * Speaking time per day, mirrored around a centre line so it reads as a waveform rather than a bar
 * chart — the one piece of decoration that is actually about the subject.
 */
export function VoiceStrip({ records }: { records: SessionRecord[] }) {
  const today = startOfDay(Date.now());
  const days = Array.from({ length: DAYS }, (_, index) => {
    const start = today - (DAYS - 1 - index) * DAY_MS;
    const ms = records
      .filter((record) => record.createdAt >= start && record.createdAt < start + DAY_MS)
      .reduce((total, record) => total + (record.audioMs ?? 0), 0);
    return { start, ms };
  });
  const max = Math.max(...days.map((day) => day.ms), 1);

  return (
    <figure>
      <div
        className="flex h-24 items-center gap-2"
        role="img"
        aria-label="Speaking time per day, last 14 days"
      >
        {days.map(({ start, ms }) => {
          const height = ms ? Math.max(8, (ms / max) * 100) : 2;
          return (
            <div
              key={start}
              className="flex h-full flex-1 items-center justify-center"
              title={`${new Date(start).toLocaleDateString()}: ${formatSpeechTotal(ms)}`}
            >
              <div
                className={`w-full max-w-4 rounded-full ${
                  ms ? (start === today ? "bg-accent" : "bg-speech") : "bg-line-soft"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-xs">
        {days.map(({ start }) => (
          <span
            key={start}
            className={`flex-1 text-center ${start === today ? "font-semibold text-ink" : "text-faint"}`}
          >
            {new Date(start).toLocaleDateString([], { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </figure>
  );
}
