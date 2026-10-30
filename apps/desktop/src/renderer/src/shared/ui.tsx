// The small set of shapes every screen is built from. Deliberately not a component library:
// anything used once lives in the page that uses it.
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * One number with what it means. `note` is for the caveat the number needs — an assumption, or
 * what it is measured against — so the figure is never read as more certain than it is.
 */
export function Stat({
  label,
  value,
  unit,
  note,
  icon: StatIcon,
  tone = "ink",
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "ink" | "accent" | "speech";
}) {
  const valueTone = tone === "accent" ? "text-accent" : tone === "speech" ? "text-speech" : "text-ink";
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-muted">
        {StatIcon && <StatIcon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <p className={`figure-num mt-2 text-[26px] leading-none font-semibold ${valueTone}`}>
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>}
      </p>
      {note && <p className="mt-1.5 text-xs text-faint">{note}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "speech" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-raised text-muted",
    accent: "bg-accent-soft text-accent",
    speech: "bg-speech-soft text-speech",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = "quiet",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "quiet" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    quiet: "bg-raised text-ink hover:bg-ink/10",
    danger: "bg-danger-soft text-danger hover:bg-danger/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 font-medium transition-colors disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  icon: ButtonIcon,
  label,
  onClick,
  tone = "muted",
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: "muted" | "danger";
  className?: string;
}) {
  const hover = tone === "danger" ? "hover:text-danger" : "hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-ink/10 ${hover} ${className}`}
    >
      <ButtonIcon className="h-4 w-4" />
    </button>
  );
}

/** Copies text and says so in place, because a copy with no feedback feels broken. */
export function CopyButton({ text, label = "Copy text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; leaving the button unchanged is the honest response.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      disabled={!text}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-ink/10 disabled:opacity-30 ${
        copied ? "text-speech" : "text-muted hover:text-ink"
      }`}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <fieldset className="m-0 flex gap-0.5 rounded-lg border-0 bg-raised p-0.5">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={`rounded-[6px] px-2.5 py-1 font-medium transition-colors ${
            option.value === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

/** An empty screen is an invitation to act, so it always says what to do next. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-muted">{children}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-line-soft py-4 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[180px_1fr] sm:gap-6">
      <div>
        <p className="font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="mt-2 sm:mt-0">{children}</div>
    </div>
  );
}
