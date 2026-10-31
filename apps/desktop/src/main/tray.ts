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
 * The app's waveform mark, flat. The tray is 16 px and, on a Mac, a template image the system
 * tints for light and dark menu bars — so the plate and the brand colour are dropped here.
 */
function trayIcon() {
  const isMac = process.platform === "darwin";
  const image = brandIcon(SIZE, { plate: false, shade: isMac ? 0 : 255 });
  if (isMac) image.setTemplateImage(true);
  return image;
}
