import { describe, expect, it } from "vitest";
import { resolveOne } from "./match";

const name = (item: { name: string }) => item.name;
const apps = [{ name: "Google Chrome" }, { name: "Notepad" }, { name: "Notepad++" }, { name: "WhatsApp" }];

describe("resolveOne", () => {
  it("prefers an exact name over a looser match that would otherwise tie", () => {
    // "notepad" is a prefix of both, but only one is exactly it.
    expect(resolveOne("notepad", apps, name).chosen).toEqual({ name: "Notepad" });
  });

  it("resolves on a whole word inside a longer name", () => {
    expect(resolveOne("chrome", apps, name)).toMatchObject({
      chosen: { name: "Google Chrome" },
      how: "word",
    });
  });

  it("reports several matches as ambiguous instead of taking the first", () => {
    const devices = [{ name: "NVIDIA Output 1" }, { name: "NVIDIA Output 2" }];
    const match = resolveOne("nvidia", devices, name);
    expect(match.chosen).toBeNull();
    expect(match.how).toBe("ambiguous");
    expect(match.candidates).toHaveLength(2);
  });

  it("says none when nothing matches, which is a different answer from ambiguous", () => {
    expect(resolveOne("spotify", apps, name)).toEqual({ chosen: null, candidates: [], how: "none" });
  });

  it("lets an exact id win even when the names collide", () => {
    const procs = [
      { name: "chrome", pid: "11" },
      { name: "chrome", pid: "22" },
    ];
    expect(
      resolveOne(
        "22",
        procs,
        (p) => p.name,
        (p) => p.pid,
      ).chosen,
    ).toEqual({ name: "chrome", pid: "22" });
  });

  it("does not let a word match inside another word", () => {
    // "pad" is inside "Notepad" but is not a word of it, so it falls to substring and ties.
    expect(resolveOne("pad", apps, name).how).toBe("ambiguous");
  });

  it("treats an empty query as no match rather than matching everything", () => {
    expect(resolveOne("  ", apps, name).how).toBe("none");
  });
});
