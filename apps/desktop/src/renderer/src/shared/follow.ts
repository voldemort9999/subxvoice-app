import type { AppInfo } from "../../../shared/ipc";

/**
 * Things to say to Follow My Words, one per kind of job. Every one was run through the shipped
 * models on 2026-11-14 and planned to the right action; the website shows the same set.
 */
export const FOLLOW_EXAMPLES: { kind: string; say: string }[] = [
  { kind: "Messages", say: "WhatsApp pe Aryan ko likho aaj main nahi aa paunga" },
  { kind: "Notes", say: "Notepad kholo aur likho aaj ke tasks: client ko call karna" },
  { kind: "Files", say: "Pictures wale folder mein mera resume dhoondo" },
  { kind: "Your PC", say: "OnePlus Buds connect karo" },
  { kind: "Your PC", say: "brightness 60% kar do" },
  { kind: "Apps", say: "Chrome ko aage lao" },
  { kind: "Browser", say: "YouTube pe Kesariya chalao" },
  { kind: "Browser", say: "Google pe aaj ka weather search karo" },
];

/** The Follow My Words key, when this computer has it at all (Windows, signed in). */
export function followKey(info: AppInfo | null): string | undefined {
  return info?.hotkeys.find((binding) => binding.mode === "command")?.keys;
}
