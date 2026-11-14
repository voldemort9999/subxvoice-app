import { spawn } from "node:child_process";
import {
  type ActionSource,
  AgentMemory,
  type DeciderProvider,
  type LlmProvider,
  runCommand,
  type ScreenDriver,
  type ScreenSnapshot,
  screenSource,
} from "@subx/core";
import { createDecider, createLlm } from "@subx/providers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WinCommandSource } from "../../../../packages/platform-win/src/commands";
import { DECISIONS_URL, LLM_URL } from "./auth";

/**
 * Command mode end to end on this machine, minus the microphone: real Jev, the real command
 * writer, real Windows actions. Opt-in — LIVE=1 and SUBX_TOKEN (a Supabase session) — because it
 * spends model calls and opens Notepad. Typing, URLs, key presses, radios and screen clicks are
 * recorded, not performed, so it cannot open browser tabs, type into whatever is focused, mark a
 * chat read or cut the network — except the YouTube test, which opens its own muted results tab and
 * really clicks a video. Commands are given the way Gnani returns them: Hindi in Devanagari,
 * English in Latin.
 */
const token = process.env.SUBX_TOKEN ?? "";
const live = process.env.LIVE === "1" && process.platform === "win32" && !!token;

describe.skipIf(!live)("command mode end to end", () => {
  const typed: string[] = [];
  const opened: string[] = [];
  const source = new WinCommandSource({
    inserter: { insert: async (text) => void typed.push(text) },
    // Recorded unless a test opens real tabs: "chalao" is checked by playing a video for real.
    openUrl: async (url) => {
      opened.push(url);
      if (realUrls) spawn("cmd.exe", ["/c", "start", "", url], { detached: true }).unref();
    },
  });
  afterAll(() => source.dispose());

  /** Actions with effects outside Notepad, run as a record of what they would have been given. */
  const recorded: { id: string; args: Record<string, unknown> }[] = [];
  // Closing and stopping are recorded too: a test must never close the user's own Chrome. Opening
  // is real only for Notepad, which the tests close again.
  const DRY = new Set([
    "press_keys",
    "bluetooth",
    "wifi",
    "close_windows",
    "kill_process",
    "screenshot",
    "find_files",
    "copy_files",
    "make_folder",
    "open_folder",
    // Real, it would open a friend's chat and mark it read; the real flow runs on the user's own
    // chat in whatsapp.live.test.ts.
    "whatsapp_message",
  ]);
  const dry = (id: string, args: Record<string, unknown>) =>
    DRY.has(id) || (id === "open_app" && !/notepad/i.test(String(args.name)));
  const safe: ActionSource = {
    observe: () => source.observe(),
    actions: async () =>
      (await source.actions()).map((action) =>
        DRY.has(action.id) || action.id === "open_app"
          ? {
              ...action,
              run: async (args, context) => {
                if (!dry(action.id, args)) return action.run(args, context);
                recorded.push({ id: action.id, args });
                // Worded like the real result, which the next step's decider reads.
                return {
                  did: action.id === "open_app" ? `Opened ${String(args.name)}` : `(recorded ${action.id})`,
                };
              },
            }
          : action,
      ),
  };

  // Built only in a live run: a skipped describe still runs its body, and Jev refuses no token.
  let decider: DeciderProvider;
  let writer: LlmProvider;
  beforeAll(() => {
    decider = createDecider({ id: "jev", token, baseUrl: DECISIONS_URL });
    writer = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      model: process.env.WRITER_MODEL || "google/gemini-2.5-flash",
      reasoning: false,
      timeoutMs: 8000,
    });
  });
  // The screen is read for real and boxes are focused for real (the text goes to `typed`), but a
  // click is only recorded unless a test allows it: clicking a WhatsApp chat marks it read.
  let realClicks = false;
  let realUrls = false;
  let seen: ScreenSnapshot | null = null;
  const clicked: string[] = [];
  const screen: ScreenDriver = {
    read: async (hint) => {
      seen = await source.screen.read(hint);
      return seen;
    },
    click: async (id) => {
      clicked.push(seen?.elements.find((element) => element.id === id)?.name ?? `#${id}`);
      if (realClicks) await source.screen.click(id);
    },
    // Recorded, not performed: the driver reads the box back after typing, and a recording never
    // lands in it. The real typing is exercised by the WhatsApp self-chat test below.
    typeInto: async (_id, text) => void typed.push(text),
  };

  const memory = new AgentMemory();
  const command = async (said: string) => {
    const started = performance.now();
    const outcome = await runCommand(said, {
      decider,
      writer,
      sources: [safe, screenSource(screen, decider, writer, (line) => console.log(`    ${line}`))],
      memory,
      log: (line) => console.log(`    ${line}`),
    });
    console.log(`  "${said}" → ${outcome.message} (${Math.round(performance.now() - started)} ms)`);
    return outcome;
  };

  it("plays a song on YouTube: searches it, then really clicks the 1st result", async () => {
    const volume = (await source.actions()).find((action) => action.id === "set_volume");
    const [now] = (await volume?.facts?.()) ?? [""];
    await volume?.run({ mute: true });
    realClicks = true;
    realUrls = true;
    try {
      const outcome = await command("YouTube पे Kesariya song चलाओ");
      expect(opened.at(-1)).toMatch(/youtube\.com\/results\?search_query=Kesariya/i);
      expect(outcome.message).toMatch(/Clicked .+ in .*youtube/i);
    } finally {
      realClicks = false;
      realUrls = false;
      await (await source.actions()).find((action) => action.id === "press_keys")?.run({ keys: "ctrl+w" });
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!/muted/.test(now ?? "")) await volume?.run({ mute: false });
    }
  }, 90_000);

  it("carries on where the last command left off, without the user naming YouTube again", async () => {
    // The results open for real (the step has to find YouTube on screen); the click is recorded.
    realUrls = true;
    try {
      await command("YouTube पे Kesariya search करो");
      expect(opened.at(-1)).toMatch(/youtube\.com\/results/i);
      const clicks = clicked.length;
      await command("first वाला चलाओ");
      expect(clicked.length).toBe(clicks + 1);
    } finally {
      realUrls = false;
      await (await source.actions()).find((action) => action.id === "press_keys")?.run({ keys: "ctrl+w" });
    }
  }, 90_000);

  it("opens Notepad, then types into it on the next command — memory carries 'usmein'", async () => {
    expect((await command("Notepad खोलो")).message).toBe("Opened Notepad");
    const outcome = await command("उसमें लिखो कल की meeting ग्यारह बजे है");
    expect(outcome.ok).toBe(true);
    expect(typed.at(-1)).toBe("kal ki meeting gyarah baje hai");
    // Leave the machine as it was found.
    const close = (await source.actions()).find((action) => action.id === "close_windows");
    const [list] = (await close?.facts?.()) ?? [""];
    const title = list
      ?.replace(/^Open windows: /, "")
      .split("; ")
      .find((window) => /notepad/i.test(window));
    if (title) await close?.run({ close: [title] });
  }, 60_000);

  it("does a one-step request once — the first loop typed 'hai' six times", async () => {
    const before = typed.length;
    expect((await command("है type करो")).ok).toBe(true);
    expect(typed.slice(before)).toEqual(["hai"]);
  }, 60_000);

  it("types again when asked again, even right after typing the same thing", async () => {
    const before = typed.length;
    await command("hi लिखो");
    await command("Hi लिखो");
    expect(typed.slice(before).map((words) => words.toLowerCase())).toEqual(["hi", "hi"]);
  }, 60_000);

  it("minimizes the window it is told to, rather than closing it", async () => {
    expect((await command("Notepad खोलो")).message).toBe("Opened Notepad");
    const outcome = await command("Notepad को minimize कर दो");
    expect(outcome.message).toMatch(/^Minimized .*Notepad/);
    const close = (await source.actions()).find((action) => action.id === "close_windows");
    const [list] = (await close?.facts?.()) ?? [""];
    const title = list
      ?.replace(/^Open windows: /, "")
      .split("; ")
      .find((window) => /notepad/i.test(window));
    if (title) await close?.run({ close: [title] });
  }, 60_000);

  it("presses a shortcut for paste, however it is said", async () => {
    for (const said of ["Control+V दबाओ", "paste कर दो"]) {
      await command(said);
      expect(recorded.at(-1)).toMatchObject({ id: "press_keys" });
      expect(String(recorded.at(-1)?.args.keys).toLowerCase().replace(/\s/g, "")).toBe("ctrl+v");
    }
  }, 60_000);

  it("reads the brightness instead of calling it screen control", async () => {
    const outcome = await command("brightness कितनी है");
    expect(outcome.message).toMatch(/^Brightness is \d+%$/);
  }, 60_000);

  it("turns Bluetooth off", async () => {
    await command("Bluetooth off कर दो");
    expect(recorded.at(-1)).toEqual({ id: "bluetooth", args: { turn: "off" } });
  }, 60_000);

  const last = () => recorded.at(-1);

  it("opens the installed app a misheard name sounds like, not a web search", async () => {
    const before = opened.length;
    await command("cloud app खोलो");
    expect(last()).toEqual({ id: "open_app", args: { name: "Claude" } });
    expect(opened.length).toBe(before);
  }, 60_000);

  it("opens the BlueStacks app the extra words describe", async () => {
    await command("BlueStacks का instance manager खोलो");
    expect(last()).toEqual({ id: "open_app", args: { name: "BlueStacks Multi-Instance Manager" } });
  }, 60_000);

  it("takes a screenshot", async () => {
    await command("screenshot लो");
    expect(last()?.id).toBe("screenshot");
    expect(last()?.args.all_screens ?? false).toBe(false);
    expect(last()?.args.main_screen ?? false).toBe(false);
  }, 60_000);

  it("looks for a file in the folder it was told", async () => {
    await command("pictures वाले folder में registration ढूंढो");
    expect(last()).toMatchObject({ id: "find_files", args: { in: "pictures" } });
    expect(String(last()?.args.name).toLowerCase()).toContain("registration");
  }, 60_000);

  it("closes a browser tab with Ctrl+W, never the browser's window", async () => {
    await command("Chrome में WhatsApp वाली tab बंद करो");
    expect(recorded.some((entry) => entry.id === "close_windows")).toBe(false);
    expect(String(last()?.args.keys).toLowerCase().replace(/\s/g, "")).toBe("ctrl+w");
  }, 60_000);

  it("makes a new virtual desktop", async () => {
    await command("नया desktop बनाओ");
    expect(String(last()?.args.keys).toLowerCase().replace(/\s/g, "").split("+").sort()).toEqual([
      "ctrl",
      "d",
      "win",
    ]);
  }, 60_000);

  it("answers what WhatsApp shows by reading it, not by searching the web", async () => {
    const before = opened.length;
    const outcome = await command("check कर सकते हो कि WhatsApp login है या नहीं");
    expect(opened.length).toBe(before);
    expect(outcome.ok).toBe(true);
  }, 60_000);

  it("searches inside WhatsApp by typing into its own search box", async () => {
    const before = typed.length;
    await command("WhatsApp में Aarnav को search करो");
    expect(typed.slice(before).map((text) => text.toLowerCase())).toEqual(["aarnav"]);
  }, 60_000);

  it("writes a WhatsApp message as one step, to the person named", async () => {
    await command("WhatsApp पे Aryan को hi भेजो");
    expect(recorded.at(-1)).toMatchObject({ id: "whatsapp_message", args: { to: "Aryan", text: "hi" } });
  }, 60_000);

  it("types a message to a friend but never sends it", async () => {
    const pressed = recorded.length;
    const before = typed.length;
    // The user's own words from the third test, which was planned without opening the chat.
    await command("और WhatsApp पर Aryan के पास एक message भेजना है, hi");
    // With Aryan's chat already in the list the plan may click it without searching first.
    if (typed.length > before) expect(typed[before]?.toLowerCase()).toMatch(/aryan|hi/);
    const keys = recorded.slice(pressed).filter((entry) => entry.id === "press_keys");
    expect(keys.map((entry) => String(entry.args.keys).toLowerCase())).not.toContain("enter");
    expect(clicked.some((name) => /send/i.test(name))).toBe(false);
    // Typing here is recorded, so WhatsApp never shows Aarnav in its results and the chat cannot be
    // opened in a test; doing it for real would mark a friend's chat read and leave a draft.
  }, 90_000);

  it("does not type out speech it could not make sense of", async () => {
    const before = typed.length;
    await command("अन्बुकरो");
    expect(typed.length).toBe(before);
  }, 60_000);

  it("writes an asked-for email once", async () => {
    const before = typed.length;
    await command("एक email लिखो batch manager को कि मेरी attendance 20% है, उसे 40% करवानी है");
    expect(typed.length - before).toBe(1);
    console.log(`    typed: ${typed.at(-1)}`);
  }, 60_000);

  it("answers a question about the computer", async () => {
    const outcome = await command("memory कितनी use हो रही है");
    expect(outcome.ok).toBe(true);
    expect(outcome.message).toMatch(/memory \d+% used/);
  }, 60_000);

  it("plays the 4th video in YouTube's results by clicking it", async () => {
    // A results tab of the test's own, muted, so the click is real and harmless.
    spawn("cmd.exe", ["/c", "start", "", "https://www.youtube.com/results?search_query=kesariya+song"], {
      detached: true,
    }).unref();
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const volume = (await source.actions()).find((action) => action.id === "set_volume");
    const [now] = (await volume?.facts?.()) ?? [""];
    await volume?.run({ mute: true });
    realClicks = true;
    try {
      const outcome = await command("YouTube पर 4th वाला video चलाओ");
      expect(outcome.message).toMatch(/^Clicked .+ in .*YouTube/);
      console.log(`    clicked: ${clicked.at(-1)}`);
    } finally {
      realClicks = false;
      // The tab — now playing the video — is closed before the sound comes back. Chrome is in
      // front: the click brought it there.
      const keys = (await source.actions()).find((action) => action.id === "press_keys");
      await keys?.run({ keys: "ctrl+w" });
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!/muted/.test(now ?? "")) await volume?.run({ mute: false });
    }
  }, 90_000);

  it("says plainly when what was said is not a command", async () => {
    const outcome = await command("hello कैसे हो");
    expect(outcome.ok).toBe(false);
  }, 60_000);
});
