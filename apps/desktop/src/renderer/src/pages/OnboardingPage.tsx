import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AppInfo } from "../../../shared/ipc";
import { hotkeyLabel } from "../shared/format";
import { HotkeyRecorder } from "../shared/HotkeyRecorder";
import { useSettings } from "../shared/hooks";
import { Button, Select } from "../shared/ui";

const INPUT =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-ink outline-none placeholder:text-faint focus:border-accent";

/**
 * Run once, after the first sign-in: a name to greet them by, and the key they will hold every
 * time. Both have working defaults, so this is two confirmations rather than a form to fill in.
 */
export function OnboardingPage({ info, email }: { info: AppInfo | null; email: string | null }) {
  const [step, setStep] = useState<"name" | "hotkey">("name");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [settings, update] = useSettings();
  const nameField = useRef<HTMLInputElement>(null);

  // The name field is the only thing on this step, so it takes focus.
  useEffect(() => {
    if (step === "name") nameField.current?.focus();
  }, [step]);

  const hotkey = settings?.hotkey ?? info?.hotkeys[0]?.keys ?? "ctrl+win";

  function next(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setProblem("Tell us what to call you.");
      return;
    }
    setProblem(null);
    setStep("hotkey");
  }

  async function finish() {
    setBusy(true);
    try {
      await window.subx.auth.setProfile(name.trim());
      // The window swaps itself out once the account reports itself set up.
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-2">
          <Dot active={step === "name"} done={step === "hotkey"} />
          <Dot active={step === "hotkey"} done={false} />
          <span className="ml-1 text-xs text-faint">{step === "name" ? "Step 1 of 2" : "Step 2 of 2"}</span>
        </div>

        {step === "name" ? (
          <form onSubmit={next}>
            <h1 className="text-[19px] font-semibold tracking-tight">What should we call you?</h1>
            <p className="mt-1 mb-5 text-muted">
              Signed in as <span className="text-ink">{email}</span>.
            </p>

            <label className="block space-y-1.5">
              <span className="font-medium">Name</span>
              <input
                className={INPUT}
                value={name}
                onChange={(event) => setName(event.target.value)}
                ref={nameField}
                placeholder="Bhavesh"
                maxLength={60}
              />
            </label>

            {problem && <p className="mt-2 text-danger">{problem}</p>}

            <Button type="submit" variant="primary" className="mt-5 w-full py-2">
              Continue
            </Button>
          </form>
        ) : (
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight">Pick your dictation key</h1>
            <p className="mt-1 mb-5 text-muted">
              Hold it anywhere to talk, let go to stop. You can change it later in Settings.
            </p>

            {info?.customHotkeys ? (
              <HotkeyRecorder
                value={hotkey}
                presets={info.supportedKeys}
                onChange={(keys) => update({ hotkey: keys })}
              />
            ) : (
              <Select
                label="Hotkey"
                value={hotkey}
                onChange={(value) => update({ hotkey: value })}
                options={(info?.supportedKeys ?? []).map((keys) => ({
                  value: keys,
                  label: hotkeyLabel(keys),
                }))}
              />
            )}

            {problem && <p className="mt-2 text-danger">{problem}</p>}

            <Button variant="primary" onClick={finish} disabled={busy} className="mt-6 w-full py-2">
              {busy ? "One moment…" : `Start dictating with ${hotkeyLabel(hotkey)}`}
            </Button>
            <button
              type="button"
              onClick={() => setStep("name")}
              className="mt-3 w-full text-center text-muted hover:text-ink"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span
      className={`h-1.5 w-8 rounded-full ${active ? "bg-accent" : done ? "bg-accent/40" : "bg-line"}`}
      aria-hidden="true"
    />
  );
}
