import type { Platform } from "@subx/core";
import { WinCommandSource } from "./commands";
import { WinContextReader } from "./context";
import { WinDesktopActions } from "./desktop";
import { WinHotkey } from "./hotkey";
import { WinInserter } from "./inserter";
import { WinPermissions } from "./permissions";

export function createWinPlatform(): Platform {
  const inserter = new WinInserter();
  const desktop = new WinDesktopActions();
  const commands = new WinCommandSource({ inserter, openUrl: (url) => desktop.openUrl(url) });
  return {
    os: "win",
    hotkey: new WinHotkey(),
    inserter,
    permissions: new WinPermissions(),
    context: new WinContextReader(),
    desktop,
    // Nothing starts here: PowerShell is spawned on the first command, so the cost is never paid
    // by someone who only dictates.
    commands,
    screen: commands.screen,
  };
}
