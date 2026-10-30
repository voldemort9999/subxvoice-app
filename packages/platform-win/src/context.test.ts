import { describe, expect, it } from "vitest";
import { appNameFromPath } from "./context";

describe("naming the app a dictation went into", () => {
  it("uses the executable name, which is what the user recognises", () => {
    expect(appNameFromPath("C:\\Users\\a\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe")).toBe(
      "Code",
    );
    expect(appNameFromPath("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")).toBe("chrome");
  });

  it("copes with what Windows actually hands back", () => {
    // Forward slashes appear in paths from some launchers.
    expect(appNameFromPath("C:/Windows/explorer.exe")).toBe("explorer");
    // A process we had no right to read reports no path at all.
    expect(appNameFromPath("")).toBe("");
    // Extensionless images exist (services, WSL interop).
    expect(appNameFromPath("C:\\Windows\\System32\\wsl")).toBe("wsl");
  });
});
