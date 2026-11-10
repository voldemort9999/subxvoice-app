import { useEffect, useMemo, useState } from "react";
import type { PillState } from "../../../shared/ipc";
import { hotkeyLabel } from "../shared/format";
import { useAppInfo } from "../shared/hooks";
import { MicIcon } from "../shared/icons";
import { MicRecorder } from "./recorder";

const BAR_COUNT = 12;
const silence = () => Array<number>(BAR_COUNT).fill(0);

const SHAPE: Record<PillState["kind"], string> = {
  idle: "h-7 px-2.5",
  listening: "h-8 w-32",
  processing: "h-8 px-4",
  done: "h-8 px-4",
  error: "h-8 px-4",
};

export function Pill() {
  const [state, setState] = useState<PillState>({ kind: "idle" });
  const [hover, setHover] = useState(false);
  const [levels, setLevels] = useState(silence);
  const info = useAppInfo();
  // Only used when the OS has no native microphone plug (the main process sends mic commands).
  const recorder = useMemo(() => new MicRecorder(), []);

  useEffect(
    () =>
      window.subx.pill.onState((next) => {
        if (next.kind === "listening") setLevels(silence());
        setState(next);
      }),
    [],
  );
  useEffect(
    () => window.subx.pill.onLevel((level) => setLevels((previous) => [...previous.slice(1), level])),
    [],
  );
  useEffect(
    () =>
      window.subx.pill.onMicCommand((command) => {
        if (command === "start") void recorder.start();
        else recorder.stop();
      }),
    [recorder],
  );

  function hoverChanged(inside: boolean) {
    setHover(inside);
    window.subx.pill.hover(inside);
  }

  return (
    <div className="flex h-screen items-end justify-center pb-2">
      <button
        type="button"
        onMouseEnter={() => hoverChanged(true)}
        onMouseLeave={() => hoverChanged(false)}
        onClick={() => window.subx.pill.click()}
        aria-label="Open SUBXVoice"
        className={`flex max-w-[232px] items-center justify-center gap-1.5 rounded-full border border-silver/15 bg-plate text-silver shadow-[0_4px_14px_rgb(20_4_18/45%)] transition-all duration-200 ${SHAPE[state.kind]}`}
      >
        {state.kind === "idle" && (
          <>
            <MicIcon className={`h-3.5 w-3.5 ${hover ? "text-marigold" : "text-silver/75"}`} />
            {hover && (
              <span className="text-xs font-medium whitespace-nowrap">
                Hold {hotkeyLabel(info?.hotkeys[0]?.keys)}
              </span>
            )}
          </>
        )}
        {state.kind === "listening" && <Waveform levels={levels} />}
        {state.kind === "processing" &&
          (state.message ? (
            // The words as heard, so there is something to read while the model works.
            <span className="truncate font-mono text-xs text-silver/70">{state.message}</span>
          ) : (
            <Dots />
          ))}
        {state.kind === "done" && (
          <span className="flex min-w-0 items-center gap-1.5">
            {/* The words still went in; the dot says they are not in the script that was asked for. */}
            {state.warning && (
              <span role="img" aria-label={state.warning} title={state.warning}>
                <span className="block h-1.5 w-1.5 rounded-full bg-marigold" />
              </span>
            )}
            <span className="truncate text-xs font-medium text-silver">{state.message}</span>
          </span>
        )}
        {/* No red in the palette; on Aubergine, Marigold type is legible and reads as "look at this". */}
        {state.kind === "error" && (
          <span className="truncate text-xs font-medium text-marigold">{state.message}</span>
        )}
      </button>
    </div>
  );
}

/** Levels scroll in from the right, so the newest bar — the sound right now — carries the Marigold. */
function Waveform({ levels }: { levels: number[] }) {
  const newest = levels.length - 1;
  return (
    <div className="flex h-5 items-center gap-[3px]">
      {levels.map((level, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
          key={index}
          className={`w-[3px] rounded-full transition-[height] duration-75 ${
            index === newest ? "bg-marigold" : "bg-silver"
          }`}
          style={{ height: `${3 + Math.min(1, level * 8) * 17}px` }}
        />
      ))}
    </div>
  );
}

function Dots() {
  return (
    <div className="flex gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-silver"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}
