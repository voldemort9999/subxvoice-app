import type { LlmProvider, LlmRequest } from "@subx/core";
import { describe, expect, it } from "vitest";
import { RaceLlm } from "./race";

const REQUEST: LlmRequest = { system: "s", messages: [{ role: "user", content: "hi" }] };
const HEAD_START = 40;

/** A provider that answers `text` (or fails) after `ms`, and counts its calls. */
function fake(id: string, ms: number, fail = false) {
  const provider = {
    id,
    calls: 0,
    complete: () => {
      provider.calls += 1;
      return new Promise<{ text: string; toolCalls: [] }>((resolve, reject) =>
        setTimeout(() => (fail ? reject(new Error(`${id} down`)) : resolve({ text: id, toolCalls: [] })), ms),
      );
    },
  };
  return provider satisfies LlmProvider & { calls: number };
}

describe("RaceLlm", () => {
  it("answers from the primary and never asks the backup when the primary is quick", async () => {
    const primary = fake("primary", 5);
    const backup = fake("backup", 5);
    const result = await new RaceLlm(primary, backup, HEAD_START).complete(REQUEST);
    expect(result.text).toBe("primary");
    await new Promise((r) => setTimeout(r, HEAD_START * 2));
    expect(backup.calls).toBe(0);
  });

  it("asks the backup once the head start passes, and takes the backup when it is first", async () => {
    const primary = fake("primary", 400);
    const backup = fake("backup", 10);
    const result = await new RaceLlm(primary, backup, HEAD_START).complete(REQUEST);
    expect(result.text).toBe("backup");
    expect(primary.calls).toBe(1);
  });

  it("keeps the primary running after the backup starts, and takes it when it finishes first", async () => {
    const primary = fake("primary", HEAD_START + 20);
    const backup = fake("backup", 300);
    const result = await new RaceLlm(primary, backup, HEAD_START).complete(REQUEST);
    expect(result.text).toBe("primary");
    expect(backup.calls).toBe(1);
  });

  it("asks the backup at once when the primary fails inside its head start", async () => {
    const primary = fake("primary", 1, true);
    const backup = fake("backup", 5);
    const started = Date.now();
    const result = await new RaceLlm(primary, backup, 1000).complete(REQUEST);
    expect(result.text).toBe("backup");
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("still answers from the primary when the backup fails first", async () => {
    const primary = fake("primary", HEAD_START + 40);
    const backup = fake("backup", 5, true);
    const result = await new RaceLlm(primary, backup, HEAD_START).complete(REQUEST);
    expect(result.text).toBe("primary");
  });

  it("rejects only when both have failed", async () => {
    const race = new RaceLlm(fake("primary", 1, true), fake("backup", 5, true), HEAD_START);
    await expect(race.complete(REQUEST)).rejects.toThrow("backup down");
  });

  it("rejects when the primary fails after the backup has already failed", async () => {
    const race = new RaceLlm(fake("primary", HEAD_START + 30, true), fake("backup", 5, true), HEAD_START);
    await expect(race.complete(REQUEST)).rejects.toThrow("primary down");
  });
});
