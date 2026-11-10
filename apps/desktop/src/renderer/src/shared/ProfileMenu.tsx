import { useEffect, useRef, useState } from "react";
import type { AccountState } from "../../../shared/ipc";

/** The first letter of the name, or of the email when there is no name yet. */
function initial(account: AccountState): string {
  const source = account.name || account.email || "?";
  return source.trim().charAt(0).toUpperCase();
}

export function ProfileMenu({ account }: { account: AccountState }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  // A menu that stays open after you look away is a menu in the way.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={holder} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={account.name || account.email || "Account"}
        className={`grid h-8 w-8 place-items-center rounded-full bg-ink font-display text-[13px] font-bold text-page transition-shadow ${
          open ? "ring-2 ring-marigold ring-offset-2 ring-offset-page" : ""
        }`}
      >
        {initial(account)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-10 right-0 z-20 w-60 rounded-[3px] border border-rule-strong bg-paper p-1 shadow-[0_8px_24px_rgb(58_15_52/18%)]"
        >
          <div className="border-b border-rule px-3 py-2.5">
            {account.name && <p className="truncate font-semibold">{account.name}</p>}
            <p className="truncate text-xs text-ink-soft">{account.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void window.subx.auth.signOut();
            }}
            className="mt-1 w-full rounded-[3px] px-3 py-2 text-left text-ink-soft hover:bg-well hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
