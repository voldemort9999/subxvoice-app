// Turning what the user physically pressed into the string the hotkey watcher understands.
// Kept apart from the component so it can be tested without a keyboard or a DOM.

/** Fixed order, so the same chord always spells the same binding however it was pressed. */
const MODIFIER_ORDER = ["ctrl", "shift", "alt", "win"] as const;

/** Codes that are already covered by the event's modifier flags. */
const MODIFIER_CODES = /^(Control|Shift|Alt|Meta)(Left|Right)$/;

/** Named keys whose code is not simply their name. Letters, digits and F-keys are derived below. */
const NAMED: Record<string, string> = {
  Space: "space",
  Tab: "tab",
  Enter: "enter",
  NumpadEnter: "enter",
  Escape: "esc",
  Backspace: "backspace",
  CapsLock: "capslock",
  Insert: "insert",
  Delete: "delete",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  ArrowLeft: "left",
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
};

/** The non-modifier key, or null when the event carried only modifiers. */
export function keyName(code: string): string | null {
  if (MODIFIER_CODES.test(code)) return null;
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code.toLowerCase();
  return null;
}

export interface Chord {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  code: string;
}

/**
 * The binding for a chord, or null when it is not one worth assigning. Hold-to-talk keeps the
 * keys down for a whole sentence, so a single key is refused: it would fire while typing.
 */
export function comboFrom(event: Chord): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  if (event.metaKey) parts.push("win");

  const main = keyName(event.code);
  if (main && !parts.includes(main)) parts.push(main);

  // Sort the modifiers into canonical order; the main key always comes last.
  const modifiers = MODIFIER_ORDER.filter((name) => parts.includes(name));
  const rest = parts.filter((name) => !MODIFIER_ORDER.includes(name as (typeof MODIFIER_ORDER)[number]));
  const combo = [...modifiers, ...rest];
  return combo.length >= 2 ? combo.join("+") : null;
}
