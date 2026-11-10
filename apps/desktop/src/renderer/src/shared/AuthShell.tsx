import type { ReactNode } from "react";
import { Mark } from "./Mark";

/**
 * The frame for the two screens someone sees before the app proper: sign-in and first-run setup.
 * The left panel is the same inverted Aubergine as the sidebar they are about to meet, so the
 * window already looks like itself before they are inside it.
 */
export function AuthShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full bg-page">
      <aside className="flex w-[42%] max-w-[440px] min-w-[300px] flex-col justify-between bg-side px-9 pt-10 pb-9 text-side-ink">
        <div className="flex items-center gap-2.5">
          <Mark className="h-9 w-9" />
          <span className="font-display text-[19px] font-extrabold tracking-tight">SUBXVoice</span>
        </div>
        {aside}
      </aside>
      <main className="scroll-area flex flex-1 items-center justify-center overflow-y-auto px-10 py-10">
        <div className="animate-arrive w-full max-w-[360px]">{children}</div>
      </main>
    </div>
  );
}
