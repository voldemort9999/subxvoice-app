import { HotkeyNote, MicrophoneNote, PermissionsIntro } from "@platform/Chrome";
import type { AppInfo } from "../../../shared/ipc";
import { Choice } from "../shared/Choice";
import { hotkeyLabel } from "../shared/format";
import { useMicrophones, useSettings } from "../shared/hooks";
import { FolderIcon } from "../shared/icons";
import { PermissionList } from "../shared/PermissionList";
import { Button, Card, Field } from "../shared/ui";

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
  const hotkey = hotkeyLabel(info?.hotkeys[0]?.keys);

  return (
    <div className="space-y-6">
      <Card title="Dictation">
        <Field
          label="Hotkey"
          hint={<>Hold to dictate, let go to stop. Press any other key while holding to cancel.</>}
        >
          <Choice
            name="hotkey"
            value={settings?.hotkey ?? ""}
            onChange={(value) => update({ hotkey: value })}
            options={(info?.supportedKeys ?? []).map((keys) => ({ value: keys, label: hotkeyLabel(keys) }))}
          />
          <div className="mt-2 text-muted">
            <HotkeyNote />
          </div>
        </Field>

        <Field
          label="Written as"
          hint="How languages that don't use Latin letters are written down. Your words are never translated."
        >
          <Choice
            name="script"
            value={settings?.script ?? "native"}
            onChange={(value) => update({ script: value === "roman" ? "roman" : "native" })}
            options={SCRIPTS}
          />
          {info && !info.providers.llm && settings?.script === "roman" && (
            <p className="mt-2 text-warn">Roman letters need OPENROUTER_API_KEY. See Engines below.</p>
          )}
        </Field>

        <Field label="Microphone" hint={`Used while you hold ${hotkey}.`}>
          {/* With a native mic (Mac) the system input device is used, so the picker would do nothing. */}
          {info && !info.nativeMicrophone && (
            <Choice
              name="microphone"
              value={settings?.microphoneId ?? ""}
              onChange={(value) => update({ microphoneId: value })}
              options={[
                { value: "", label: "System default" },
                ...microphones.map((option) => ({ value: option.id, label: option.label })),
              ]}
              empty="No microphone found. Allow microphone access, then reopen this page."
            />
          )}
          <div className="mt-2 text-muted">
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

      <Card title="Engines">
        <div className="space-y-2.5">
          <EngineStatus ready={info?.providers.stt} name="Speech to text" env="GNANI_API_KEY" />
          <EngineStatus
            ready={info?.providers.llm}
            name="Rewriting and Roman script"
            env="OPENROUTER_API_KEY"
          />
        </div>
        <p className="mt-3 text-xs text-faint">
          Keys are read from <code className="text-muted">.env</code> at the repo root while the backend is
          being built. Restart the app after changing them.
        </p>
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

function EngineStatus({ ready, name, env }: { ready: boolean | undefined; name: string; env: string }) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${ready ? "bg-speech" : "bg-warn"}`}
        aria-hidden="true"
      />
      <span className="font-medium">{name}</span>
      <span className="text-muted">{ready ? "ready" : `off — set ${env}`}</span>
    </p>
  );
}
