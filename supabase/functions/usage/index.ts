// What the app shows: how much dictation is left today. Read-only, and only ever about the caller.
import { usageFor, userIdFrom } from "../_shared/usage.ts";

Deno.serve(async (request) => {
  const userId = userIdFrom(request.headers.get("authorization"));
  if (!userId) return new Response("Sign in first.", { status: 401 });

  return new Response(JSON.stringify(await usageFor(userId)), {
    headers: { "content-type": "application/json" },
  });
});
