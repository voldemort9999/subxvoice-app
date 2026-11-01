// Shared between the desktop app, the website and (later) the backend.

/**
 * Installers only. The source repo is private, and a private repo's release assets 404 for
 * anonymous downloads — so both the download button and the updater read from this public one.
 * Must match `publish` in apps/desktop/electron-builder.yml.
 */
export const GITHUB_REPO = "voldemort9999/subxvoice-releases";

/** Must match `artifactName` in apps/desktop/electron-builder.yml. */
export const DOWNLOAD_FILES = {
  mac: "SUBXVoice-mac.dmg",
  win: "SUBXVoice-windows-setup.exe",
} as const;

export type DesktopOs = keyof typeof DOWNLOAD_FILES;

/** Always points at the newest GitHub release, so the website never needs a redeploy. */
export function downloadUrl(os: DesktopOs): string {
  return `https://github.com/${GITHUB_REPO}/releases/latest/download/${DOWNLOAD_FILES[os]}`;
}
