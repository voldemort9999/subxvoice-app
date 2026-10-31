import { SidebarTop } from "@platform/Chrome";
import type { ComponentType } from "react";
import type { Usage } from "../../../shared/ipc";
import { formatSpan } from "./format";
import { BookIcon, ChartIcon, HistoryIcon, HomeIcon, MicIcon, SettingsIcon } from "./icons";

export type PageId = "dashboard" | "insights" | "history" | "dictionary" | "settings";

interface NavItem {
  id: PageId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Grouped by what the user is trying to do, not by how the app is built: look at what happened,
 * then change how it behaves.
 */
const GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Your voice",
    items: [
      { id: "dashboard", label: "Dashboard", icon: HomeIcon },
      { id: "insights", label: "Insights", icon: ChartIcon },
      { id: "history", label: "History", icon: HistoryIcon },
    ],
  },
  {
    heading: "Tuning",
    items: [
      { id: "dictionary", label: "Dictionary", icon: BookIcon },
      { id: "settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function Sidebar({
  page,
  onNavigate,
  hotkey,
  ready,
  usage,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  hotkey: string;
  ready: boolean;
  usage: Usage | null;
}) {
  const exhausted = usage ? usage.remaining <= 0 : false;
  return (
    <nav className="flex w-[216px] shrink-0 flex-col border-r border-line bg-surface">
      <SidebarTop />

      {/* The mark is a waveform, because that is the only thing this app does. */}
      <div className="flex items-center gap-2.5 px-5 pb-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="var(--accent-ink)"
            aria-hidden="true"
          >
            <path d="M4 12h1.5M8 7.5v9M12 4.5v15M16 8.5v7M20 11h-1.5" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[14px] font-semibold tracking-tight">SUBXVoice</span>
      </div>

      <div className="flex-1 space-y-5 px-3">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="px-2.5 pb-1.5 text-xs font-medium text-faint">{group.heading}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ id, label, icon: PageIcon }) => {
                const active = id === page;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(id)}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors ${
                        active
                          ? "bg-accent-soft font-medium text-accent"
                          : "text-muted hover:bg-ink/[0.05] hover:text-ink"
                      }`}
                    >
                      <PageIcon className="h-4 w-4" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* The one thing a new user needs to know, kept in view on every screen. */}
      <div className="m-3 rounded-lg border border-line bg-raised p-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${exhausted ? "bg-warn" : ready ? "bg-speech" : "bg-warn"}`}
            aria-hidden="true"
          />
          <p className="font-medium">
            {exhausted ? "Daily limit reached" : ready ? "Ready to dictate" : "Setup needed"}
          </p>
        </div>
        {exhausted ? (
          <p className="mt-1.5 text-muted">Dictation is back tomorrow.</p>
        ) : ready ? (
          <>
            <p className="mt-1.5 flex items-center gap-1.5 text-muted">
              <MicIcon className="h-3.5 w-3.5 shrink-0" />
              Hold <span className="font-medium text-ink">{hotkey}</span>
            </p>
            {usage && (
              <p className="mt-1 text-xs text-faint">{formatSpan(usage.remaining * 1000)} left today</p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="mt-1.5 text-accent hover:underline"
          >
            Finish setup
          </button>
        )}
      </div>
    </nav>
  );
}
