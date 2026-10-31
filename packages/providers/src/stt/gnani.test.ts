import { afterEach, describe, expect, it } from "vitest";
import { GNANI_STT_URL, GnaniStt, headerSafeTerms, isGnaniFormat, isGnaniLanguage, toLocale } from "./gnani";

describe("Gnani config validation", () => {
  it("accepts the service's locales and rejects anything else", () => {
    expect(isGnaniLanguage("hi-IN")).toBe(true);
    expect(isGnaniLanguage("en-IN")).toBe(true);
    // The service takes one locale: a list and auto-detection are both rejected here, because
    // "indic-auto" guesses from the audio and picked Telugu on a Hindi-English clip.
    expect(isGnaniLanguage("hi-IN,en-IN")).toBe(false);
    expect(isGnaniLanguage("indic-auto")).toBe(false);
    expect(isGnaniLanguage("hi")).toBe(false);
    expect(isGnaniLanguage("")).toBe(false);
  });

  it("accepts the four output styles", () => {
    expect(isGnaniFormat("verbatim")).toBe(true);
    expect(isGnaniFormat("transliterate")).toBe(true);
    expect(isGnaniFormat("romanise")).toBe(false);
  });

  it("fills in the region a bare language code is missing", () => {
    expect(toLocale("hi")).toBe("hi-IN");
    expect(toLocale("TA")).toBe("ta-IN");
    expect(toLocale("hi-IN")).toBe("hi-IN");
    // Unsupported languages fall back rather than sending a header the service would reject.
    expect(toLocale("fr")).toBe("hi-IN");
  });
});

describe("dictionary terms going into an HTTP header", () => {
  it("keeps plain terms", () => {
    expect(headerSafeTerms(["Bhavesh", "OJT", "viva"])).toEqual(["Bhavesh", "OJT", "viva"]);
  });

  it("drops what the upgrade request cannot carry", () => {
    expect(
      headerSafeTerms([
        "भावेश", // above U+00FF: makes the WebSocket constructor throw outright
        "a,b", // the comma is the term separator
        "bad\r\nX-Evil: 1", // header injection
        "  ", // empty after trimming
        "café", // latin-1, so this one is fine
      ]),
    ).toEqual(["café"]);
  });
});

/** Stands in for the global WebSocket so the protocol can be driven without a network. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static last: FakeSocket | null = null;

  readyState = FakeSocket.OPEN;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; wasClean: boolean }) => void) | null = null;

  /** Everything the provider sent, binary frames and JSON control messages alike. */
  readonly sent: (Uint8Array | string)[] = [];

  constructor(
    readonly url: string,
    readonly init: { headers: Record<string, string> },
  ) {
    FakeSocket.last = this;
  }

  send(payload: Uint8Array | string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = FakeSocket.CLOSED;
  }

  /** Deliver a server message, the way the real socket would. */
  deliver(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  frames(): Uint8Array[] {
    return this.sent.filter((p): p is Uint8Array => typeof p !== "string");
  }

  controls(): string[] {
    return this.sent.filter((p): p is string => typeof p === "string");
  }
}

const realWebSocket = globalThis.WebSocket;

function install(): void {
  (globalThis as { WebSocket: unknown }).WebSocket = FakeSocket;
}

afterEach(() => {
  (globalThis as { WebSocket: unknown }).WebSocket = realWebSocket;
  FakeSocket.last = null;
});

/** The token is resolved before the socket is built, so the fake needs a turn to appear. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Opens a stream and hands back the socket the provider built. */
async function open(vocabulary: string[] = []) {
  install();
  const stt = new GnaniStt({ token: "vach_test" });
  const streamPromise = stt.startStream({ vocabulary }, 16000);
  await tick();
  // ready() resolves on `connected`, which is the service's handshake reply.
  FakeSocket.last?.deliver({ type: "connected", config: { sample_rate: 16000, chunk_size: 512 } });
  const stream = await streamPromise;
  const socket = FakeSocket.last as FakeSocket;
  return { stream, socket };
}

describe("GnaniStt session setup", () => {
  it("puts the key and the whole config on the upgrade request", async () => {
    const { socket } = await open(["Bhavesh", "वाइवा"]);
    expect(socket.url).toBe(GNANI_STT_URL);
    expect(socket.init.headers["x-api-key-id"]).toBe("vach_test");
    expect(socket.init.headers.language_code).toBe("hi-IN");
    expect(socket.init.headers.model).toBe("prisma-v3.0");
    expect(socket.init.headers["x-sample-rate"]).toBe("16000");
    // The Devanagari term is dropped, not sent: it would throw inside the constructor.
    expect(socket.init.headers.keyterms).toBe("Bhavesh");
  });

  it("refuses a sample rate the service cannot transcribe", async () => {
    install();
    const stt = new GnaniStt({ token: "vach_test" });
    await expect(stt.startStream({ vocabulary: [] }, 22050)).rejects.toThrow(/22050 Hz/);
  });

  it("needs a token", () => {
    expect(() => new GnaniStt({ token: "" })).toThrow(/token/);
  });
});

describe("credentials", () => {
  it("sends the session, not a vendor key, when it goes through our backend", async () => {
    install();
    const stt = new GnaniStt({ token: "jwt-abc", viaBackend: true, baseUrl: "wss://backend/stt" });
    const streaming = stt.startStream({ vocabulary: [] }, 16000);
    await tick();
    const socket = FakeSocket.last as FakeSocket;
    socket.deliver({ type: "connected", config: {} });
    await streaming;

    expect(socket.url).toBe("wss://backend/stt");
    expect(socket.init.headers.Authorization).toBe("Bearer jwt-abc");
    // The app has no Gnani key to send, and must not invent one.
    expect(socket.init.headers["x-api-key-id"]).toBeUndefined();
  });

  it("asks for the token again for every dictation, because sessions expire", async () => {
    install();
    let issued = 0;
    const stt = new GnaniStt({ token: () => `jwt-${++issued}`, viaBackend: true });

    for (const expected of ["Bearer jwt-1", "Bearer jwt-2"]) {
      const streaming = stt.startStream({ vocabulary: [] }, 16000);
      await tick();
      const socket = FakeSocket.last as FakeSocket;
      socket.deliver({ type: "connected", config: {} });
      await streaming;
      expect(socket.init.headers.Authorization).toBe(expected);
    }
    expect(issued).toBe(2);
  });
});

describe("GnaniStt audio framing", () => {
  it("sends fixed 1024-byte frames whatever the mic chunk size", async () => {
    const { stream, socket } = await open();
    // 700 samples = 1400 bytes: one full frame, with 376 bytes carried over.
    stream.push(new Int16Array(700));
    expect(socket.frames()).toHaveLength(1);
    expect(socket.frames()[0]?.byteLength).toBe(1024);

    // 324 more samples (648 bytes) completes a second frame exactly.
    stream.push(new Int16Array(324));
    expect(socket.frames()).toHaveLength(2);
    expect(socket.frames()[1]?.byteLength).toBe(1024);
  });

  it("pads the final part-frame instead of dropping the tail", async () => {
    const { stream, socket } = await open();
    stream.push(new Int16Array(100)); // 200 bytes: not a whole frame on its own
    expect(socket.frames()).toHaveLength(0);

    await stream.finish();
    const frames = socket.frames();
    expect(frames).toHaveLength(1);
    expect(frames[0]?.byteLength).toBe(1024);
  });

  it("holds audio recorded before the handshake and flushes it on connect", async () => {
    install();
    const stt = new GnaniStt({ token: "vach_test" });
    const streamPromise = stt.startStream({ vocabulary: [] }, 16000);
    await tick();
    const socket = FakeSocket.last as FakeSocket;

    // The mic starts with the key-down, which can beat the handshake.
    expect(socket.frames()).toHaveLength(0);
    socket.deliver({ type: "connected", config: {} });
    const stream = await streamPromise;
    stream.push(new Int16Array(512));
    expect(socket.frames()).toHaveLength(1);
  });
});

describe("GnaniStt finishing", () => {
  it("assembles the utterances the service closed while the user spoke", async () => {
    const { stream, socket } = await open();
    socket.deliver({ type: "speech_start", utterance_id: "u1" });
    socket.deliver({
      type: "transcript",
      utterance_id: "u1",
      text: "Hi, मेरा नाम भावेश है।",
      detected_language_code: "hi-IN",
    });
    socket.deliver({ type: "speech_start", utterance_id: "u2" });
    socket.deliver({
      type: "transcript",
      utterance_id: "u2",
      text: "aur main viva de raha hoon.",
      detected_language_code: "en-IN",
    });

    expect(stream.partial()).toBe("Hi, मेरा नाम भावेश है। aur main viva de raha hoon.");
    const transcript = await stream.finish();
    expect(transcript.text).toBe("Hi, मेरा नाम भावेश है। aur main viva de raha hoon.");
    // Bare codes, as the Transcript contract specifies.
    expect(transcript.languages).toEqual(["hi", "en"]);
    expect(socket.controls()).toContain(JSON.stringify({ type: "commit" }));
  });

  it("waits for the utterance still open when the hotkey comes up", async () => {
    const { stream, socket } = await open();
    socket.deliver({ type: "speech_start", utterance_id: "u1" });

    let settled = false;
    const finishing = stream.finish().then((t) => {
      settled = true;
      return t;
    });
    await Promise.resolve();
    expect(settled).toBe(false); // the last phrase has not arrived yet

    socket.deliver({ type: "transcript", utterance_id: "u1", text: "the last phrase" });
    expect((await finishing).text).toBe("the last phrase");
  });

  it("returns straight away when the service has nothing left to flush", async () => {
    const { stream, socket } = await open();
    socket.deliver({ type: "speech_start", utterance_id: "u1" });
    socket.deliver({ type: "transcript", utterance_id: "u1", text: "all done" });

    // A commit with no open utterance gets no reply at all, so finish() must not wait on one —
    // otherwise every dictation that ended in a pause would stall until the timeout.
    const transcript = await Promise.race([
      stream.finish(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("finish() stalled")), 200)),
    ]);
    expect(transcript.text).toBe("all done");
  });

  it("collects every segment of a clip handed over in one go", async () => {
    install();
    const stt = new GnaniStt({ token: "vach_test" });
    // The batch path pushes the whole clip and commits at once, so the service has not reached the
    // audio yet and no utterance is open. Returning on the first transcript would drop the rest.
    const transcribing = stt.transcribe(
      { samples: new Int16Array(16000), sampleRate: 16000 },
      { vocabulary: [] },
    );
    await tick();
    const socket = FakeSocket.last as FakeSocket;
    socket.deliver({ type: "connected", config: {} });
    await tick();

    socket.deliver({ type: "speech_start", utterance_id: "u1" });
    socket.deliver({ type: "transcript", utterance_id: "u1", text: "first part" });
    socket.deliver({ type: "speech_start", utterance_id: "u2" });
    socket.deliver({ type: "transcript", utterance_id: "u2", text: "second part" });

    expect((await transcribing).text).toBe("first part second part");
  }, 10000);

  it("reports a service error rather than returning empty text", async () => {
    const { stream, socket } = await open();
    socket.deliver({ type: "error", message: "Invalid language_code" });
    await expect(stream.finish()).rejects.toThrow(/Invalid language_code/);
  });

  it("keeps what it heard when the socket dies mid-dictation", async () => {
    const { stream, socket } = await open();
    socket.deliver({ type: "speech_start", utterance_id: "u1" });
    socket.deliver({ type: "transcript", utterance_id: "u1", text: "heard this much" });
    socket.readyState = FakeSocket.CLOSED;
    socket.onclose?.({ code: 1006, wasClean: false });

    // A dropped connection must not lose a dictation that was already recognised.
    expect((await stream.finish()).text).toBe("heard this much");
  });
});
