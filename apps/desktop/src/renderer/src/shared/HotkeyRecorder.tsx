import { useEffect, useState } from "react";
import { hotkeyLabel } from "./format";
import { comboFrom } from "./hotkeys";
import { Button } from "./ui";

/**
 * Records whatever the user holds down and saves it as the dictation hotkey. Listening happens on
 * the window during capture, so a chord reaches us before the focused control reacts to it.
 */
export function HotkeyRecorder({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: string[];
  onChange: (keys: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;

    const stop = () => {
      setRecording(false);
      setPending(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Nothing pressed while recording should reach the app — Tab would move focus, Space would
      // press the button that started the recording.
      event.preventDefault();
      if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) {
        stop();
        return;
      }
      setPending(comboFrom(event));
    };

    // Committing on release is what makes it hold-to-talk: the chord is whatever was down at its
    // fullest, and letting go is how the user says they mean it.
    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      setPending((current) => {
        if (current) {
          onChange(current);
          setRecording(false);
        }
        return current;
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", stop);
    };
  }, [recording, onChange]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <kbd
          className={`kbd min-w-[140px] py-1.5 text-center text-[13px] transition-colors ${
            recording ? "border-marigold bg-marigold text-on-marigold" : ""
          }`}
        >
          {recording ? (pending ? hotkeyLabel(pending) : "Press keys…") : hotkeyLabel(value)}
        </kbd>
        {recording ? (
          <Button onClick={() => setRecording(false)}>Cancel</Button>
        ) : (
          <Button variant="primary" onClick={() => setRecording(true)}>
            Change
          </Button>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-faint">
        {recording
          ? "Hold the keys you want, then let go. Esc to cancel."
          : "Any combination of two or more keys."}
      </p>

      {/* Windows swallows the Windows key on its own, so the common chords stay one click away. */}
      {!recording && presets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {presets.map((keys) => (
            <button
              key={keys}
              type="button"
              onClick={() => onChange(keys)}
              aria-pressed={keys === value}
              className={`rounded-[3px] border px-2 py-0.5 font-mono text-xs transition-colors ${
                keys === value
                  ? "border-ink bg-ink text-page"
                  : "border-rule-strong text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {hotkeyLabel(keys)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
