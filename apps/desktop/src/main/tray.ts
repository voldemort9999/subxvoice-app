import { Menu, Tray } from "electron";
import { brandIcon } from "./brand";

/** Menu bar icon (Mac) / system tray icon (Windows): the way to open the dashboard or quit. */
export function createTray(openDashboard: () => void): Tray {
  const tray = new Tray(trayIcon());
  tray.setToolTip("SUBXVoice");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open SUBXVoice", click: openDashboard },
      { type: "separator" },
      { label: "Quit SUBXVoice", role: "quit" },
    ]),
  );
  return tray;
}

const SIZE = 32; // 16 pt drawn at 2x for sharp retina rendering

/**
 * On a Mac the menu bar wants a template image it tints for light and dark, so the bars go alone.
 * Windows draws tray icons in full colour on a taskbar that can be either, and white bars alone
 * vanish on a light one — so it gets the whole mark, plate and Marigold included.
 */
function trayIcon() {
  if (process.platform !== "darwin") return brandIcon(SIZE, { plate: true });
  const image = brandIcon(SIZE, { plate: false, shade: 0 });
  image.setTemplateImage(true);
  return image;
}
