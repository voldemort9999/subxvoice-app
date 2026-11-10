import type { SessionRecord } from "@subx/core";
import { useState } from "react";
import { AudioButton } from "./AudioButton";
import { formatDuration, formatTime } from "./format";
import { TrashIcon } from "./icons";
import { hasDevanagari } from "./stats";
import { CopyButton, IconButton } from "./ui";

export function HistoryRow({ record }: { record: SessionRecord }) {
  const [open, setOpen] = useState(false);
  const changed = Boolean(record.rawText) && record.rawText !== record.finalText;

  async function remove() {
    if (window.confirm("Delete this recording? The audio file is removed from this computer.")) {
      await window.subx.history.remove(record.id);
    }
  }

  return (
    <li className="group py-3">
      <div className="flex items-center gap-3">
        <AudioButton id={record.id} />

        <div className="min-w-0 flex-1">
          {record.finalText ? (
            // Expands rather than linking away: the text is the thing, and it is already here.
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="block w-full text-left"
            >
              <p className={`voice-text text-[14px] ${open ? "" : "truncate"}`}>{record.finalText}</p>
            </button>
          ) : (
            <p className="truncate text-ink-soft">No text came back for this one.</p>
          )}

          <p className="figure-num mt-1 flex items-center gap-3 text-xs text-ink-faint">
            <span>{formatTime(record.createdAt)}</span>
            <span>{formatDuration(record.audioMs ?? 0)}</span>
            {record.context.appName && <span className="truncate">{record.context.appName}</span>}
            {record.rewriteError && (
              <span className="truncate font-medium text-accent-ink" title={record.rewriteError}>
                went in as heard
              </span>
            )}
          </p>
        </div>

        {/* Copy stays visible: it is the action people came to this list for. */}
        <CopyButton text={record.finalText} />
        <IconButton
          icon={TrashIcon}
          label="Delete recording"
          onClick={remove}
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>

      {open && changed && (
        <div className="mt-2.5 ml-11 border-l-2 border-rule-strong pl-3">
          <p className="mb-1 text-xs text-ink-faint">
            {hasDevanagari(record.rawText) ? "Heard in Devanagari" : "Heard as"}
          </p>
          <p className="spoken">{record.rawText}</p>
        </div>
      )}
    </li>
  );
}
