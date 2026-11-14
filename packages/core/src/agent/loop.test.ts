import { describe, expect, it } from "vitest";
import type { DeciderProvider, DecisionRequest } from "../contracts/decider";
import type { LlmProvider, LlmRequest } from "../contracts/llm";
import { menu, parseArgs, runCommand } from "./loop";
import { AgentMemory } from "./memory";
import type { ActionSource, AgentAction } from "./types";

/** Answers with a scripted sequence of choices, and keeps every request it was asked. */
function decider(...choices: [string, number?][]): DeciderProvider & { asked: DecisionRequest[] } {
  const asked: DecisionRequest[] = [];
  return {
    id: "fake",
    asked,
    async decide(request) {
      asked.push(request);
      const [choice, confidence = 0.97] = choices[asked.length - 1] ?? ["done"];
      return { choice, confidence };
    },
  };
}

function writer(...replies: string[]): LlmProvider & { asked: LlmRequest[] } {
  const asked: LlmRequest[] = [];
  return {
    id: "fake",
    asked,
    async complete(request) {
      asked.push(request);
      return { text: replies[asked.length - 1] ?? "{}", toolCalls: [] };
    },
  };
}

function source(actions: AgentAction[], facts: string[] = []): ActionSource {
  return { observe: async () => facts, actions: async () => actions };
}

function action(
  id: string,
  extra: Partial<AgentAction> = {},
): AgentAction & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  return {
    id,
    describe: `Do ${id}`,
    calls,
    run: async (args) => {
      calls.push(args);
      return { did: `Did ${id}` };
    },
    ...extra,
  };
}

/** The writer's first reply is always the plan. */
const plan = (...steps: string[]) => JSON.stringify({ steps });

describe("runCommand", () => {
  it("runs the chosen action with the details the writer filled in", async () => {
    const volume = action("set_volume", { args: '{"level": number}' });
    const outcome = await runCommand("volume aadha kar do", {
      decider: decider(["set_volume"]),
      writer: writer(plan("Set the volume to 50%"), '{"level": 50}'),
      sources: [source([volume])],
      memory: new AgentMemory(),
    });
    expect(volume.calls).toEqual([{ level: 50 }]);
    expect(outcome).toEqual({ message: "Did set_volume", ok: true, steps: ["Did set_volume"] });
  });

  it("does a one-step request once, however the decider would have carried on", async () => {
    // From real use: "hai type karo" typed it six times when the loop asked "anything more?".
    const type = action("type_text", { args: '{"text": string}' });
    const decide = decider(["type_text"], ["type_text"], ["type_text"]);
    await runCommand("hai type karo", {
      decider: decide,
      writer: writer(plan("Type 'hai'"), '{"text":"hai"}'),
      sources: [source([type])],
      memory: new AgentMemory(),
    });
    expect(type.calls).toEqual([{ text: "hai" }]);
    expect(decide.asked).toHaveLength(1);
  });

  it("drops a step the plan repeats", async () => {
    // From real use: an email request planned [type X, Enter, Enter, type X] and typed X twice.
    const type = action("type_text", { args: '{"text": string}' });
    const keys = action("press_keys", { args: '{"keys": string}' });
    await runCommand("email likho aur enter dabao", {
      decider: decider(["type_text"], ["press_keys"]),
      writer: writer(
        plan("Type 'hi'", "Press Enter", "Press Enter", "type 'hi'"),
        '{"text":"hi"}',
        '{"keys":"enter"}',
      ),
      sources: [source([type, keys])],
      memory: new AgentMemory(),
    });
    expect(type.calls).toEqual([{ text: "hi" }]);
    expect(keys.calls).toEqual([{ keys: "enter" }]);
  });

  it("asks the writer a second time when the provider errors once", async () => {
    let calls = 0;
    const flaky: LlmProvider = {
      id: "flaky",
      async complete() {
        calls++;
        if (calls === 1) throw new Error("OpenRouter: Provider returned error");
        return { text: plan("Mute"), toolCalls: [] };
      },
    };
    const mute = action("mute");
    const outcome = await runCommand("mute", {
      decider: decider(["mute"]),
      writer: flaky,
      sources: [source([mute])],
      memory: new AgentMemory(),
    });
    expect(outcome.ok).toBe(true);
    expect(mute.calls).toHaveLength(1);
  });

  it("skips the details call for an action that needs none", async () => {
    const write = writer(plan("Mute"));
    await runCommand("mute karo", {
      decider: decider(["mute"]),
      writer: write,
      sources: [source([action("mute")])],
      memory: new AgentMemory(),
    });
    expect(write.asked).toHaveLength(1); // the plan only
  });

  it("runs every planned step in order, telling the decider what is already done", async () => {
    const open = action("open_app", { args: '{"name": string}' });
    const type = action("type_text", { args: '{"text": string}' });
    const decide = decider(["open_app"], ["type_text"]);
    const outcome = await runCommand("Notepad kholo aur usme likho hello", {
      decider: decide,
      writer: writer(
        plan("Open Notepad", "Type 'hello' in Notepad"),
        '{"name":"Notepad"}',
        '{"text":"hello"}',
      ),
      sources: [source([open, type])],
      memory: new AgentMemory(),
    });
    expect(outcome).toEqual({
      message: "Did open_app · Did type_text",
      ok: true,
      steps: ["Did open_app", "Did type_text"],
    });
    expect(decide.asked[1]?.state).toContain("Already done for this request: Did open_app");
    expect(decide.asked[1]?.state).toContain("This step: Type 'hello' in Notepad");
  });

  it("shows the planner the capabilities, including the ones not available yet", async () => {
    const write = writer(plan());
    await runCommand("x", {
      decider: decider(),
      writer: write,
      sources: [source([action("set_volume"), action("screen_action", { available: false })])],
      memory: new AgentMemory(),
    });
    const content = write.asked[0]?.messages[0]?.content ?? "";
    expect(content).toContain("- Do set_volume");
    expect(content).toContain("- Do screen_action (not available yet)");
  });

  it("says plainly when nothing was asked for, without asking the decider", async () => {
    const decide = decider();
    const outcome = await runCommand("hello kaise ho", {
      decider: decide,
      writer: writer(plan()),
      sources: [source([action("set_volume")])],
      memory: new AgentMemory(),
    });
    expect(outcome).toMatchObject({ ok: false, message: "That isn't something I can do" });
    expect(decide.asked).toHaveLength(0);
  });

  it("refuses an unavailable action with its own reason, instead of running it", async () => {
    const click = action("screen_action", {
      available: false,
      unavailable: "That needs screen control, which isn't switched on yet",
    });
    const outcome = await runCommand("second wala video chalao", {
      decider: decider(["screen_action"]),
      writer: writer(plan("Play the second video")),
      sources: [source([click])],
      memory: new AgentMemory(),
    });
    expect(click.calls).toHaveLength(0);
    expect(outcome).toMatchObject({
      ok: false,
      message: "That needs screen control, which isn't switched on yet",
    });
  });

  it("offers nothing_fits on every step, and an unavailable action marked as such", () => {
    const criteria = menu([action("screen_action", { available: false }), action("set_volume")]);
    expect(criteria.screen_action).toMatch(/NOT AVAILABLE YET$/);
    expect(criteria.set_volume).toBe("Do set_volume");
    expect(criteria.nothing_fits).toBeTruthy();
    expect(criteria).not.toHaveProperty("done");
  });

  it("says which step it cannot do when nothing fits", async () => {
    const outcome = await runCommand("computer band karo", {
      decider: decider(["nothing_fits"]),
      writer: writer(plan("Shut down the computer")),
      sources: [source([action("set_volume")])],
      memory: new AgentMemory(),
    });
    expect(outcome).toMatchObject({ ok: false, message: "I can't do that yet: Shut down the computer" });
  });

  it("does nothing on a low-confidence guess", async () => {
    const volume = action("set_volume");
    const outcome = await runCommand("hmm", {
      decider: decider(["set_volume", 0.4]),
      writer: writer(plan("Change the volume")),
      sources: [source([volume])],
      memory: new AgentMemory(),
    });
    expect(volume.calls).toHaveLength(0);
    expect(outcome).toMatchObject({ ok: false, message: "Didn't catch that — try again" });
  });

  it("asks for more certainty before an action that loses work", async () => {
    const kill = action("kill_process", { risky: true });
    await runCommand("chrome band karo", {
      decider: decider(["kill_process", 0.6]),
      writer: writer(plan("Stop Chrome")),
      sources: [source([kill])],
      memory: new AgentMemory(),
    });
    expect(kill.calls).toHaveLength(0);
  });

  it("refuses to act on details it could not read", async () => {
    const volume = action("set_volume", { args: '{"level": number}' });
    const outcome = await runCommand("volume kuch karo", {
      decider: decider(["set_volume"]),
      writer: writer(plan("Change the volume"), "I think about fifty percent"),
      sources: [source([volume])],
      memory: new AgentMemory(),
    });
    expect(volume.calls).toHaveLength(0);
    expect(outcome.ok).toBe(false);
  });

  it("reports an action's own failure as the message", async () => {
    const bt = action("bluetooth", {
      run: async () => {
        throw new Error("No Bluetooth radio on this computer");
      },
    });
    const outcome = await runCommand("bluetooth off karo", {
      decider: decider(["bluetooth"]),
      writer: writer(plan("Turn Bluetooth off")),
      sources: [source([bt])],
      memory: new AgentMemory(),
    });
    expect(outcome).toEqual({ message: "No Bluetooth radio on this computer", ok: false, steps: [] });
  });

  it("keeps what was done when a later step fails", async () => {
    const open = action("open_app");
    const broken = action("type_text", {
      run: async () => {
        throw new Error("Windows refused the paste");
      },
    });
    const outcome = await runCommand("Notepad kholo aur hi likho", {
      decider: decider(["open_app"], ["type_text"]),
      writer: writer(plan("Open Notepad", "Type 'hi'")),
      sources: [source([open, broken])],
      memory: new AgentMemory(),
    });
    expect(outcome).toEqual({
      message: "Did open_app · then: Windows refused the paste",
      ok: true,
      steps: ["Did open_app"],
    });
  });

  it("ends on an answer", async () => {
    const outcome = await runCommand("battery kitni hai", {
      decider: decider(["battery"]),
      writer: writer(plan("Tell the battery level")),
      sources: [
        source([action("battery", { run: async () => ({ did: "Read the battery", answer: "78% left" }) })]),
      ],
      memory: new AgentMemory(),
    });
    expect(outcome.message).toBe("78% left");
  });

  it("caps a plan that is too long to be one command", async () => {
    const volume = action("set_volume");
    await runCommand("volume", {
      decider: decider(...Array.from({ length: 20 }, () => ["set_volume"] as [string])),
      writer: writer(plan(...Array.from({ length: 20 }, (_, i) => `Step ${i}`))),
      sources: [source([volume])],
      memory: new AgentMemory(),
    });
    expect(volume.calls.length).toBeLessThanOrEqual(6);
  });

  it("gives the planner what was just done, so 'usme' can be understood", async () => {
    const memory = new AgentMemory();
    await runCommand("Notepad kholo", {
      decider: decider(["open_app"]),
      writer: writer(plan("Open Notepad")),
      sources: [source([action("open_app")])],
      memory,
    });
    const write = writer(plan());
    await runCommand("ab usme likho", { decider: decider(), writer: write, sources: [source([])], memory });
    expect(write.asked[0]?.messages[0]?.content).toMatch(/Earlier \(just now\) this was done: Did open_app/);
  });

  it("gives the writer an action's own facts, and keeps them away from the decider", async () => {
    const write = writer(plan("Close Notepad"), '{"close":["Notepad"]}');
    const decide = decider(["close_windows"]);
    const close = action("close_windows", {
      args: '{"close": string[]}',
      facts: async () => ["Open windows: Notepad; Chrome"],
    });
    await runCommand("Notepad band karo", {
      decider: decide,
      writer: write,
      sources: [source([close])],
      memory: new AgentMemory(),
    });
    expect(write.asked[1]?.messages[0]?.content).toContain("Open windows: Notepad; Chrome");
    expect(decide.asked.flatMap((request) => request.state).join("\n")).not.toContain("Open windows");
    expect(close.calls).toEqual([{ close: ["Notepad"] }]);
  });

  it("says so when the planner's reply cannot be read", async () => {
    const outcome = await runCommand("x", {
      decider: decider(),
      writer: writer("sure, here you go"),
      sources: [source([])],
      memory: new AgentMemory(),
    });
    expect(outcome).toMatchObject({ ok: false, message: "Didn't catch that — try again" });
  });

  it("says the connection failed when a model cannot be reached, rather than throwing", async () => {
    const offline: LlmProvider = {
      id: "offline",
      complete: async () => {
        throw new Error("fetch failed");
      },
    };
    const outcome = await runCommand("x", {
      decider: decider(),
      writer: offline,
      sources: [source([])],
      memory: new AgentMemory(),
    });
    expect(outcome).toMatchObject({
      ok: false,
      message: "Couldn't reach the assistant — check the connection",
    });
  });

  it("carries on without a source that fails", async () => {
    const broken: ActionSource = {
      observe: async () => {
        throw new Error("UI Automation unavailable");
      },
      actions: async () => [],
    };
    const outcome = await runCommand("mute", {
      decider: decider(["set_volume"]),
      writer: writer(plan("Mute")),
      sources: [broken, source([action("set_volume")], ["Volume: 40%"])],
      memory: new AgentMemory(),
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("parseArgs", () => {
  it("reads plain JSON", () => {
    expect(parseArgs('{"level": 50}', "set_volume")).toEqual({ level: 50 });
  });

  it("unwraps fields wrapped in the action's own name", () => {
    expect(parseArgs('{"set_volume":{"level":50}}', "set_volume")).toEqual({ level: 50 });
  });

  it("leaves a single field that merely shares nothing with the action name alone", () => {
    expect(parseArgs('{"url":"https://mail.google.com"}', "open_web")).toEqual({
      url: "https://mail.google.com",
    });
  });

  it("strips a code fence", () => {
    expect(parseArgs('```json\n{"name":"Notepad"}\n```', "open_app")).toEqual({ name: "Notepad" });
  });

  it("puts a bare list under the action's one field, when it has exactly one", () => {
    expect(parseArgs('["Notepad","Spotify"]', "close_windows", '{"close": string[]}')).toEqual({
      close: ["Notepad", "Spotify"],
    });
  });

  it("refuses a bare list when the action has several fields it could belong to", () => {
    expect(parseArgs('["a"]', "x", '{"close": string[], "keep": string[]}')).toBeNull();
  });

  it("reads a complete object and ignores junk after it — gemini's real reply", () => {
    const reply = '{"url": "https://www.youtube.com/results?search_query=Kesariya+song"}\n"}';
    expect(parseArgs(reply, "open_web")).toEqual({
      url: "https://www.youtube.com/results?search_query=Kesariya+song",
    });
  });

  it("does not let a bracket inside a string end the object early", () => {
    expect(parseArgs('{"text":"done } really"} trailing', "type_text")).toEqual({ text: "done } really" });
  });

  it("refuses an object that never closes", () => {
    expect(parseArgs('{"level": 50', "set_volume")).toBeNull();
  });

  it("refuses anything that is not an object", () => {
    expect(parseArgs("", "x")).toBeNull();
    expect(parseArgs("[1,2]", "x")).toBeNull();
    expect(parseArgs("fifty", "x")).toBeNull();
  });
});

describe("AgentMemory", () => {
  it("forgets what is older than its window", () => {
    let now = 0;
    const memory = new AgentMemory({ ttlMs: 10 * 60_000, now: () => now });
    memory.remember("Chrome kholo", ["Opened Chrome"]);
    now = 11 * 60_000;
    expect(memory.recall()).toEqual([]);
  });

  it("keeps only the latest few", () => {
    const memory = new AgentMemory({ limit: 2 });
    memory.remember("a", ["A"]);
    memory.remember("b", ["B"]);
    memory.remember("c", ["C"]);
    expect(memory.recall().join(" ")).not.toMatch(/"a"/);
    expect(memory.recall()).toHaveLength(2);
  });

  it("does not remember a command that did nothing", () => {
    const memory = new AgentMemory();
    memory.remember("hmm", []);
    expect(memory.recall()).toEqual([]);
  });
});

describe("holdBackSending", () => {
  it("drops a send or Enter after typing a message", async () => {
    const { holdBackSending } = await import("./loop");
    expect(
      holdBackSending(
        ["Type hi into the message box in WhatsApp", "Press Enter in WhatsApp"],
        "Aarnav को hi भेजो",
      ),
    ).toEqual(["Type hi into the message box in WhatsApp"]);
    expect(holdBackSending(["Type hi", "Click the Send button"], "hi type karke send karo")).toEqual([
      "Type hi",
    ]);
  });

  it("keeps an Enter the user asked for, and a send that is the whole request", async () => {
    const { holdBackSending } = await import("./loop");
    expect(
      holdBackSending(["Type 'What is weather'", "Press Enter"], "What is weather type करो और enter मारो"),
    ).toHaveLength(2);
    expect(holdBackSending(["Send the typed message"], "ab send kar do")).toEqual(["Send the typed message"]);
  });
});

describe("repairSteps", () => {
  it("reads a plan whose JSON broke on a quote inside a step — gemini's real reply", async () => {
    const { repairSteps } = await import("./loop");
    expect(repairSteps('{"steps": ["Play on YouTube "motor वाला""]}')).toEqual([
      'Play on YouTube "motor वाला"',
    ]);
    expect(repairSteps('{"steps": ["Open WhatsApp", "Type "hi""]}')).toEqual(["Open WhatsApp", 'Type "hi"']);
    expect(repairSteps("no plan here")).toBeNull();
  });
});

describe("second opinion on the action", () => {
  const unsure = (choice: string, probabilities: Record<string, number>): DeciderProvider => ({
    id: "unsure",
    decide: async () => ({ choice, confidence: probabilities[choice] ?? 0, probabilities }),
  });

  it("acts when the writer picks one of Jev's top two — open_web 0.42 against screen_type 0.41", async () => {
    const web = action("open_web", { args: '{"url": string}' });
    const outcome = await runCommand("MCU portal search karo", {
      decider: unsure("open_web", { open_web: 0.42, screen_type: 0.41, type_text: 0.1 }),
      writer: writer(
        plan("Search YouTube for MCU portal"),
        "open_web",
        '{"url":"https://www.youtube.com/results?search_query=MCU+portal"}',
      ),
      sources: [source([web, action("screen_type"), action("type_text")])],
      memory: new AgentMemory(),
    });
    expect(outcome.ok).toBe(true);
    expect(web.calls).toHaveLength(1);
  });

  it("never lets the writer start a risky action Jev was unsure of", async () => {
    const kill = action("kill_process", { risky: true });
    const outcome = await runCommand("band karo", {
      decider: unsure("kill_process", { kill_process: 0.5, close_windows: 0.4 }),
      writer: writer(plan("Stop Chrome"), "kill_process"),
      sources: [source([kill, action("close_windows", { risky: true })])],
      memory: new AgentMemory(),
    });
    expect(outcome.ok).toBe(false);
    expect(kill.calls).toHaveLength(0);
  });

  it("does a risky action Jev chose at 0.69 when the writer chooses it too", async () => {
    const close = action("close_windows", { risky: true, args: '{"close": string[]}' });
    const outcome = await runCommand("Notepad band karo", {
      decider: unsure("close_windows", { close_windows: 0.69, nothing_fits: 0.12, press_keys: 0.1 }),
      writer: writer(plan("Close the window Notepad"), "close_windows", '{"close":["Notepad"]}'),
      sources: [source([close, action("press_keys")])],
      memory: new AgentMemory(),
    });
    expect(outcome.ok).toBe(true);
    expect(close.calls).toHaveLength(1);
  });
});

describe("continuing", () => {
  it("offers the last command as the place to carry on, only while it is recent", () => {
    let now = 0;
    const memory = new AgentMemory({ now: () => now });
    memory.remember("YouTube kholo", ["Opened youtube.com"]);
    now = 60_000;
    expect(memory.continuing()).toEqual({ seconds: 60, did: ["Opened youtube.com"] });
    now = 4 * 60_000;
    expect(memory.continuing()).toBeNull();
  });

  it("tells the planner where the user is carrying on from", async () => {
    const memory = new AgentMemory();
    memory.remember("YouTube pe kesariya search karo", ['Searched youtube.com for "kesariya"']);
    const write = writer(plan());
    await runCommand("first wala chalao", {
      decider: decider(),
      writer: write,
      sources: [source([])],
      memory,
    });
    expect(write.asked[0]?.messages[0]?.content).toMatch(
      /Continuing: the last command, \d+ s ago, did: Searched youtube\.com/,
    );
  });
});
