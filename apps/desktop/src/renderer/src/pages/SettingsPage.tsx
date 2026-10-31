import { HotkeyNote, MicrophoneNote, PermissionsIntro } from "@platform/Chrome";
import type { AppInfo } from "../../../shared/ipc";
import { hotkeyLabel } from "../shared/format";
import { HotkeyRecorder } from "../shared/HotkeyRecorder";
import { useAccount, useMicrophones, useSettings } from "../shared/hooks";
import { FolderIcon } from "../shared/icons";
import { PermissionList } from "../shared/PermissionList";
import { Button, Card, Field, Select } from "../shared/ui";

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

      <p className="figure-num px-1 text-xs text-faint">SUBXVoice {info?.version ?? ""}</p>
    </div>
  );
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
