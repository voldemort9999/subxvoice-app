import { describe, expect, it } from "vitest";
import { namedPlace } from "./screen";

describe("namedPlace", () => {
  it("finds the app or site a screen step names, and nothing in a step that names none", () => {
    expect(namedPlace("Click the 1st result in YouTube")).toBe("YouTube");
    expect(namedPlace("Type Aryan into WhatsApp's search box")).toBe("WhatsApp");
    expect(namedPlace("Type hi into the message box in WhatsApp")).toBe("WhatsApp");
    expect(namedPlace("Open Aryan's chat")).toBeNull();
    expect(namedPlace("Click the Expand button")).toBeNull();
  });
});

describe("chooseWindow", () => {
  const window = (title: string, program: string, foreground = false) => ({
    handle: title.length,
    title,
    program,
    pid: 1,
    state: "normal",
    foreground,
  });

  it("takes the window the step names, not one that shares a word with the step", async () => {
    const { chooseWindow } = await import("./screen");
    const chrome = window("weather report - Google Search - Google Chrome", "chrome", true);
    const whatsapp = window("WhatsApp", "WhatsApp.Root");
    expect(chooseWindow("Type Aarnav into WhatsApp's search box", [chrome, whatsapp]).window).toBe(whatsapp);
  });

  it("says it found nothing named when the named place is not open", async () => {
    const { chooseWindow } = await import("./screen");
    const chrome = window("Hinglish transcription instructions - Google Chrome", "chrome", true);
    expect(chooseWindow("Click the 1st result in YouTube", [chrome]).named).toBe(false);
  });
});
