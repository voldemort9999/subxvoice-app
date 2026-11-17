import type { LlmProvider, LlmRequest, LlmResponse } from "@subx/core";

/**
 * Asks `primary` first. If it has not answered after `headStartMs`, it asks `backup` as well,
 * without cancelling `primary`, and returns whichever answers first. If `primary` fails inside its
 * head start, `backup` is asked at once. It rejects only when both have failed.
 *
 * The request that loses keeps running and is paid for. That is the price of never waiting
 * on a slow upstream when another one is ready.
 */
export class RaceLlm implements LlmProvider {
  readonly id: string;

  constructor(
    private readonly primary: LlmProvider,
    private readonly backup: LlmProvider,
    private readonly headStartMs: number,
    private readonly onBackup: (reason: string) => void = () => {},
  ) {
    this.id = primary.id;
  }

  complete(request: LlmRequest): Promise<LlmResponse> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let backupStarted = false;
      let failures = 0;

      const win = (response: LlmResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(response);
      };
      const lose = (error: unknown) => {
        failures += 1;
        if (!backupStarted) {
          startBackup(`primary failed: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }
        // Both have been asked; this is the second failure, so there is no one left to wait on.
        if (failures === 2 && !settled) {
          settled = true;
          reject(error);
        }
      };
      const startBackup = (reason: string) => {
        if (backupStarted || settled) return;
        backupStarted = true;
        clearTimeout(timer);
        this.onBackup(reason);
        this.backup.complete(request).then(win, lose);
      };

      const timer = setTimeout(() => startBackup(`no answer in ${this.headStartMs} ms`), this.headStartMs);
      this.primary.complete(request).then(win, lose);
    });
  }
}
