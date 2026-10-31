// Relays the dictation websocket to Gnani so the API key never reaches the app.
//
// Gnani has no short-lived tokens — only a long-lived x-api-key-id, sent on the upgrade request —
// and its own docs say to proxy from a backend for exactly this reason. Deno's built-in WebSocket
// cannot set request headers and this runtime has no WebSocketStream, so the upstream leg uses
// npm:ws, which can.
//
// Auth is the platform's: this function is deployed with JWT verification on, so a request only
// reaches the handler with a valid Supabase session.
import WS from "npm:ws@8.18.0";
import { addUsage, secondsOf, usageFor, userIdFrom } from "../_shared/usage.ts";

const GNANI_URL = "wss://api.vachana.ai/stt/v3/stream";

/** Session settings the app chooses. The key is ours and is never taken from the request. */
const FORWARDED = ["x-sample-rate", "language_code", "model", "format", "keyterms"];

Deno.serve(async (request) => {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("This endpoint speaks websocket only.", { status: 426 });
  }

  const apiKey = Deno.env.get("GNANI_API_KEY");
  if (!apiKey) return new Response("Speech-to-text is not configured.", { status: 503 });

  // The gateway has already verified the session; this is only reading whose it is.
  const userId = userIdFrom(request.headers.get("authorization"));
  if (!userId) return new Response("Sign in first.", { status: 401 });

  // Checked before a single frame is forwarded, so an exhausted account costs nothing upstream.
  const usage = await usageFor(userId);
  if (usage.remaining <= 0) {
    return new Response(JSON.stringify({ error: "daily_limit", used: usage.used, limit: usage.limit }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  const headers: Record<string, string> = { "x-api-key-id": apiKey };
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  const { socket: client, response } = Deno.upgradeWebSocket(request);

  let upstream: WS | null = null;
  let upstreamOpen = false;
  // Counted from the audio actually relayed, so it does not depend on the app being honest.
  let audioBytes = 0;
  let recorded = false;

  const record = () => {
    if (recorded) return;
    recorded = true;
    void addUsage(userId, secondsOf(audioBytes));
  };
  // Audio can arrive before Gnani finishes its handshake; holding it is better than dropping the
  // first word of a dictation.
  let backlog: (Uint8Array | string)[] = [];

  let downstream: (string | Uint8Array)[] = [];

  const toClient = (message: string | Uint8Array) => {
    if (client.readyState !== WebSocket.OPEN) {
      downstream.push(message);
      return;
    }
    for (const queued of downstream) client.send(queued);
    downstream = [];
    client.send(message);
  };

  // Opening upstream before the handler returns the upgrade response leaves the client connection
  // broken, so it waits for the client socket to report itself open.
  let started = false;
  const start = () => {
    if (started) return;
    started = true;

    const socket = new WS(GNANI_URL, { headers });
    upstream = socket;

    socket.on("open", () => {
      upstreamOpen = true;
      for (const chunk of backlog) socket.send(chunk);
      backlog = [];
    });

    // Gnani's replies are JSON text, but ws hands every frame over as a Buffer — so the frame's
    // own type decides, not the JavaScript type. Guessing here turns each transcript into binary
    // that the app cannot parse.
    socket.on("message", (data: Buffer, isBinary: boolean) => {
      toClient(isBinary ? new Uint8Array(data) : data.toString("utf8"));
    });

    socket.on("error", (error: Error) => {
      toClient(JSON.stringify({ type: "error", message: `upstream: ${error.message}` }));
      closeClient();
    });

    socket.on("close", () => closeClient());
  };

  // onopen is the only safe trigger: a timer fires before the upgrade has settled and reproduces
  // the broken connection this ordering exists to avoid.
  client.onopen = start;

  client.onmessage = (event) => {
    const data = event.data;
    const frame = typeof data === "string" ? data : new Uint8Array(data as ArrayBuffer);
    if (typeof data !== "string") audioBytes += (data as ArrayBuffer).byteLength;
    if (upstreamOpen && upstream) upstream.send(frame);
    else backlog.push(frame);
  };

  // Written when the dictation ends, however it ends.
  client.onclose = () => {
    record();
    closeUpstream();
  };
  client.onerror = () => {
    record();
    closeUpstream();
  };

  function closeClient() {
    try {
      if (client.readyState === WebSocket.OPEN) client.close(1000);
    } catch {
      // already gone
    }
  }

  function closeUpstream() {
    try {
      upstream?.close();
    } catch {
      // already gone
    }
  }

  return response;
});
