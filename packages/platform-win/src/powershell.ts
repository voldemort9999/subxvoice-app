import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * One PowerShell that stays running and answers requests, so command mode pays PowerShell's
 * start-up once instead of on every action.
 *
 * Why PowerShell at all: the Windows pieces command mode needs — Core Audio's per-app volume,
 * window enumeration, the Start menu's app list — are COM interfaces, and calling COM through koffi
 * means hand-building vtables. The personal computer-mcp already had working, audited C# for them;
 * PowerShell compiles that C# with Add-Type, so it is reused nearly verbatim instead of ported.
 *
 * Measured on this machine: ready in ~440 ms including compiling the interop, then ~2 ms a call
 * for volume and ~20 ms for listing audio sessions. Devanagari survives the round trip exactly.
 *
 * Requests are one JSON line each, `{id, code}`, with the code base64'd so nothing in it can break
 * the line protocol. Replies are one JSON line, `{id, ok, value | error}`. Windows PowerShell 5.1 is
 * used rather than pwsh because every Windows 10 and 11 machine has it.
 */

/** A request that has not come back by now has wedged the worker; it is restarted. */
const CALL_TIMEOUT_MS = 20_000;

const LOOP = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::Out.WriteLine('{"ready":true}'); [Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $req = $line | ConvertFrom-Json
  try {
    $code = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($req.code))
    $value = Invoke-Expression $code
    $res = @{ id = $req.id; ok = $true; value = $value } | ConvertTo-Json -Compress -Depth 8
  } catch {
    $res = @{ id = $req.id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  }
  [Console]::Out.WriteLine($res); [Console]::Out.Flush()
}`;

interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

export class PowerShellWorker {
  private process: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<void> | null = null;
  private readonly pending = new Map<number, Pending>();
  private sequence = 0;
  private readonly preload: string[];

  /** `preload` is run once per worker before any request — the C# interop, compiled by Add-Type. */
  constructor(preload: string[] = []) {
    this.preload = preload;
  }

  /** Starts the worker if it is not running. Safe to call early to hide the start-up cost. */
  warm(): Promise<void> {
    if (!this.ready) {
      // A start that failed is forgotten, so the next command tries again rather than inheriting it.
      this.ready = this.start().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  /** Runs PowerShell and returns what it produced. A thrown error comes back as a rejection. */
  async run(code: string): Promise<unknown> {
    await this.warm();
    return this.send(code);
  }

  /** For code that ends in `ConvertTo-Json` or a C# method that returns JSON. */
  async json<T>(code: string): Promise<T> {
    const value = await this.run(code);
    if (typeof value !== "string" || !value.trim()) return (Array.isArray(value) ? value : []) as T;
    return JSON.parse(value) as T;
  }

  dispose(): void {
    this.process?.stdin.end();
    this.process?.kill();
    this.reset(new Error("PowerShell worker stopped"));
  }

  private async start(): Promise<void> {
    // -EncodedCommand keeps the loop off disk entirely; it is UTF-16LE base64 by definition.
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(LOOP, "utf16le").toString("base64"),
      ],
      { windowsHide: true },
    );
    this.process = child;

    const started = new Promise<void>((resolve, reject) => {
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        let message: { ready?: boolean; id?: number; ok?: boolean; value?: unknown; error?: string };
        try {
          message = JSON.parse(line);
        } catch {
          return; // anything a cmdlet printed outside the protocol
        }
        if (message.ready) {
          resolve();
          return;
        }
        const waiting = message.id === undefined ? undefined : this.pending.get(message.id);
        if (!waiting) return;
        this.pending.delete(message.id as number);
        clearTimeout(waiting.timer);
        if (message.ok) waiting.resolve(message.value);
        else waiting.reject(new Error(message.error ?? "PowerShell failed"));
      });
      child.once("error", reject);
    });

    child.once("exit", () => {
      // The next call starts a fresh worker rather than writing into a dead pipe.
      if (this.process === child) {
        this.process = null;
        this.ready = null;
        this.reset(new Error("PowerShell worker exited"));
      }
    });

    await started;
    // One block that fails to compile costs only the actions that use it, not the whole worker.
    // Said out loud: a block that failed to compile once read only as "Unable to find type
    // [CmdUia]" much later, from whichever action used it first.
    for (const code of this.preload)
      await this.send(code).catch((error: Error) =>
        console.error(`PowerShell preload failed: ${error.message}`),
      );
  }

  private send(code: string): Promise<unknown> {
    const child = this.process;
    if (!child) return Promise.reject(new Error("PowerShell worker is not running"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("PowerShell did not answer in time"));
        // A wedged worker would hold every later call behind this one.
        child.kill();
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, code: Buffer.from(code, "utf8").toString("base64") })}\n`);
    });
  }

  private reset(error: Error): void {
    for (const [id, waiting] of this.pending) {
      clearTimeout(waiting.timer);
      waiting.reject(error);
      this.pending.delete(id);
    }
  }
}

/**
 * A string as a PowerShell single-quoted literal. Only the quote needs doubling — but PowerShell
 * also ends a single-quoted string at the typographic quotes ‘ ’ ‚ ‛, so a file named with one
 * would otherwise break out of the literal. Each is doubled the same way.
 */
export function psQuote(text: string): string {
  return `'${text.replace(/['‘’‚‛]/g, "$&$&")}'`;
}
