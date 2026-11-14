import { describe, expect, it } from "vitest";
import type { DeciderProvider, DecisionRequest } from "../contracts/decider";
import type { LlmProvider } from "../contracts/llm";
import { screenSource } from "./screen";
import type { AgentAction, ScreenDriver, ScreenSnapshot } from "./types";

const youtube: ScreenSnapshot = {
  window: "kesariya song - YouTube - Google Chrome",
  elements: [
    { id: 0, role: "Edit", name: "Search", editable: true },
    { id: 1, role: "Link", name: "Kesariya - Brahmastra", editable: false },
    { id: 2, role: "Link", name: "Kesariya - Film Version", editable: false },
  ],
};

function driver(snapshot: ScreenSnapshot) {
  const done: string[] = [];
  const fake: ScreenDriver & { done: string[]; hints: string[] } = {
    done,
    hints: [],
    async read(hint) {
      fake.hints.push(hint);
      return snapshot;
    },
    async click(id) {
      done.push(`click ${id}`);
    },
    async typeInto(id, text) {
      done.push(`type ${id} ${text}`);
    },
  };
  return fake;
}

function decider(choice: string, confidence = 0.9): DeciderProvider & { asked: DecisionRequest[] } {
  const asked: DecisionRequest[] = [];
  return {
    id: "fake",
    asked,
    async decide(request) {
      asked.push(request);
      return { choice, confidence };
    },
  };
}

const writer: LlmProvider = {
  id: "fake",
  complete: async () => ({ text: "Haan, logged in hai.", toolCalls: [] }),
};

async function action(source: ReturnType<typeof screenSource>, id: string): Promise<AgentAction> {
  const found = (await source.actions()).find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}

const context = { said: "second video chalao", step: "Play the second video on YouTube" };

describe("screenSource", () => {
  it("clicks the element Jev picks, offering every named element and nothing_fits", async () => {
    const screen = driver(youtube);
    const jev = decider("e2");
    const result = await (await action(screenSource(screen, jev, writer), "screen_click")).run({}, context);
    expect(screen.done).toEqual(["click 2"]);
    expect(screen.hints).toEqual([context.step]);
    expect(Object.keys(jev.asked[0]?.criteria ?? {})).toEqual(["e0", "e1", "e2", "nothing_fits"]);
    expect(result.did).toBe('Clicked "Kesariya - Film Version" in kesariya song - YouTube - Google Chrome');
  });

  it("clicks nothing on a guess, or when nothing fits", async () => {
    for (const jev of [decider("e2", 0.3), decider("nothing_fits", 0.95)]) {
      const screen = driver(youtube);
      const click = await action(screenSource(screen, jev, writer), "screen_click");
      await expect(click.run({}, context)).rejects.toThrow(/Couldn't find that/);
      expect(screen.done).toEqual([]);
    }
  });

  it("reads a window that is still loading again, and stops once it stops changing", async () => {
    const loading: ScreenSnapshot = {
      window: youtube.window,
      elements: [{ id: 9, role: "Text", name: "Loading your chats", editable: false }],
    };
    const screen = driver(youtube);
    const reads = [loading, youtube];
    screen.read = async (hint) => {
      screen.hints.push(hint);
      return reads.shift() ?? youtube;
    };
    await (await action(screenSource(screen, decider("e2"), writer, undefined, 0), "screen_click")).run(
      {},
      context,
    );
    expect(screen.done).toEqual(["click 2"]);

    // Unchanged on the second read: not loading, so no third.
    const settled = driver(youtube);
    const click = await action(
      screenSource(settled, decider("nothing_fits"), writer, undefined, 0),
      "screen_click",
    );
    await expect(click.run({}, context)).rejects.toThrow(/Couldn't find that/);
    expect(settled.hints).toHaveLength(2);
  });

  it("asks the writer when Jev is unsure, and clicks only where both point", async () => {
    const agrees: LlmProvider = { id: "w", complete: async () => ({ text: "e2", toolCalls: [] }) };
    const screen = driver(youtube);
    await (await action(screenSource(screen, decider("e2", 0.3), agrees), "screen_click")).run({}, context);
    expect(screen.done).toEqual(["click 2"]);
  });

  it("does not let the writer overrule a sure nothing_fits", async () => {
    const agrees: LlmProvider = { id: "w", complete: async () => ({ text: "e2", toolCalls: [] }) };
    const screen = driver(youtube);
    const click = await action(screenSource(screen, decider("nothing_fits", 0.9), agrees), "screen_click");
    await expect(click.run({}, context)).rejects.toThrow(/Couldn't find that/);
    expect(screen.done).toEqual([]);
  });

  it("types only into boxes, and offers only boxes", async () => {
    const screen = driver(youtube);
    const jev = decider("e0");
    const type = await action(screenSource(screen, jev, writer), "screen_type");
    await type.run(
      { text: "arijit singh" },
      { said: "search arijit", step: "Type arijit singh in YouTube's search" },
    );
    expect(screen.done).toEqual(["type 0 arijit singh"]);
    expect(Object.keys(jev.asked[0]?.criteria ?? {})).toEqual(["e0", "nothing_fits"]);
  });

  it("answers a question from what is on screen", async () => {
    const read = await action(screenSource(driver(youtube), decider("e0"), writer), "screen_read");
    expect((await read.run({}, context)).answer).toBe("Haan, logged in hai.");
  });
});

describe("clickable", () => {
  it("keeps one element per name, the most clickable, in the window's order", async () => {
    const { clickable } = await import("./screen");
    const page = [
      { id: 0, role: "Text", name: "Kesariya - Brahmastra", editable: false },
      { id: 1, role: "Link", name: "Kesariya - Brahmastra", editable: false },
      { id: 2, role: "Group", name: "Kesariya - Brahmastra", editable: false },
      { id: 3, role: "Text", name: "624M", editable: false },
      { id: 4, role: "Pane", name: "YouTube", editable: false },
      { id: 5, role: "Link", name: "Kesariya - Film Version", editable: false },
      // The same video's second link, worded differently only at the end.
      { id: 6, role: "Link", name: "Kesariya - Film Version | Brahmastra | Ranbir · 4:28", editable: false },
      {
        id: 7,
        role: "Link",
        name: "Kesariya - Film Version | Brahmastra | Ranbir 4 minutes, 28 seconds",
        editable: false,
      },
    ];
    expect(clickable(page).map((element) => element.id)).toEqual([1, 5, 6]);
  });
});

describe("numbered results", () => {
  it("counts only the videos on a page where items carry a running time", async () => {
    const page: ScreenSnapshot = {
      window: "Kesariya - YouTube - Google Chrome",
      elements: [
        { id: 0, role: "Link", name: "Kahani YT. New content available.", editable: false },
        {
          id: 1,
          role: "Link",
          name: "Kesariya - Film Version | Brahmastra 4 minutes, 22 seconds",
          editable: false,
        },
        { id: 2, role: "Link", name: "Kesariya - Brahmastra | Ranbir Kapoor · 2:53", editable: false },
        { id: 3, role: "Link", name: "Deva Deva - Extended Film Version 1 hour, 2 minutes", editable: false },
      ],
    };
    const jev = decider("e1");
    await (await action(screenSource(driver(page), jev, writer), "screen_click")).run({}, context);
    const options = Object.values(jev.asked[0]?.criteria ?? {});
    expect(options).toContain(
      '1st result: Link "Kesariya - Film Version | Brahmastra 4 minutes, 22 seconds"',
    );
    expect(options).toContain('Link "Kahani YT. New content available."');
  });
});
