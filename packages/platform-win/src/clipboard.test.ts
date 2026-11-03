import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Restoring the clipboard is a courtesy; pasting the dictation is the job. This file exists
 * because an unreadable clipboard item used to produce `new ClipboardItem({})`, which throws, and
 * that throw travelled all the way out of insert() and lost the user their dictation.
 */
const read = vi.fn();
const write = vi.fn();
const clear = vi.fn();
const readText = vi.fn(async () => "pasted");

vi.mock("electron", () => ({
  clipboard: { read, write, clear, readText },
  // The real constructor rejects an empty bag of formats; the stand-in must too.
  ClipboardItem: class {
    constructor(public data: Record<string, unknown>) {
      if (Object.keys(data).length === 0) {
        throw new TypeError("Failed to construct 'ClipboardItem': At least one entry required");
      }
    }
  },
}));

const { restoreClipboardLater, snapshotClipboard } = await import("./clipboard");

/** One clipboard item advertising `types`, where only the types in `readable` come back. */
const item = (types: string[], readable: string[]) => ({
  types,
  getType: async (type: string) => {
    if (!readable.includes(type)) throw new Error(`cannot read ${type}`);
    return new Blob(["x"], { type });
  },
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("snapshotClipboard", () => {
  it("keeps the formats it can read", async () => {
    read.mockResolvedValue([item(["text/plain"], ["text/plain"])]);
    expect(await snapshotClipboard()).toHaveLength(1);
  });

  it("drops an item whose formats all fail to read, instead of throwing", async () => {
    read.mockResolvedValue([item(["application/x-weird"], [])]);
    await expect(snapshotClipboard()).resolves.toEqual([]);
  });

  it("keeps the readable item when another one is unreadable", async () => {
    read.mockResolvedValue([item(["application/x-weird"], []), item(["text/plain"], ["text/plain"])]);
    expect(await snapshotClipboard()).toHaveLength(1);
  });

  it("returns null rather than throwing when the clipboard cannot be read at all", async () => {
    read.mockRejectedValue(new Error("clipboard busy"));
    await expect(snapshotClipboard()).resolves.toBeNull();
  });
});

describe("restoreClipboardLater", () => {
  it("leaves the pasted text alone when the clipboard was never readable", () => {
    vi.useFakeTimers();
    restoreClipboardLater(null, "pasted");
    vi.runAllTimers();
    expect(clear).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("clears the clipboard when it really was empty", async () => {
    vi.useFakeTimers();
    restoreClipboardLater([], "pasted");
    await vi.runAllTimersAsync();
    expect(clear).toHaveBeenCalled();
  });
});
