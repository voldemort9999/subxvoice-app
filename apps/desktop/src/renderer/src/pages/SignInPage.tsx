import { type FormEvent, useState } from "react";
import { AuthShell } from "../shared/AuthShell";
import { Button, FIELD, Notice } from "../shared/ui";

/**
 * Real output, not copy written for the screen: Gnani returned the Devanagari and the rewrite
 * returned the Roman — the same pair the website's hero shows.
 */
const HEARD = "कल मीटिंग है तो slides ready रखना please";
const TYPED = "Kal meeting hai toh slides ready rakhna please.";

/**
 * The whole account flow: email and a password, and the same form either way. There is no email
 * to confirm and no code to wait for — signing up signs you in.
 */
export function SignInPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Caught here rather than at the server, which only ever sees one of the two.
  const mismatch = mode === "up" && confirm.length > 0 && password !== confirm;

  function switchTo(next: "in" | "up") {
    setMode(next);
    setProblem(null);
    setConfirm("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "up" && password !== confirm) {
      setProblem("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      // Either way the window swaps itself out when the account state changes; nothing to do here.
      if (mode === "up") await window.subx.auth.signUp(email, password);
      else await window.subx.auth.signIn(email, password);
    } catch (error) {
      setProblem(readable(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      aside={
        <figure className="m-0">
          <p className="spoken text-side-soft">{HEARD}</p>
          <p className="mt-4 border-l-[3px] border-marigold pl-4 text-[21px] leading-snug font-medium">
            {TYPED}
          </p>
          <figcaption className="mt-6 text-xs text-side-soft">
            Heard in Devanagari, typed in Roman letters, in the app you were already using.
          </figcaption>
        </figure>
      }
    >
      <h1 className="text-[28px]">{mode === "in" ? "Sign in" : "Create your account"}</h1>
      <p className="mt-2 mb-7 text-ink-soft">Your account unlocks speech-to-text and rewriting.</p>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="font-semibold">Email</span>
          <input
            className={FIELD}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="font-semibold">Password</span>
          <input
            className={FIELD}
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "up" ? "At least 8 characters" : ""}
          />
        </label>

        {mode === "up" && (
          <label className="block space-y-1.5">
            <span className="font-semibold">Confirm password</span>
            <input
              className={`${FIELD} ${mismatch ? "border-ink" : ""}`}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Type it again"
              aria-invalid={mismatch}
            />
            {mismatch && (
              <span className="block font-medium text-accent-ink">The two passwords don't match.</span>
            )}
          </label>
        )}

        {problem && <Notice role="alert">{problem}</Notice>}

        <Button type="submit" variant="primary" disabled={busy || mismatch} className="w-full py-2.5">
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-ink-soft">
        {mode === "in" ? "No account yet? " : "Already have one? "}
        <button
          type="button"
          onClick={() => switchTo(mode === "in" ? "up" : "in")}
          className="font-semibold text-ink underline decoration-marigold decoration-2 underline-offset-[3px]"
        >
          {mode === "in" ? "Create one" : "Sign in"}
        </button>
      </p>

      <p className="mt-10 text-xs text-ink-faint">Recordings stay on this computer.</p>
    </AuthShell>
  );
}

/** Supabase phrases some failures for developers; these are the ones users actually hit. */
function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // The server gives the same answer for a wrong password and for an email with no account, and
  // a first-time user is far more often the second. So the message names both possibilities.
  if (/invalid login credentials/i.test(message)) {
    return "No account matches that email and password. Check both, or create an account below.";
  }
  if (/email not confirmed/i.test(message)) return "Confirm your email first, then sign in.";
  if (/already registered|already been registered/i.test(message)) {
    return "That email already has an account. Sign in instead.";
  }
  if (/password/i.test(message) && /least/i.test(message)) return "Use at least 8 characters.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection.";
  return message.replace(/^Error:\s*/, "");
}
