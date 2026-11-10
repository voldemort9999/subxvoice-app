import type { SessionRecord } from "@subx/core";
import { useCallback, useEffect, useState } from "react";
import type {
  AccountState,
  AppInfo,
  AppSettings,
  MicrophoneOption,
  PermissionStatus,
  UpdateState,
  Usage,
} from "../../../shared/ipc";

/** All recordings, newest first. `null` while loading. Refreshes when a new one is saved. */
export function useHistory(): SessionRecord[] | null {
  const [records, setRecords] = useState<SessionRecord[] | null>(null);
  useEffect(() => {
    const load = () => void window.subx.history.list().then(setRecords);
    load();
    return window.subx.history.onChanged(load);
  }, []);
  return records;
}

/** Version, current hotkey and engine status. Re-read when settings change (e.g. a new hotkey). */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    const load = () => void window.subx.app.info().then(setInfo);
    load();
    return window.subx.settings.onChanged(load);
  }, []);
  return info;
}

const PERMISSION_POLL_MS = 1500;

/** Permission states, re-checked while the screen is open so granting one updates right away. */
export function usePermissions(): PermissionStatus[] | null {
  const [statuses, setStatuses] = useState<PermissionStatus[] | null>(null);
  useEffect(() => {
    const refresh = () => void window.subx.permissions.list().then(setStatuses);
    refresh();
    const timer = setInterval(refresh, PERMISSION_POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return statuses;
}

/** User settings, kept in sync with every window. `null` while loading. */
/** Update progress, pushed from the main process as the download runs. */
export function useUpdate(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    void window.subx.update.state().then(setState);
    return window.subx.update.onChanged(setState);
  }, []);
  return state;
}

export function useSettings(): [AppSettings | null, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    void window.subx.settings.get().then(setSettings);
    return window.subx.settings.onChanged(setSettings);
  }, []);
  const update = useCallback((patch: Partial<AppSettings>) => {
    void window.subx.settings.set(patch).then(setSettings);
  }, []);
  return [settings, update];
}

/**
 * Microphones the user can choose from. Device labels are only readable once mic permission has
 * been granted, so this re-reads them when the permission changes.
 */
export function useMicrophones(): MicrophoneOption[] {
  const [options, setOptions] = useState<MicrophoneOption[]>([]);
  useEffect(() => {
    const read = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const inputs = devices
        .filter((device) => device.kind === "audioinput" && device.deviceId !== "communications")
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));
      setOptions(inputs);
      // The pill records, but only this window may enumerate devices.
      window.subx.settings.publishMicrophones(inputs);
    };
    void read();
    navigator.mediaDevices.addEventListener("devicechange", read);
    return () => navigator.mediaDevices.removeEventListener("devicechange", read);
  }, []);
  return options;
}

export type Theme = "dark" | "light";

/**
 * A new key, not the old "subx.theme": the old default was dark and the app wrote it back on every
 * launch, so every existing install has "dark" stored without anyone having chosen it. Reading a
 * fresh key gives everyone the new default once; picking dark again is remembered as before.
 */
const THEME_KEY = "subx.theme.v2";

/**
 * Light by default, the same Ice Silver as the website (decided 2026-11-10, reversing S-009's
 * dark default). The choice is per machine, so it lives in localStorage rather than in settings.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private windows and cleared site data: the theme still applies for this run.
    }
  }, [theme]);

  return [theme, setTheme];
}

/** Who is signed in. `null` while the main process is still restoring the saved session. */
export function useAccount(): AccountState | null {
  const [state, setState] = useState<AccountState | null>(null);
  useEffect(() => {
    void window.subx.auth.state().then(setState);
    return window.subx.auth.onChanged(setState);
  }, []);
  return state;
}

/** Dictation time left today. Re-read whenever a dictation finishes, which is what changes it. */
export function useUsage(): Usage | null {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    const load = () => void window.subx.auth.usage().then(setUsage);
    load();
    return window.subx.history.onChanged(load);
  }, []);
  return usage;
}
