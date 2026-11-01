import { randomUUID } from "node:crypto";
import { existsSync, renameSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type DictionaryEntry,
  type HotkeyBinding,
  type PermissionKind,
  Pipeline,
  SubxError,
} from "@subx/core";
import { app, BrowserWindow, ipcMain, Menu, shell, type Tray } from "electron";
import {
  type AppInfo,
  type AppSettings,
  IPC,
  type MicrophoneOption,
  type PermissionStatus,
} from "../shared/ipc";
import { Account } from "./auth";
import { appIcon } from "./brand";
import { DictationController } from "./dictation";
import { nativeMic, PillMic } from "./mic";
import { PillWindow } from "./pill";
import { createPlatform } from "./platform";
import { createEngines, loadDevEnv } from "./providers";
import { deleteRecording, recordingsDir, saveRecording, setRecordingsDir } from "./recordings";
import { loadPage, PRELOAD_PATH } from "./renderer";
import { JsonDictionaryStore, JsonHistoryStore, JsonSettingsStore } from "./stores";
import { createTray } from "./tray";
import { checkForUpdate, installUpdate, startUpdater, updateState } from "./updater";
import { createWorkflow } from "./workflow";

const HOTKEY_RETRY_MS = 3000;

/** Everything this app writes under userData. Chromium's own files are not ours to move. */
const APP_DATA = [
  "accounts",
  "recordings",
  "settings.json",
  "history.json",
  "dictionary.json",
  "session.bin",
];

/**
 * Carries a 0.1.0 install's data to the renamed userData folder.
 *
 * package.json had no productName until 0.1.1, so both Windows-facing names fell back to the
 * package name: the app installed into `Programs\@subxdesktop` and kept everything under
 * `AppData\Roaming\@subx\desktop`. Naming the product moved userData, which would otherwise
 * leave an upgrading install empty and signed out.
 *
 * Electron creates userData before this file runs, so the folder already existing says nothing —
 * each entry is moved only when it is genuinely missing at the new location.
 */
function migrateUserData(): void {
  const previous = join(app.getPath("appData"), "@subx", "desktop");
  if (!existsSync(previous)) return;
  const current = app.getPath("userData");
  for (const name of APP_DATA) {
    const from = join(previous, name);
    const to = join(current, name);
    if (!existsSync(from) || existsSync(to)) continue;
    try {
      renameSync(from, to);
    } catch (error) {
      // Not fatal: the app still opens, just without that piece. Refusing to start would be
      // worse, and nothing has been deleted — the old folder is still there to recover from.
      console.error(`Could not move ${name} from the old data folder:`, error);
    }
  }
}
migrateUserData();

loadDevEnv();
const platform = createPlatform();
// Built in start(), because the account they depend on needs the app to be ready first.
let account: Account;
let engines: ReturnType<typeof createEngines> = { problems: [] };
/** Reported by the renderer, which is the only side with MediaDevices. */
let microphones: MicrophoneOption[] = [];
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null; // kept in a variable so it isn't garbage-collected

/** True when Windows launched us at login (see the login item's args). */
const startedHidden = () => process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAtLogin;

function openMainWindow(): void {
  if (process.platform === "darwin") app.focus({ steal: true });
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 680,
    // Without this the taskbar and Alt-Tab show Electron's own icon.
    icon: appIcon(),
    minWidth: 760,
    minHeight: 520,
    show: false,
    titleBarStyle: platform.os === "mac" ? "hiddenInset" : "default",
    webPreferences: { preload: PRELOAD_PATH, sandbox: true, contextIsolation: true },
  });
  mainWindow.on("ready-to-show", () => mainWindow?.show());
  // Destroyed on close (not hidden) so the app stays light while it runs in the background.
  // The pill and the tray icon keep the app running; quit from the tray menu.
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  loadPage(mainWindow, "index.html");
}

function notifyHistoryChanged(): void {
  mainWindow?.webContents.send(IPC.historyChanged);
}

/** Credentials arrive from the renderer, so they are checked before they reach the network. */
function asText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 320) {
    throw new Error(`Enter a valid ${field}.`);
  }
  return value.trim();
}

function assertPermissionKind(kind: unknown): PermissionKind {
  if (!platform.permissions.required().includes(kind as PermissionKind)) {
    throw new Error(`Unknown permission: ${String(kind)}`);
  }
  return kind as PermissionKind;
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error(`Invalid ${name}`);
  return value.trim();
}

function assertDictionaryEntry(value: unknown): DictionaryEntry {
  const entry = value as Partial<DictionaryEntry> | null;
  const misheardAs = Array.isArray(entry?.misheardAs) ? entry.misheardAs : [];
  return {
    word: assertString(entry?.word, "word"),
    misheardAs: misheardAs.filter((item): item is string => typeof item === "string" && !!item.trim()),
  };
}

/** Settings arrive from the renderer, so every field is checked before it is stored. */
function assertSettings(value: unknown, accepts: (keys: string) => boolean): Partial<AppSettings> {
  const input = (value ?? {}) as Partial<AppSettings>;
  const patch: Partial<AppSettings> = {};
  if (typeof input.hotkey === "string") {
    if (!accepts(input.hotkey)) throw new Error(`Unsupported hotkey: ${input.hotkey}`);
    patch.hotkey = input.hotkey;
  }
  if (input.script === "native" || input.script === "roman") patch.script = input.script;
  if (typeof input.launchAtLogin === "boolean") patch.launchAtLogin = input.launchAtLogin;
  if (typeof input.microphoneId === "string" && input.microphoneId.length <= 200) {
    patch.microphoneId = input.microphoneId;
  }
  return patch;
}

async function start(): Promise<void> {
  const dataDir = app.getPath("userData");
  await mkdir(dataDir, { recursive: true });

  account = new Account();
  // Signing in once should last; a session that no longer refreshes just asks again.
  await account.restore();
  engines = createEngines(account);
  // Transcripts, dictionary and audio belong to the person signed in, not to the machine. They
  // live in a folder named after the account so the next person to sign in starts empty.
  let accountDir = join(dataDir, "accounts", "signed-out");
  const history = new JsonHistoryStore(() => join(accountDir, "history.json"));
  const dictionary = new JsonDictionaryStore(() => join(accountDir, "dictionary.json"));

  const switchAccountData = async (userId: string | null) => {
    accountDir = join(dataDir, "accounts", userId ?? "signed-out");
    await mkdir(accountDir, { recursive: true });
    setRecordingsDir(join(accountDir, "recordings"));
    history.forget();
    dictionary.forget();
  };

  // Point at the restored account's folder before anything reads from it.
  await switchAccountData((await account.state()).id);

  // Settings stay with the machine: the hotkey, microphone and startup choice describe this
  // computer, not the person.
  const settings = new JsonSettingsStore<AppSettings>(() => join(dataDir, "settings.json"), {
    hotkey: platform.hotkey.defaultBindings()[0]?.keys ?? "",
    script: "roman",
    microphoneId: "",
    launchAtLogin: false,
  });

  /**
   * Mirrored to the OS rather than stored only by us: the user can also turn it off in Windows
   * Settings, and whatever they did there last is the truth.
   */
  const applyLaunchAtLogin = (openAtLogin: boolean) => {
    if (!app.isPackaged) return; // dev runs from electron.exe, which is not what would autostart
    app.setLoginItemSettings({
      openAtLogin,
      // Started this way the app belongs in the tray, not in front of whatever the user opened.
      args: ["--hidden"],
    });
  };
  applyLaunchAtLogin((await settings.all()).launchAtLogin);

  const bindings = async (): Promise<HotkeyBinding[]> => {
    const { hotkey } = await settings.all();
    // settings.json is a file the user can edit, so a stored hotkey is re-checked every time.
    if (!hotkey || !platform.hotkey.accepts(hotkey)) return platform.hotkey.defaultBindings();
    return [{ keys: hotkey, mode: "exact" }];
  };

  ipcMain.handle(IPC.authState, () => account.state());
  ipcMain.handle(IPC.authSignIn, (_event, email: unknown, password: unknown) =>
    account.signIn(asText(email, "email"), asText(password, "password")),
  );
  ipcMain.handle(IPC.authSignUp, (_event, email: unknown, password: unknown) =>
    account.signUp(asText(email, "email"), asText(password, "password")),
  );
  ipcMain.handle(IPC.authSignOut, () => account.signOut());
  ipcMain.handle(IPC.authUsage, () => account.usage());
  ipcMain.handle(IPC.authSetProfile, (_event, name: unknown) => account.setProfile(asText(name, "name")));
  account.onChanged((state) => {
    // Switching accounts switches the data with it, and signing out puts it out of reach.
    void switchAccountData(state.id).then(() => notifyHistoryChanged());
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.authChanged, state);
    }
  });

  ipcMain.handle(
    IPC.appInfo,
    async (): Promise<AppInfo> => ({
      version: app.getVersion(),
      hotkeys: await bindings(),
      supportedKeys: platform.hotkey.supportedKeys(),
      // Windows watches any combination; macOS only the fixed set, so Settings offers a list there.
      customHotkeys: platform.hotkey.accepts("ctrl+shift+f9"),
      providers: { stt: !!engines.stt, llm: !!engines.llm },
      nativeMicrophone: !!platform.microphone,
    }),
  );
  ipcMain.handle(IPC.openRecordingsFolder, async () => {
    await mkdir(recordingsDir(), { recursive: true });
    await shell.openPath(recordingsDir());
  });

  ipcMain.handle(IPC.permissionList, async (): Promise<PermissionStatus[]> => {
    const kinds = platform.permissions.required();
    return Promise.all(kinds.map(async (kind) => ({ kind, state: await platform.permissions.status(kind) })));
  });
  ipcMain.handle(IPC.permissionRequest, (_event, kind: unknown) =>
    platform.permissions.request(assertPermissionKind(kind)),
  );
  ipcMain.handle(IPC.permissionOpenSettings, (_event, kind: unknown) =>
    platform.permissions.openSettings(assertPermissionKind(kind)),
  );

  ipcMain.handle(IPC.historyList, () => history.recent(Number.MAX_SAFE_INTEGER));
  ipcMain.handle(IPC.historyAudio, async (_event, id: unknown) => {
    const record = await history.find(assertString(id, "id"));
    if (!record?.audioPath) throw new Error("This recording has no audio");
    return readFile(record.audioPath);
  });
  ipcMain.handle(IPC.historyRemove, async (_event, id: unknown) => {
    const record = await history.find(assertString(id, "id"));
    if (!record) return;
    if (record.audioPath) await deleteRecording(record.audioPath);
    await history.remove(record.id);
    notifyHistoryChanged();
  });

  ipcMain.handle(IPC.dictionaryList, () => dictionary.all());
  ipcMain.handle(IPC.dictionaryUpsert, (_event, entry: unknown) =>
    dictionary.upsert(assertDictionaryEntry(entry)),
  );
  ipcMain.handle(IPC.dictionaryRemove, (_event, word: unknown) =>
    dictionary.remove(assertString(word, "word")),
  );

  const pill = new PillWindow();
  // Native mic when the OS plug has one (Mac: Swift helper); otherwise Web Audio in the pill.
  const pillMic = new PillMic(pill);
  const mic = platform.microphone ? nativeMic(platform.microphone) : pillMic;
  const pipeline = engines.stt
    ? new Pipeline({
        stt: engines.stt,
        llm: engines.llm,
        inserter: platform.inserter,
        history,
        dictionary,
      })
    : null;

  const dictation = new DictationController(
    pill,
    mic,
    createWorkflow({
      pipeline,
      problems: engines.problems,
      settings,
      context: platform.context,
      history,
      saveRecording,
      newId: randomUUID,
      // Show the words as heard while the model is still cleaning them up.
      onHeard: (text) => pill.setState({ kind: "processing", message: text }),
      signedIn: async () => (await account.state()).signedIn,
      remainingSeconds: async () => (await account.usage())?.remaining ?? null,
      onHistoryChanged: notifyHistoryChanged,
      log: (line) => console.log(line),
    }),
  );

  ipcMain.handle(IPC.settingsGet, () => settings.all());
  ipcMain.handle(IPC.settingsSet, async (_event, patch: unknown) => {
    const next = await settings.update(assertSettings(patch, (keys) => platform.hotkey.accepts(keys)));
    applyLaunchAtLogin(next.launchAtLogin);
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.settingsChanged, next);
    }
    await registerHotkey();
    return next;
  });
  ipcMain.handle(IPC.updateState, () => updateState());
  ipcMain.handle(IPC.updateCheck, () => checkForUpdate());
  ipcMain.on(IPC.updateInstall, () => installUpdate());
  startUpdater((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.updateChanged, state);
    }
  }, app.isPackaged);

  ipcMain.handle(IPC.microphoneList, () => microphones);
  ipcMain.on(IPC.microphonePublish, (_event, options: unknown) => {
    microphones = Array.isArray(options)
      ? options
          .filter((item): item is MicrophoneOption => !!item && typeof item.id === "string")
          .map((item) => ({ id: String(item.id), label: String(item.label ?? "Microphone") }))
          .slice(0, 50)
      : [];
  });

  ipcMain.on(IPC.pillHover, (event, inside: unknown) => {
    if (pill.owns(event.sender)) pill.setHover(inside === true);
  });
  ipcMain.on(IPC.pillClick, (event) => {
    if (pill.owns(event.sender)) openMainWindow();
  });
  ipcMain.on(IPC.micChunk, (event, samples: Int16Array) => {
    if (pill.owns(event.sender)) pillMic.receive(samples);
  });
  ipcMain.on(IPC.micStopped, (event) => {
    if (pill.owns(event.sender)) pillMic.stopped();
  });
  ipcMain.on(IPC.micError, (event, message: string) => {
    if (pill.owns(event.sender)) pillMic.failed(String(message));
  });

  let hotkeyRetry: NodeJS.Timeout | undefined;
  const registerHotkey = async (): Promise<void> => {
    // One retry loop at most, even when a settings change re-registers while a retry is pending.
    clearTimeout(hotkeyRetry);
    await platform.hotkey
      .register(await bindings(), (event) => dictation.handleHotkey(event))
      .catch((error: unknown) => {
        // Missing permission: keep trying, so the hotkey starts working as soon as it is granted.
        if (error instanceof SubxError && error.code === "permission_denied") {
          hotkeyRetry = setTimeout(registerHotkey, HOTKEY_RETRY_MS);
        } else {
          console.error("Hotkey unavailable:", error);
        }
      });
  };
  void registerHotkey();

  tray = createTray(openMainWindow);
  // Started by Windows at login, the app belongs in the tray with the pill on screen — not in
  // front of whatever the user was actually opening.
  if (!startedHidden()) openMainWindow();
}

app.whenReady().then(() => {
  // Windows and Linux draw the menu inside our own window, where File/Edit/View belongs to no
  // feature this app has. macOS keeps its menu: it is the system menu bar, and dropping it would
  // take the app menu and the standard editing shortcuts with it.
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  // A swallowed startup failure looks exactly like a window that never opens, which is not a
  // thing anyone can debug from the outside.
  start().catch((error) => console.error("SUBXVoice failed to start:", error));
  app.on("activate", openMainWindow);
});

app.on("will-quit", () => {
  tray?.destroy();
  void platform.hotkey.unregisterAll();
});
