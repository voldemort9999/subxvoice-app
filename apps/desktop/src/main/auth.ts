import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { app, safeStorage } from "electron";

/**
 * Who the user is, and the token the Edge Functions check.
 *
 * The project URL and the anon key are not secrets — the anon key is designed to ship in clients
 * and grants nothing on its own. The vendor keys it stands in for are the ones that now stay on
 * the server.
 */
const SUPABASE_URL = "https://tbtwdryremxatgikigph.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRidHdkcnlyZW14YXRnaWtpZ3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MzUyNTUsImV4cCI6MjEwOTAxMTI1NX0.jxPB3OnSyzy3TKKU1YUiwNlMkeXe8o-uIbdv06V-gZI";

export const STT_URL = `${SUPABASE_URL.replace("https://", "wss://")}/functions/v1/stt`;
export const LLM_URL = `${SUPABASE_URL}/functions/v1/llm`;

export interface AccountState {
  email: string | null;
  signedIn: boolean;
}

/**
 * Only the refresh token is kept, and only through the OS keychain. supabase-js handles expiry
 * and renewal in memory; nothing durable is written in the clear.
 */
export class Account {
  private readonly client: SupabaseClient;
  private readonly file: string;
  private listeners = new Set<(state: AccountState) => void>();

  constructor() {
    this.file = join(app.getPath("userData"), "session.bin");
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        // There is no browser here to come back from a redirect.
        detectSessionInUrl: false,
      },
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      void this.remember(session);
      this.announce();
    });
  }

  /** Restores the last session, if the machine still has one. Safe to call when it does not. */
  async restore(): Promise<void> {
    const token = await this.readRefreshToken();
    if (!token) return;
    const { error } = await this.client.auth.refreshSession({ refresh_token: token });
    // A refresh token that no longer works is not an error worth showing: ask them to sign in.
    if (error) await this.forget();
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    await this.forget();
  }

  async state(): Promise<AccountState> {
    const { data } = await this.client.auth.getSession();
    return { email: data.session?.user.email ?? null, signedIn: !!data.session };
  }

  /**
   * The access token for the Edge Functions, refreshed if it is close to expiring. Returns "" when
   * nobody is signed in, which is what makes the providers report themselves as unavailable.
   */
  async token(): Promise<string> {
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? "";
  }

  onChanged(listener: (state: AccountState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private announce(): void {
    void this.state().then((state) => {
      for (const listener of this.listeners) listener(state);
    });
  }

  private async remember(session: Session | null): Promise<void> {
    if (!session) return;
    if (!safeStorage.isEncryptionAvailable()) return;
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(this.file, safeStorage.encryptString(session.refresh_token));
  }

  private async readRefreshToken(): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(await readFile(this.file));
    } catch {
      // No session yet, or one this machine can no longer decrypt.
      return null;
    }
  }

  private async forget(): Promise<void> {
    await unlink(this.file).catch(() => {});
  }
}
