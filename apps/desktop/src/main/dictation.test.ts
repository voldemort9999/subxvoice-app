import { afterEach, describe, expect, it, vi } from "vitest";
import type { PillState } from "../shared/ipc";
import { DictationController, type DictationEngine, type DictationRun } from "./dictation";
import type { MicSource } from "./mic";
import type { PillWindow } from "./pill";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeRun(text: string) {
  const run: DictationRun & { finished: boolean; cancelled: boolean } = {
    finished: false,
    cancelled: false,
    push: () => {},
    finish: async () => {
      run.finished = true;
      return { text };
    },
    cancel: () => {
      run.cancelled = true;
    },
  };
  return run;
}

describe("DictationController", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps a tap's late cancel away from the press that followed it", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const states: PillState[] = [];
    const pill = { revive: () => {}, setState: (state: PillState) => states.push(state), level: () => {} };
    const mic: MicSource = { start: async () => {}, stop: async () => {} };
    const opens: ((run: DictationRun) => void)[] = [];
    const engine: DictationEngine = { open: () => new Promise((resolve) => opens.push(resolve)) };
    const controller = new DictationController(pill as unknown as PillWindow, mic, engine);
    const [first, second] = [fakeRun("tap"), fakeRun("hello")];

    controller.handleHotkey({ type: "pressed", mode: "command" });
    now = 100; // a tap: released before MIN_HOLD_MS, so cancelled — and its cancel waits on the open
    controller.handleHotkey({ type: "released", mode: "command" });
    await settle();
    now = 200;
    controller.handleHotkey({ type: "pressed", mode: "command" });
    opens[1]?.(second);
    await settle();
    opens[0]?.(first); // the tap's stream opens last, and its cancel wakes up
    await settle();
    now = 2000;
    controller.handleHotkey({ type: "released", mode: "command" });
    await settle();

    expect(first.cancelled).toBe(true);
    expect(second.finished).toBe(true);
    expect(states.at(-1)).toEqual({ kind: "done", message: "hello", warning: undefined });
    // Not stuck: the next press opens a new stream.
    controller.handleHotkey({ type: "pressed", mode: "command" });
    expect(opens).toHaveLength(3);
  });

  it("never leaves processing when a release finds no stream", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const states: PillState[] = [];
    const pill = { revive: () => {}, setState: (state: PillState) => states.push(state), level: () => {} };
    const mic: MicSource = { start: async () => {}, stop: async () => {} };
    const engine: DictationEngine = { open: async () => fakeRun("x") };
    const controller = new DictationController(pill as unknown as PillWindow, mic, engine);
    controller.handleHotkey({ type: "pressed", mode: "exact" });
    await settle();
    // Something cleared the run behind the controller's back; the release must still end the run.
    (controller as unknown as { run: null }).run = null;
    now = 1000;
    controller.handleHotkey({ type: "released", mode: "exact" });
    await settle();
    expect(states.at(-1)).toEqual({ kind: "error", message: "Couldn't start listening — try again" });
  });
});
