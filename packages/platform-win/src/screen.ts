import type { ScreenDriver, ScreenElement, ScreenSnapshot, TextInserter } from "@subx/core";
import type { WindowInfo } from "./commands";
import type { PowerShellWorker } from "./powershell";
import { sendChord, VK, waitForModifiersUp } from "./win32";

/**
 * The screen through UI Automation (CmdUia in interop.ts), on the same PowerShell worker as the
 * rest of command mode. Works on any screen: elements carry their own coordinates, and both of the
 * dev machine's monitors were read the same way.
 */

/** A page that has just been clicked into is still loading; the next step reads it after this. */
const SETTLE_MS = 900;

/**
 * Chromium turns its page's accessibility on only once something asks: the first read of a Chrome
 * window returned its tab strip and toolbar alone (39 elements), the second the whole YouTube page.
 */
export const BROWSERS = new Set(["chrome", "msedge", "brave", "opera", "vivaldi"]);
const BARE_BROWSER = 60;

/** Words in a window's title that say nothing about which window a step means. */
/**
 * Words that say nothing about which window a step means — including the step's own verbs and
 * nouns: "Type Aarnav into WhatsApp's search box" once matched a Chrome window titled "weather
 * report - Google Search" on "search", tied with WhatsApp, and the topmost (Chrome) won.
 */
const GENERIC = new Set([
  "google",
  "the",
  "and",
  "app",
  "window",
  "new",
  "tab",
  "microsoft",
  "windows",
  "search",
  "box",
  "type",
  "into",
  "click",
  "open",
  "result",
  "results",
  "message",
  "chat",
  "button",
  "video",
  "page",
  "play",
  "with",
  "from",
  "this",
  "that",
]);

/** An app just launched for a step gets this long to show a window with something in it. */
const LAUNCH_MS = 8000;

export interface ScreenDeps {
  windows(): Promise<WindowInfo[]>;
  inserter: TextInserter;
  /**
   * Starts the installed app a step names, when no window of it is open. True when one was started.
   * "Aryan ko hi bhejo" with WhatsApp closed used to stop at a search box that was not there.
   */
  launchNamed(hint: string): Promise<boolean>;
}

export class WinScreenDriver implements ScreenDriver {
  private window: WindowInfo | null = null;
  private elements: ScreenElement[] = [];

  constructor(
    private readonly worker: PowerShellWorker,
    private readonly deps: ScreenDeps,
  ) {}

  async read(hint: string): Promise<ScreenSnapshot> {
    let { window: target, named } = chooseWindow(hint, await this.deps.windows());
    if (!named && (await this.deps.launchNamed(hint))) {
      // Launched for this step: wait for its window, then give it a moment to fill in.
      const deadline = Date.now() + LAUNCH_MS;
      while (Date.now() < deadline) {
        await sleep(400);
        ({ window: target, named } = chooseWindow(hint, await this.deps.windows()));
        if (named) break;
      }
      await sleep(1500);
    }
    if (!target) throw new Error("There is no window to look at");
    // A step that names its place acts there or nowhere. "Click the 1st result in YouTube" with no
    // YouTube open once fell back to the Chrome tab in front and picked an ad on another page.
    const place = namedPlace(hint);
    if (!named && place) throw new Error(`${place} isn't open`);
    // A minimized window has nothing on screen to read; one behind others is brought forward so
    // the user sees what is being done in it.
    if (!target.foreground) {
      await this.worker.run(`[CmdWindows]::Focus(${target.handle})`);
      await sleep(target.state === "minimized" ? 500 : 150);
    }
    let elements = await this.readTree(target);
    // A browser page still loading — results just searched for — shows only the toolbar for a
    // moment; "click the 1st result" right after a search must wait for the results to arrive.
    for (
      let tries = 0;
      BROWSERS.has(target.program.toLowerCase()) && elements.length < BARE_BROWSER && tries < 5;
      tries++
    ) {
      await sleep(700);
      elements = await this.readTree(target);
    }
    this.window = target;
    this.elements = elements;
    return { window: target.title, elements };
  }

  async click(id: number): Promise<void> {
    await this.worker.run(`${this.front()}[CmdUia]::Click(${id})`);
    await sleep(SETTLE_MS);
  }

  /**
   * Replaces what the box holds rather than adding to it: a search box still holding the last
   * search, or a message box holding an unsent draft, got the new words stuck onto the old
   * ("hiHigh CourtHi, message" in real use). Then reads the box back: typing that did not land is
   * said so, not reported as done.
   */
  async typeInto(id: number, text: string): Promise<void> {
    await this.worker.run(`${this.front()}[CmdUia]::Focus(${id})`);
    await sleep(150);
    await waitForModifiersUp();
    sendChord([VK.control], 0x41); // Ctrl+A, within the focused box
    await sleep(60);
    // Pasted, like dictation: Devanagari and emoji arrive intact, and no Enter is ever pressed.
    await this.deps.inserter.insert(text);
    // Read back for up to ~1.5 s: a WhatsApp group's message box reported its new text late, and a
    // single read at 400 ms called a message that had landed a failure.
    let landed = false;
    let readable = false;
    for (let tries = 0; tries < 6 && !landed; tries++) {
      await sleep(250);
      const now = await this.worker.run(`[CmdUia]::CurrentValue(${id})`).catch(() => null);
      readable ||= typeof now === "string";
      landed = typeof now === "string" && squash(now).includes(squash(text));
    }
    if (readable && !landed) {
      const name = this.elements.find((element) => element.id === id)?.name ?? "the box";
      throw new Error(`Typed "${text}", but "${name}" doesn't show it`);
    }
    await sleep(400);
  }

  private async readTree(window: WindowInfo): Promise<ScreenElement[]> {
    const read = await this.worker.json<{ elements: ScreenElement[] }>(`[CmdUia]::Read(${window.handle})`);
    return read.elements ?? [];
  }

  /** The window acted on comes to the front first, so the user sees what is being done. */
  private front(): string {
    return this.window ? `[void][CmdWindows]::Focus(${this.window.handle}); ` : "";
  }
}

/**
 * The window a step names — "WhatsApp's search box", "the second video on YouTube" — scored by the
 * words of its title and program that the step contains; ties go to the topmost, which is the list's
 * order. A step that names none means the window in front. `named` says whether the step's words
 * found it, as opposed to falling back.
 */
export function chooseWindow(
  hint: string,
  windows: WindowInfo[],
): { window: WindowInfo | null; named: boolean } {
  const own = new Set(["subxvoice", "electron"]);
  const candidates = windows.filter((window) => !own.has(window.program.toLowerCase()));
  // The place the step names, when it names one, is the only thing that chooses the window.
  const place = namedPlace(hint);
  const said = new Set(words(place ?? hint));
  let best: WindowInfo | null = null;
  let bestScore = 0;
  for (const window of candidates) {
    const score = new Set(words(`${window.title} ${window.program}`).filter((word) => said.has(word))).size;
    if (score > bestScore) {
      best = window;
      bestScore = score;
    }
  }
  if (best) return { window: best, named: true };
  return { window: candidates.find((window) => window.foreground) ?? candidates[0] ?? null, named: false };
}

/**
 * "in YouTube", "on WhatsApp", "into WhatsApp's search box" → the capitalised name of the place. Not
 * a bare possessive: in "Open Aryan's chat" the capital is a person, not a window.
 */
export function namedPlace(hint: string): string | null {
  const place = /\b(?:in|on|inside|into)\s+(?:the\s+)?([A-Z][\w.]*(?:\s+[A-Z][\w.]*)*)/.exec(hint)?.[1];
  return place && words(place).length ? place : null;
}

export const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !GENERIC.has(word));

/** Whitespace-blind and case-blind, as a box may wrap or trim what was pasted. */
const squash = (text: string) => text.replace(/\s+/g, "").toLowerCase();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
