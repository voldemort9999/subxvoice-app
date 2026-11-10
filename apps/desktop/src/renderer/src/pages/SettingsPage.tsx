import { HotkeyNote, MicrophoneNote, PermissionsIntro } from "@platform/Chrome";
import type { WritingTone } from "@subx/core";
import type { AppInfo, UpdateState } from "../../../shared/ipc";
import { hotkeyLabel } from "../shared/format";
import { HotkeyRecorder } from "../shared/HotkeyRecorder";
import { useAccount, useMicrophones, useSettings, useUpdate } from "../shared/hooks";
import { FolderIcon } from "../shared/icons";
import { PermissionList } from "../shared/PermissionList";
import { TONE_OPTIONS } from "../shared/tones";
import { Button, Card, Field, Select, Toggle } from "../shared/ui";

const SCRIPTS = [
  {
    value: "native",
    label: "The language's own script",
    hint: "Hindi is written in Devanagari — मैं ठीक हूँ",
  },
  {
    value: "roman",
    label: "Roman letters",
    hint: "Hindi is spelled out in English letters — main theek hoon",
  },
];

export function SettingsPage({ info }: { info: AppInfo | null }) {
  const [settings, update] = useSettings();
  const microphones = useMicrophones();
  const account = useAccount();
  const update$ = useUpdate();
  const hotkey = settings?.hotkey ?? info?.hotkeys[0]?.keys ?? "";

  return (
    <div className="space-y-6">
      <Card title="Dictation">
        <Field
          label="Hotkey"
          hint="Hold to dictate, let go to stop. Press any other key while holding to cancel."
        >
          {info?.customHotkeys ? (
            <HotkeyRecorder
              value={hotkey}
              presets={info.supportedKeys}
              onChange={(keys) => update({ hotkey: keys })}
            />
          ) : (
            // macOS watches a fixed set of keys, so there is a list to pick from instead.
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
          <div className="mt-2 text-xs text-muted">
            <HotkeyNote />
          </div>
        </Field>

        <Field
          label="Written as"
          hint="How languages that don't use Latin letters are written down. Your words are never translated."
        >
          <Select
            label="Written as"
            value={settings?.script ?? "native"}
            onChange={(value) => update({ script: value === "roman" ? "roman" : "native" })}
            options={SCRIPTS}
          />
          {info && !info.providers.llm && settings?.script === "roman" && (
            <p className="mt-2 text-warn">Roman letters need OPENROUTER_API_KEY. See Engines below.</p>
          )}
        </Field>

        <Field label="Microphone" hint={`Used while you hold ${hotkeyLabel(hotkey)}.`}>
          {/* With a native mic (Mac) the system input device is used, so the picker would do nothing. */}
          {info && !info.nativeMicrophone && (
            <Select
              label="Microphone"
              value={settings?.microphoneId ?? ""}
              onChange={(value) => update({ microphoneId: value })}
              options={[
                { value: "", label: "System default" },
                ...microphones.map((option) => ({ value: option.id, label: option.label })),
              ]}
              empty="No microphone found. Allow microphone access, then reopen this page."
            />
          )}
          <div className="mt-2 text-xs text-muted">
            <MicrophoneNote />
          </div>
        </Field>
      </Card>

      <Card title="Startup">
        <Field
          label="Open at login"
          hint="SUBXVoice starts in the background when you sign in to Windows, ready for the hotkey."
        >
          <Toggle
            label="Open SUBXVoice at login"
            checked={settings?.launchAtLogin ?? false}
            onChange={(checked) => update({ launchAtLogin: checked })}
          />
        </Field>
      </Card>

      <Card title="Writing">
        <p className="mb-4 max-w-xl text-muted">
          Ask out loud for an email or a message — “write a mail to my manager about tomorrow's leave” — and
          SUBXVoice writes it instead of typing what you said. Everything else is dictated exactly as spoken.
        </p>
        <Field
          label="Email tone"
          hint="Used when you ask for an email. Emails are always written in English, whatever language you asked in."
        >
          <Select
            label="Email tone"
            value={settings?.emailTone ?? "professional"}
            onChange={(value) => update({ emailTone: value as WritingTone })}
            options={TONE_OPTIONS.map((tone) => ({ value: tone.value, label: tone.label }))}
          />
        </Field>
        <Field
          label="Message tone"
          hint="Used for WhatsApp, SMS and chat replies. Messages stay in the language you spoke."
        >
          <Select
            label="Message tone"
            value={settings?.messageTone ?? "casual"}
            onChange={(value) => update({ messageTone: value as WritingTone })}
            options={TONE_OPTIONS.map((tone) => ({ value: tone.value, label: tone.label }))}
          />
        </Field>
        <p className="mt-1 text-xs text-faint">
          {TONE_OPTIONS.map((tone) => `${tone.label} — ${tone.hint}`).join("   ·   ")}
        </p>
      </Card>

      <Card title="Permissions">
        <div className="mb-3">
          <PermissionsIntro />
        </div>
        <PermissionList />
      </Card>

      <Card title="Account">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{account?.email ?? "Not signed in"}</p>
            <p className="mt-0.5 text-xs text-muted">
              Speech-to-text and rewriting run on your account. No API keys are stored on this computer.
            </p>
          </div>
          <Button onClick={() => window.subx.auth.signOut()}>Sign out</Button>
        </div>
        <div className="mt-4 space-y-2.5 border-t border-line-soft pt-3.5">
          <EngineStatus ready={info?.providers.stt} name="Speech to text" />
          <EngineStatus ready={info?.providers.llm} name="Rewriting and Roman script" />
        </div>
      </Card>

      <Card title="Recordings">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-muted">
            Audio and transcripts are saved only on this computer. Delete any of them from History.
          </p>
          <Button onClick={() => window.subx.app.openRecordingsFolder()}>
            <span className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              Open recordings folder
            </span>
          </Button>
        </div>
      </Card>

      <Card title="Updates">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="figure-num font-medium">SUBXVoice {info?.version ?? ""}</p>
            <p className="mt-0.5 text-xs text-muted">
              <UpdateLine state={update$} />
            </p>
          </div>
          <UpdateAction state={update$} />
        </div>
      </Card>
    </div>
  );
}

/** Says what the updater is doing, in the one line someone glances at to answer "am I current?". */
function UpdateLine({ state }: { state: UpdateState | null }) {
  if (!state) return <>Checking…</>;
  switch (state.kind) {
    case "checking":
      return <>Checking for updates…</>;
    case "current":
      return <>Up to date, checked {timeAgo(state.checkedAt)}.</>;
    case "downloading":
      return (
        <>
          Downloading {state.version} — {state.percent}%
        </>
      );
    case "ready":
      return <>Version {state.version} is ready. It installs when you quit, or restart now.</>;
    case "error":
      // The reason is shown rather than swallowed: a silent updater is one nobody can debug.
      return <span className="text-warn">Could not check for updates — {state.message}</span>;
    case "unsupported":
      return <>{state.reason}</>;
    default:
      return <>Updates are installed automatically.</>;
  }
}

function UpdateAction({ state }: { state: UpdateState | null }) {
  if (state?.kind === "ready") {
    return <Button onClick={() => window.subx.update.install()}>Restart and install</Button>;
  }
  const busy = state?.kind === "checking" || state?.kind === "downloading";
  if (state?.kind === "unsupported") return null;
  return (
    <Button disabled={busy} onClick={() => void window.subx.update.check()}>
      {busy ? "Checking…" : "Check for updates"}
    </Button>
  );
}

function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function EngineStatus({ ready, name }: { ready: boolean | undefined; name: string }) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-speech" : "bg-warn"}`}
        aria-hidden="true"
      />
      <span className="font-medium">{name}</span>
      <span className="text-muted">{ready ? "ready" : "unavailable"}</span>
    </p>
  );
}
