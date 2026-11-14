import { type AgentOutcome, Pipeline } from "@subx/core";
import { FakeInserter, FakeLlm, FakeStt, MemoryDictionary, MemoryHistory } from "@subx/core/fakes";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../shared/ipc";
import { createWorkflow, type WorkflowDeps } from "./workflow";

const clip = { samples: new Int16Array(16000), sampleRate: 16000 };

function build(opts: {
  spoken?: string;
  reply?: string;
  script?: AppSettings["script"];
  withPipeline?: boolean;
  problems?: string[];
  command?: (said: string) => Promise<AgentOutcome>;
}) {
  const inserter = new FakeInserter();
  const history = new MemoryHistory();
  const saved: string[] = [];
  const heard: string[] = [];
  let changes = 0;

  const pipeline =
    opts.withPipeline === false
      ? null
      : new Pipeline({
          stt: new FakeStt(opts.spoken ?? "hello world"),
          llm: new FakeLlm(opts.reply ?? "formatted"),
          inserter,
          history,
          dictionary: new MemoryDictionary([]),
        });

  const deps: WorkflowDeps = {
    pipeline,
    problems: opts.problems ?? [],
    settings: {
      all: async () => ({
        hotkey: "ctrl+win",
        commandHotkey: "ctrl+alt",
        script: opts.script ?? "roman",
        microphoneId: "",
        launchAtLogin: false,
        emailTone: "professional",
        messageTone: "casual",
      }),
    },
    context: { current: async () => ({ appName: "Notes" }) },
    history: {
      save: (record) => history.save(record),
      attachAudio: async (id, path) => {
        saved.push(`${id}:${path}`);
      },
    },
    saveRecording: async () => "/tmp/rec.wav",
    newId: () => "fixed-id",
    onHeard: (text) => heard.push(text),
    onHistoryChanged: () => {
      changes++;
    },
    command: opts.command,
  };

  return { workflow: createWorkflow(deps), inserter, history, saved, heard, changes: () => changes };
}

describe("createWorkflow in command mode", () => {
  it("carries out what was heard instead of typing it, and keeps nothing in history", async () => {
    const said: string[] = [];
    const { workflow, inserter, history, heard } = build({
      spoken: "volume आधा कर दो",
      command: async (text) => {
        said.push(text);
        return { message: "Volume set to 50%", ok: true, steps: ["Volume set to 50%"] };
      },
    });
    const run = await workflow.open("command");
    run.push(clip.samples);
    const { text } = await run.finish(clip);

    expect(said).toEqual(["volume आधा कर दो"]);
    expect(text).toBe("Volume set to 50%");
    expect(heard).toEqual(["volume आधा कर दो"]);
    expect(inserter.inserted).toEqual([]);
    expect(await history.recent(10)).toEqual([]);
  });

  it("shows a command that did nothing as a failure, not as success", async () => {
    const { workflow } = build({
      command: async () => ({ message: "That isn't something I can do", ok: false, steps: [] }),
    });
    const run = await workflow.open("command");
    run.push(clip.samples);
    await expect(run.finish(clip)).rejects.toThrow("That isn't something I can do");
  });

  it("refuses to listen for a command where commands cannot run", async () => {
    const { workflow } = build({});
    await expect(workflow.open("command")).rejects.toThrow("Commands aren't available on this computer");
  });
});

describe("createWorkflow", () => {
  it("runs the full chain and types the final text", async () => {
    const { workflow, inserter } = build({ spoken: "hi there", reply: "Hi there." });
    const run = await workflow.open("style");
    run.push(clip.samples);
    const { text: message } = await run.finish(clip);

    expect(inserter.inserted).toEqual(["Hi there."]);
    expect(message).toBe("Hi there.");
  });

  it("shows the raw words before the model has formatted them", async () => {
    const { workflow, heard } = build({ spoken: "मुझे कल जाना है", reply: "mujhe kal jaana hai" });
    const run = await workflow.open("exact");
    run.push(clip.samples);
    await run.finish(clip);

    expect(heard).toEqual(["मुझे कल जाना है"]);
  });

  it("saves audio to history after the text is typed", async () => {
    const { workflow, saved, history } = build({ spoken: "note this" });
    const run = await workflow.open("exact");
    await run.finish(clip);
    await Promise.resolve(); // let the fire-and-forget audio save settle

    expect(history.records).toHaveLength(1);
    expect(saved).toEqual([`${history.records[0]?.id}:/tmp/rec.wav`]);
  });

  it("reports silence without touching the cursor", async () => {
    const { workflow, inserter } = build({ spoken: "   " });
    const run = await workflow.open("exact");
    const { text: message } = await run.finish(clip);

    expect(message).toBe("Nothing heard");
    expect(inserter.inserted).toEqual([]);
  });

  // "write a mail to the team" used to surface `Command: email` and paste nothing at all. The
  // trigger is now a stated intent, so the written email is what lands at the cursor.
  it("writes an email when asked for one out loud", async () => {
    const { workflow, inserter } = build({ spoken: "write a mail to the team" });
    const run = await workflow.open("exact");
    await run.finish(clip);

    expect(inserter.inserted).toEqual(["formatted"]);
  });

  // No STT configured: the user must still get their audio back and a clear reason.
  it("keeps the recording and explains when speech-to-text is off", async () => {
    const { workflow, history, saved } = build({
      withPipeline: false,
      problems: ["Speech-to-text is off: GNANI_API_KEY is not set."],
    });
    const run = await workflow.open("exact");
    const { text: message } = await run.finish(clip);
    await Promise.resolve();

    expect(message).toBe("Speech-to-text is off: GNANI_API_KEY is not set.");
    expect(history.records).toHaveLength(1);
    expect(history.records[0]?.finalText).toBe("");
    expect(saved).toHaveLength(1);
  });

  it("drains the stream on cancel without typing", async () => {
    const { workflow, inserter } = build({ spoken: "discard me" });
    const run = await workflow.open("exact");
    run.push(clip.samples);
    run.cancel();
    await Promise.resolve();

    expect(inserter.inserted).toEqual([]);
  });
});
