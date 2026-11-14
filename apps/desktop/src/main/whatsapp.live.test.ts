import { execFileSync } from "node:child_process";
import { AgentMemory, runCommand, screenSource, type TextInserter } from "@subx/core";
import { createDecider, createLlm } from "@subx/providers";
import { describe, expect, it } from "vitest";
import { WinCommandSource } from "../../../../packages/platform-win/src/commands";
import { sendChord, VK, waitForModifiersUp } from "../../../../packages/platform-win/src/win32";
import { DECISIONS_URL, LLM_URL } from "./auth";

/**
 * The whole messaging flow for real — real typing, real clicks — on the user's own "Message
 * yourself" chat (@MCUPortal), so no one else's chat is opened or marked read. WhatsApp starts
 * minimized, so the flow has to bring it forward itself. Nothing is sent, and the draft it leaves is
 * deleted at the end. Opt-in on top of the live suite: LIVE_WHATSAPP=1.
 */
const token = process.env.SUBX_TOKEN ?? "";
const live = process.env.LIVE_WHATSAPP === "1" && process.platform === "win32" && !!token;

/** The app's inserter needs Electron's clipboard; outside Electron the clipboard is set by PowerShell. */
const paste: TextInserter = {
  insert: async (text) => {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", "[Console]::In.ReadToEnd() | Set-Clipboard"], {
      input: text,
    });
    await waitForModifiersUp();
    sendChord([VK.control], VK.v);
  },
};

describe.skipIf(!live)("WhatsApp, end to end, on the user's own chat", () => {
  it("opens WhatsApp, searches, opens the chat, types the message and does not send it", async () => {
    const source = new WinCommandSource({ inserter: paste, openUrl: async () => {} });
    const decider = createDecider({ id: "jev", token, baseUrl: DECISIONS_URL });
    const writer = createLlm({
      id: "openrouter",
      token,
      baseUrl: LLM_URL,
      model: "google/gemini-2.5-flash",
      reasoning: false,
      timeoutMs: 8000,
    });
    const log = (line: string) => console.log(`    ${line}`);
    const act = async (id: string, args: Record<string, unknown>) =>
      (await source.actions()).find((action) => action.id === id)?.run(args);
    try {
      // The state the user's own test was in: an earlier search ("NL") left in the box. Then minimized.
      const before = await source.screen.read("in WhatsApp");
      const search = before.elements.find((element) => element.editable && element.where === "top");
      if (search) await source.screen.typeInto(search.id, "NL");
      await act("arrange_windows", { windows: ["WhatsApp"], do: "minimize" }).catch(() => {});
      // Said the way speech recognition hands it over when the name is heard as two words.
      const outcome = await runCommand(process.env.SAID ?? "WhatsApp पे MCUPortal को hi भेजो", {
        decider,
        writer,
        sources: [source, screenSource(source.screen, decider, writer, log)],
        memory: new AgentMemory(),
        log,
      });
      console.log(`  → ${outcome.message}`);
      expect(outcome.message).toMatch(
        /Typed "hi" (?:into "Type a message to @MCUPortal"|to @?MCUPortal on WhatsApp)/i,
      );
      expect(outcome.message).toMatch(/not sent/);
    } finally {
      // The cursor is in the message box: clear the draft, then leave the chat.
      await act("press_keys", { keys: "ctrl+a" });
      await act("press_keys", { keys: "delete" });
      await act("press_keys", { keys: "esc" });
      // And the search left in WhatsApp's search box.
      const screen = await source.screen.read("WhatsApp search box");
      const search = screen.elements.find((element) => element.editable && element.where === "top");
      if (search) {
        await source.screen.click(search.id);
        await act("press_keys", { keys: "ctrl+a" });
        await act("press_keys", { keys: "delete" });
        await act("press_keys", { keys: "esc" });
      }
      source.dispose();
    }
  }, 90_000);
});
