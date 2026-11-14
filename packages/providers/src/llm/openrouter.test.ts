import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterLlm } from "./openrouter";

/**
 * The request body is the whole contract with OpenRouter, and one field in it — which upstream
 * may serve the model — decides whether Hindi comes back converted at all. Cerebras-served
 * gpt-oss-120b hands long input back in Devanagari, so `ignore` reaching the wire is not a
 * detail; losing it silently reintroduces the bug.
 */
function captureBody(reply: unknown = { choices: [{ message: { content: "ok" } }] }) {
  let sent = "";
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    sent = String(init.body);
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  return () => JSON.parse(sent);
}

const llm = (options: Partial<ConstructorParameters<typeof OpenRouterLlm>[0]> = {}) =>
  new OpenRouterLlm({ token: "t", ...options });

const ask = (instance: OpenRouterLlm) =>
  instance.complete({ system: "s", messages: [{ role: "user", content: "क्या कर रहे हो?" }] });

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouterLlm request body", () => {
  it("sends order and ignore together", async () => {
    const body = captureBody();
    await ask(llm({ order: ["groq"], ignore: ["cerebras"] }));
    expect(body().provider).toEqual({ order: ["groq"], ignore: ["cerebras"] });
  });

  it("asks for low reasoning and free text by default, which dictation depends on", async () => {
    const body = captureBody();
    await ask(llm());
    expect(body().reasoning).toEqual({ effort: "low" });
    expect(body()).not.toHaveProperty("response_format");
  });

  it("leaves reasoning out when told to, and asks for JSON when the request does", async () => {
    const body = captureBody();
    await llm({ reasoning: false }).complete({
      system: "s",
      messages: [{ role: "user", content: "x" }],
      json: true,
    });
    expect(body()).not.toHaveProperty("reasoning");
    expect(body().response_format).toEqual({ type: "json_object" });
  });

  it("omits provider routing entirely when nothing is configured", async () => {
    const body = captureBody();
    await ask(llm());
    expect(body()).not.toHaveProperty("provider");
  });

  it("ignores empty arrays rather than sending an empty preference", async () => {
    const body = captureBody();
    await ask(llm({ order: [], ignore: [] }));
    expect(body()).not.toHaveProperty("provider");
  });

  it("falls back to the default model when the configured one is blank", async () => {
    const body = captureBody();
    // .env.example ships OPENROUTER_MODEL with no value; "" is rejected as a model name.
    await ask(llm({ model: "  " }));
    expect(body().model).toBe("openai/gpt-oss-120b");
  });

  it("reports OpenRouter's own reason rather than the status line", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "No models provided" } }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(ask(llm())).rejects.toThrow("No models provided");
  });
});
