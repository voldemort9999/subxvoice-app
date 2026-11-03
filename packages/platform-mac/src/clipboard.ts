import { ClipboardItem, clipboard } from "electron";

/** Long enough for the target app to read the clipboard before the user's contents go back. */
const RESTORE_DELAY_MS = 400;

/**
 * What was on the clipboard before we overwrote it, or `null` when it could not be read at all.
 * The distinction matters: an empty clipboard should be restored as empty, while one we failed to
 * read must be left alone rather than cleared.
 */
export type ClipboardSnapshot = ClipboardItem[] | null;

/**
 * Copies every format on the clipboard (text, images, files…) right now. Items from
 * `clipboard.read()` are lazy, so they are read eagerly — after we overwrite the clipboard they
 * would otherwise return our text instead of the user's.
 *
 * Never throws. Putting the user's clipboard back is a courtesy; their dictation is the job, and
 * this used to take the whole paste down with it — `new ClipboardItem({})` throws "Failed to
 * construct 'ClipboardItem'", which is exactly what an item whose formats all failed to read
 * produced.
 */
export async function snapshotClipboard(): Promise<ClipboardSnapshot> {
  try {
    const items = await clipboard.read();
    const snapshot: ClipboardItem[] = [];
    for (const item of items) {
      const data: Record<string, Blob> = {};
      for (const type of item.types) {
        try {
          const value = await item.getType(type);
          if (value instanceof Blob) data[type] = value;
        } catch {
          // Some platform formats can't be read back; skip them.
        }
      }
      // An item with nothing readable left is dropped: ClipboardItem requires at least one entry,
      // and a format we cannot read is one we cannot put back either.
      if (Object.keys(data).length > 0) snapshot.push(new ClipboardItem(data));
    }
    return snapshot;
  } catch (error) {
    console.error("Could not read the clipboard; it will be left as pasted:", error);
    return null;
  }
}

/** Puts the user's clipboard back after a paste — unless something else has replaced it meanwhile. */
export function restoreClipboardLater(snapshot: ClipboardSnapshot, pasted: string): void {
  // Unreadable: leave the pasted text sitting there rather than clearing something we never saw.
  if (snapshot === null) return;
  setTimeout(() => {
    void (async () => {
      if ((await clipboard.readText()) !== pasted) return;
      if (snapshot.length > 0) await clipboard.write(snapshot);
      else clipboard.clear();
    })();
  }, RESTORE_DELAY_MS);
}
