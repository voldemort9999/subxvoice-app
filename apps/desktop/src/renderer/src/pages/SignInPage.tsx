import { type FormEvent, useState } from "react";
import { MicIcon } from "../shared/icons";
import { Button } from "../shared/ui";

const INPUT =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none placeholder:text-faint focus:border-accent";

/**
 * The whole account flow: email and a password, and the same form either way. There is no email
 * to confirm and no code to wait for — signing up signs you in.
 */
export function SignInPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "up") await window.subx.auth.signUp(email, password);
      else await window.subx.auth.signIn(email, password);
      // The window swaps itself out when the account state changes; nothing to do here.
    } catch (error) {
      setProblem(readable(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[340px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="var(--accent-ink)"
              aria-hidden="true"
            >
              <path
                d="M4 12h1.5M8 7.5v9M12 4.5v15M16 8.5v7M20 11h-1.5"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </span>
          <h1 className="text-[19px] font-semibold tracking-tight">
            {mode === "in" ? "Sign in to SUBXVoice" : "Create your account"}
          </h1>
          <p className="mt-1 text-muted">Your account unlocks speech-to-text and rewriting.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="font-medium">Email</span>
            <input
              className={INPUT}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-medium">Password</span>
            <input
              className={INPUT}
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "up" ? "At least 8 characters" : ""}
            />
          </label>

          {problem && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
              {problem}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy} className="w-full py-2">
            {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-muted">
          {mode === "in" ? "No account yet? " : "Already have one? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setProblem(null);
            }}
            className="font-medium text-accent hover:underline"
          >
            {mode === "in" ? "Create one" : "Sign in"}
          </button>
        </p>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint">
          <MicIcon className="h-3.5 w-3.5" />
          Recordings stay on this computer.
        </p>
      </div>
    </div>
  );
}

/** Supabase phrases some failures for developers; these are the ones users actually hit. */
function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/already registered|already been registered/i.test(message)) {
    return "That email already has an account. Sign in instead.";
  }
  if (/password/i.test(message) && /least/i.test(message)) return "Use at least 8 characters.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection.";
  return message.replace(/^Error:\s*/, "");
}
