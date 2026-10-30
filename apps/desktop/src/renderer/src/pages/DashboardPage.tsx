import type { SessionRecord } from "@subx/core";
import { AudioButton } from "../shared/AudioButton";
import { DAY_MS, formatCount, formatDuration, formatSpan, formatTime, streakDays } from "../shared/format";
import { HistoryRow } from "../shared/HistoryRow";
import { useHistory, usePermissions } from "../shared/hooks";
import { BoltIcon, CalendarIcon, ClockIcon, MicIcon } from "../shared/icons";
import type { PageId } from "../shared/Sidebar";
import {
  hasDevanagari,
  speakingMs,
  timeSavedMs,
  totalWords,
  wordCount,
  wordsPerMinute,
} from "../shared/stats";
import { Badge, Button, Card, CopyButton, Empty, Stat } from "../shared/ui";
import { VoiceStrip } from "../shared/VoiceStrip";

const RECENT_COUNT = 6;

/** A streak of one is today — saying "start one" under it reads as a bug. */
function streakNote(streak: number): string {
  if (streak === 0) return "Dictate today to start one";
  if (streak === 1) return "Come back tomorrow to build it";
  return "Keep it going";
}

export function DashboardPage({
  hotkey,
  onNavigate,
}: {
  hotkey: string;
  onNavigate: (page: PageId) => void;
}) {
  const records = useHistory();
  const permissions = usePermissions();
  if (!records) return null;

  // "unknown" (e.g. Input Monitoring on Mac, which Electron can't read) is not treated as missing.
  const missingPermission = permissions?.some(
    (permission) => permission.state === "denied" || permission.state === "not_asked",
  );
  const week = records.filter((record) => record.createdAt >= Date.now() - 7 * DAY_MS);
  const streak = streakDays(records);
  const latest = records[0];

  return (
    <div className="space-y-6">
      {missingPermission && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
          <p>SUBXVoice needs microphone access before it can type for you.</p>
          <Button variant="primary" onClick={() => onNavigate("settings")}>
            Review permissions
          </Button>
        </div>
      )}

      {latest ? <LastDictation record={latest} /> : <FirstRun hotkey={hotkey} />}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat
          label="Words this week"
          value={formatCount(totalWords(week))}
          note={`${week.length} ${week.length === 1 ? "dictation" : "dictations"}`}
          icon={MicIcon}
        />
        <Stat
          label="Time saved"
          value={formatSpan(timeSavedMs(records))}
          note="Against typing at 40 wpm"
          icon={ClockIcon}
          tone="accent"
        />
        <Stat
          label="Speaking rate"
          value={wordsPerMinute(records) ? String(wordsPerMinute(records)) : "—"}
          unit={wordsPerMinute(records) ? "wpm" : undefined}
          note={`${formatDuration(speakingMs(records))} of speech in total`}
          icon={BoltIcon}
          tone="speech"
        />
        <Stat
          label="Streak"
          value={streak ? String(streak) : "—"}
          unit={streak ? (streak === 1 ? "day" : "days") : undefined}
          note={streakNote(streak)}
          icon={CalendarIcon}
        />
      </div>

      <Card
        title="Speaking time, last two weeks"
        action={
          <button
            type="button"
            onClick={() => onNavigate("insights")}
            className="text-accent hover:underline"
          >
            More insights
          </button>
        }
      >
        <VoiceStrip records={records} />
      </Card>

      <Card
        title="Recent"
        action={
          records.length > RECENT_COUNT ? (
            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="text-accent hover:underline"
            >
              See all {records.length}
            </button>
          ) : undefined
        }
      >
        {records.length === 0 ? (
          <Empty>Hold {hotkey} in any app and start talking.</Empty>
        ) : (
          <ul className="divide-y divide-line-soft">
            {records.slice(0, RECENT_COUNT).map((record) => (
              <HistoryRow key={record.id} record={record} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * The hero, and the only place the whole pipeline is visible: what the microphone heard, and what
 * was actually typed. The two differ on almost every Hindi dictation, and that difference is the
 * product — so it gets the space rather than another counter.
 */
function LastDictation({ record }: { record: SessionRecord }) {
  const changed = Boolean(record.rawText) && record.rawText !== record.finalText;

  return (
    <section className="panel overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
        <div className="flex items-center gap-2.5">
          <AudioButton id={record.id} />
          <div>
            <p className="font-medium">Last dictation</p>
            <p className="text-xs text-muted">
              {formatTime(record.createdAt)}
              {record.context.appName ? ` into ${record.context.appName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="speech">{formatDuration(record.audioMs ?? 0)}</Badge>
          <Badge>{wordCount(record.finalText)} words</Badge>
          <CopyButton text={record.finalText} />
        </div>
      </div>

      <div className="px-5 py-5">
        {record.finalText ? (
          <p className="voice-text max-w-[62ch] text-[19px] text-ink">{record.finalText}</p>
        ) : (
          <p className="text-muted">No text came back. Check that speech-to-text is connected in Settings.</p>
        )}

        {changed && (
          <div className="mt-4 border-t border-line-soft pt-3.5">
            <p className="mb-1 text-xs text-faint">
              {hasDevanagari(record.rawText) ? "Heard in Devanagari" : "Heard as"}
            </p>
            <p className="voice-text max-w-[62ch] text-muted">{record.rawText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function FirstRun({ hotkey }: { hotkey: string }) {
  return (
    <section className="panel rounded-2xl px-5 py-8 text-center">
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
        <MicIcon className="h-5 w-5 text-accent" />
      </span>
      <h2 className="text-[19px] font-semibold tracking-tight">Hold {hotkey} and say something</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">
        Speak Hindi, English, or both in one sentence. The text lands wherever your cursor is, and every
        recording stays on this computer.
      </p>
    </section>
  );
}
