import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { AgentAction } from "@subx/core";
import { afterAll, describe, expect, it } from "vitest";
import { WinCommandSource } from "./commands";

/**
 * Runs the real actions against this machine — no model involved. Opt-in with LIVE=1, because it
 * opens Notepad and reads the volume; CI never sets it. Nothing is left changed: the volume is set
 * to what it already was, and the Notepad it opens it closes again.
 */
const live = process.env.LIVE === "1" && process.platform === "win32";

describe.skipIf(!live)("WinCommandSource on this machine", () => {
  const typed: string[] = [];
  const source = new WinCommandSource({
    inserter: { insert: async (text) => void typed.push(text) },
    openUrl: async () => {},
  });
  afterAll(() => source.dispose());

  const get = async (id: string): Promise<AgentAction> => {
    const found = (await source.actions()).find((action) => action.id === id);
    if (!found) throw new Error(`no action ${id}`);
    return found;
  };

  it("says which window is in front", async () => {
    const facts = await source.observe();
    console.log(facts);
    expect(facts[0]).toMatch(/^Focused window: .+ \(.+\)$/);
  }, 30_000);

  it("reads the volume, the open windows, the programs and the audio apps", async () => {
    for (const id of [
      "set_volume",
      "close_windows",
      "kill_process",
      "app_volume",
      "brightness",
      "bluetooth",
      "wifi",
    ]) {
      const facts = (await (await get(id)).facts?.()) ?? [];
      console.log(id, facts);
      expect(facts[0]?.length).toBeGreaterThan(10);
    }
  }, 30_000);

  it("never offers Windows itself or this app as something to stop", async () => {
    const [programs] = (await (await get("kill_process")).facts?.()) ?? [""];
    expect(programs).not.toMatch(/\b(explorer|svchost|csrss|powershell|lsass) \d/i);
  }, 30_000);

  it("answers a status question", async () => {
    const result = await (await get("system_status")).run({});
    console.log(result.answer);
    expect(result.answer).toMatch(/memory \d+% used/);
  }, 30_000);

  it("sets the volume to what it already was", async () => {
    const [now] = (await (await get("set_volume")).facts?.()) ?? [""];
    const level = Number(/(\d+)%/.exec(now ?? "")?.[1]);
    const result = await (await get("set_volume")).run({ level });
    expect(result.did).toBe(`Volume set to ${level}%`);
  }, 30_000);

  it("opens Notepad by name, then closes it by title", async () => {
    const opened = await (await get("open_app")).run({ name: "Notepad" });
    console.log(opened.did);
    expect(opened.did).toBe("Opened Notepad");
    const [list] = (await (await get("close_windows")).facts?.()) ?? [""];
    const title = list
      ?.replace(/^Open windows: /, "")
      .split("; ")
      .find((window) => /notepad/i.test(window));
    expect(title).toBeTruthy();
    for (const how of ["minimize", "restore", "maximize", "restore", "focus"]) {
      const result = await (await get("arrange_windows")).run({ windows: [title], do: how });
      console.log(result.did);
    }
    const closed = await (await get("close_windows")).run({ close: [title] });
    expect(closed.did).toMatch(/^Closed .*Notepad$/);
  }, 30_000);

  it("sets the brightness to what it already was", async () => {
    const [now] = (await (await get("brightness")).facts?.()) ?? [""];
    const level = Number(/(\d+)%/.exec(now ?? "")?.[1]);
    if (!Number.isFinite(level)) return; // a screen with no WMI and no DDC/CI
    expect((await (await get("brightness")).run({ level })).did).toBe(`Brightness set to ${level}%`);
    expect((await (await get("brightness")).run({ level: null })).answer).toBe(`Brightness is ${level}%`);
  }, 30_000);

  it("takes a screenshot of the largest display, and leaves no file behind", async () => {
    const result = await (await get("screenshot")).run({ which: "largest" });
    console.log(result.did);
    const path = /saved to (.+\.png)/.exec(result.did)?.[1] ?? "";
    expect(existsSync(path)).toBe(true);
    rmSync(path);
  }, 30_000);

  it("finds a file by the words of its name, makes a folder and copies into it without replacing", async () => {
    const root = mkdtempSync(join(tmpdir(), "subx-files-"));
    try {
      writeFileSync(join(root, "My_Resume_2026.txt"), "test");
      const found = await (await get("find_files")).run({ name: "my resume", in: root });
      expect(found.did).toBe(`Found ${join(root, "My_Resume_2026.txt")}, selected in File Explorer`);
      const made = await (await get("make_folder")).run({ path: join(root, "copies") });
      expect(made.did).toBe(`Made the folder ${join(root, "copies")}`);
      const copy = await get("copy_files");
      const files = [join(root, "My_Resume_2026.txt")];
      expect((await copy.run({ files, to: join(root, "copies") })).did).toMatch(/^Copied 1 into/);
      expect((await copy.run({ files, to: join(root, "copies") })).did).toMatch(/already there, left as is/);
      // find_files showed it in File Explorer; that window is closed again.
      await sleep(1500);
      const [list] = (await (await get("close_windows")).facts?.()) ?? [""];
      const title = list
        ?.replace(/^Open windows: /, "")
        .split("; ")
        .find((window) => window.startsWith(basename(root)));
      if (title) await (await get("close_windows")).run({ close: [title] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("reads Notepad's screen, finds its text box, and types into it through the inserter", async () => {
    await (await get("open_app")).run({ name: "Notepad" });
    const snapshot = await source.screen.read("Type in Notepad");
    console.log(snapshot.window, snapshot.elements.length, "elements");
    expect(snapshot.window).toMatch(/Notepad/);
    const box = snapshot.elements.find((element) => element.editable);
    expect(box).toBeTruthy();
    // The inserter here only records, so nothing lands in the box — and the driver, reading the
    // box back, must say so rather than report it typed.
    await expect(source.screen.typeInto(box?.id ?? -1, "subx screen test")).rejects.toThrow(
      /doesn't show it/,
    );
    expect(typed.at(-1)).toBe("subx screen test");
    const [list] = (await (await get("close_windows")).facts?.()) ?? [""];
    const title = list
      ?.replace(/^Open windows: /, "")
      .split("; ")
      .find((window) => /^Untitled - Notepad$/.test(window));
    if (title) await (await get("close_windows")).run({ close: [title] });
  }, 30_000);

  it("reads WhatsApp and Chrome, when they are open, without acting", async () => {
    for (const hint of ["WhatsApp search box", "WhatsApp search box", "YouTube in Chrome"]) {
      const started = performance.now();
      const snapshot = await source.screen.read(hint).catch((error: Error) => error);
      if (snapshot instanceof Error) continue;
      console.log(
        `${hint} → ${snapshot.window}: ${snapshot.elements.length} elements in ${Math.round(performance.now() - started)} ms;`,
        snapshot.elements.filter((element) => element.editable).map((element) => element.name),
      );
      expect(snapshot.elements.length).toBeGreaterThan(5);
    }
  }, 30_000);

  it("refuses an app that is not installed, by name", async () => {
    await expect((await get("open_app")).run({ name: "Definitely Not An App 9000" })).rejects.toThrow(
      /No app called/,
    );
  }, 30_000);
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
