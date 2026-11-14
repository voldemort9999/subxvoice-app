/**
 * What was said and done in the last few minutes, so that "now type this in it" knows what "it" is.
 *
 * Deliberately not a chat log. A command needs to know which app was opened a minute ago, not what
 * was said an hour ago — and every remembered line is read by the decider on every step, so stale
 * entries cost time and can steer it wrong. Entries expire, and only the latest few are kept.
 */
/** How long a command still counts as "what we are in the middle of". */
const CONTINUE_MS = 3 * 60_000;

export class AgentMemory {
  private entries: { at: number; said: string; did: string[] }[] = [];
  private readonly ttlMs: number;
  private readonly limit: number;
  private readonly now: () => number;

  constructor(options: { ttlMs?: number; limit?: number; now?: () => number } = {}) {
    this.ttlMs = options.ttlMs ?? 10 * 60_000;
    this.limit = options.limit ?? 5;
    this.now = options.now ?? Date.now;
  }

  remember(said: string, did: string[]): void {
    if (!did.length) return; // a command that did nothing leaves nothing worth recalling
    this.entries.push({ at: this.now(), said, did });
    this.entries = this.entries.slice(-this.limit);
  }

  /** Lines for the decider, oldest first, with how long ago so "just now" outweighs "8 min ago". */
  recall(): string[] {
    const now = this.now();
    this.entries = this.entries.filter((entry) => now - entry.at <= this.ttlMs);
    return this.entries.map((entry) => {
      const minutes = Math.round((now - entry.at) / 60_000);
      const when = minutes < 1 ? "just now" : `${minutes} min ago`;
      // What was done, not what was said: given the earlier sentence, the planner re-planned it for
      // an unrelated command ("अन्बुकरो" became the previous "type hi into the message box").
      return `Earlier (${when}) this was done: ${entry.did.join("; ")}`;
    });
  }

  /**
   * The last command, when it was recent enough that the next one is probably carrying it on —
   * "YouTube kholo" then "first wala chalao". Past this window a command stands on its own, as the
   * user asked: "bahut time baad kehta hoon to alag baat hai".
   */
  continuing(withinMs = CONTINUE_MS): { seconds: number; did: string[] } | null {
    const last = this.entries.at(-1);
    if (!last) return null;
    const age = this.now() - last.at;
    return age <= withinMs ? { seconds: Math.round(age / 1000), did: last.did } : null;
  }

  clear(): void {
    this.entries = [];
  }
}
