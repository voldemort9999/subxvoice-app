# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-01 · after S-011 · branch `main` at `04dabbc`, remote `voldemort9999/subxvoice-app`

## Where things stand

SUBXVoice is **shipped**. There is a public download page, an installer anyone can take, and
installed copies update themselves. That sentence was not true at the start of 2026-11-01.

The product is three repos, and confusing them is the easy mistake:

| Repo | Holds | Visibility |
|---|---|---|
| `voldemort9999/subxvoice-app` | the desktop app and its Supabase functions — this working copy | **private** |
| `voldemort9999/subxvoice` | the website — working copy at `pillow/subxvoice-web/` | private |
| `voldemort9999/subxvoice-releases` | installers and `latest.yml`, nothing else | **public, must stay public** |

The release repo is public because a private repo's release assets return 404 to anonymous
callers. Making it private silently breaks the download button and every update check at the same
time. The alternative — shipping a GitHub token inside the app — is the exact thing the S-010
backend work was done to avoid.

**Dictation itself is unchanged since S-010.** Hold `Ctrl+Win` (`fn` on Mac), speak Hindi/English/
mixed, release, and Roman-script Hinglish is pasted at the cursor. Speech-to-text is Gnani
`prisma-v3.0` over a websocket; both vendors sit behind Supabase Edge Functions that a signed-in
account unlocks; the daily allowance is two hours per account, counted from the audio the relay
actually forwards.

**What S-011 added.** `main/updater.ts` checks the public feed at launch and every six hours,
downloads in the background and installs on quit; Settings has an Updates card so a failed check
says why rather than going quiet. Building and publishing are deliberately different commands —
`pnpm dist:win` passes `--publish never`, and `pnpm release:win` is the only path that publishes,
reading its GitHub token from the credential helper git already pushes with. The whole chain was
verified on real artifacts, not just unit tests: 0.1.0 installed, 0.1.1 published, the installed
copy found it, downloaded 107.5 MB and upgraded itself in place.

Two product flaws surfaced while testing and were fixed before launch: the app installed itself as
`@subxdesktop` and kept user data under `AppData\Roaming\@subx\desktop` (no `productName` in
package.json), and the installer shipped the default Electron icon. The rename moves `userData`, so
`migrateUserData()` carries an upgrading install's data across — and its first version never ran,
because Electron creates `userData` before the main script does.

**The website** is the Lovable template, rebranded onto the app's exact design tokens and rewritten
to be true: the fake early-access email form is gone, the CTA is the installer, the FAQ answers from
shipped behaviour, and Privacy and Terms are real pages rather than "coming before launch" stubs.
Live at **subxvoice.vercel.app**.

**Repo hygiene.** `apps/web` and `packages/shared` were deleted — the placeholder site and the only
thing that imported it. They held a second definition of the download URL that nothing rendered.
`docs/WINDOWS.md` was deleted too: it told the reader to fork `aryan-2255/subxvoice` and open PRs
against it, and its API-keys section still described a world before S-010. Its three real facts
moved into `CLAUDE.md`.

Live version is **0.1.2**. What is still **not** built: `packages/mcp`, active-app context on macOS,
`openApp` on Windows, `native/win-helper`, SQLite, a macOS release. The build is unsigned by
decision, so Windows shows a SmartScreen warning on first install; the website says so plainly.

## Continue from here

Nothing is mid-flight. Both repos are clean and pushed; `pnpm check` is 10/10.

First thing, and it is now two sessions overdue: **have the user run a real dictation end to end** —
sign in, complete setup, hold the hotkey. Every fix since S-010 (the blank `OPENROUTER_MODEL`, the
silent rewrite failure, per-account data) is still unconfirmed by an actual dictation. Every failure
path reports itself now: an amber dot on the pill, "went in as heard" in History, and
`SessionRecord.rewriteError`.

Then, in order of how much they matter:

1. **Account-hopping resets the quota.** Two hours is per account, signup is open, so a new account
   grants another two hours. Add a device component to `public.daily_usage` and to
   `supabase/functions/_shared/usage.ts`. Raised twice with the user; still not built.
2. **LLM latency through the proxy**, ~700–1700 ms against ~450 ms benchmarked in S-001. Start at
   `supabase/functions/llm/index.ts` and `packages/providers/src/llm/openrouter.ts`.
3. The website has no support address — Contact points at the releases repo's issues.
4. macOS has a `release:mac` script that has never been run.

## Topic → file

| Topic | File |
|---|---|
| Auto-update: `updater.ts`, the six states, install-on-quit | 001 (S-011) |
| Release pipeline: `dist` vs `release`, draft/race traps, token from git credentials | 001 (S-011), `docs/decisions.md` 2026-11-01 |
| Why installers live in a separate **public** repo | 001 (S-011), `docs/decisions.md` 2026-11-01 |
| `productName`, install directory, `userData` rename and `migrateUserData` | 001 (S-011) |
| Generated icon: `shared/mark.ts`, `build-icon.mjs`, zlib PNG | 001 (S-011) |
| The website: rebrand, download link, Vercel, nitro preset | 001 (S-011) |
| Why `apps/web`, `packages/shared` and `docs/WINDOWS.md` were deleted | 001 (S-011) |
| Gnani provider: upgrade headers, commit-with-no-ack, framing, keyterms limits | 001 (S-009) |
| Gnani model choice (`prisma-v3.0` vs v2.5), locale, `format=transliterate` | 001 (S-009), `docs/decisions.md` 2026-10-30 |
| Soniox provider: streaming, `finalize`, markers, regions — **removed, history only** | 001 (S-001, S-002, S-004) |
| Supabase backend: stt relay, llm proxy, usage, why `npm:ws` | 001 (S-010), `docs/decisions.md` 2026-10-31 |
| Auth, sessions, `safeStorage`, token-as-a-function in the providers | 001 (S-010) |
| Daily limit: table, RLS, counting bytes, Asia/Kolkata day | 001 (S-010) |
| Per-account data isolation (`userData/accounts/<id>/`) | 001 (S-010) |
| Custom hotkeys: `accepts()`, key vocabulary, the recorder | 001 (S-010) |
| Dashboard/Insights, `shared/stats.ts`, design tokens | 001 (S-009) |
| Windows active-app detection (`GetForegroundWindow`, image path) | 001 (S-009) |
| Transliteration prompt, English-in-Devanagari, mishearing repair | 001 (S-005) |
| Streaming pipeline: `open/push/finish`, why not batch | 001 (S-002) |
| Windows hotkey and paste: koffi, `GetAsyncKeyState`, `SendInput` | 001 (S-001) |
| Workflow engine, `workflow.ts` design | 001 (S-004) |
| Settings store, frozen-defaults bug | 001 (S-003) |
| Toolchain traps: Python, pnpm `allowBuilds`, `ELECTRON_RUN_AS_NODE`, koffi | 001 (S-001, S-011) |
| Screenshotting and driving this app from outside — **what breaks it** | 001 (S-009) |
| Repo audit; repo split and the orphan commit | 001 (S-006, S-008) |

## Open decisions

- **Per-device quota, or leave account-hopping open?** Signup is open and the limit is per account.
  Options: machine id alongside user id in `daily_usage`; or close signup; or accept it. Raised in
  S-010 and again in S-011; nothing chosen.
- **Where to cut LLM latency**, ~700–1700 ms through the proxy. Prompt length, response streaming, a
  smaller model for short input, or the proxy hop itself. Nothing measured yet.
- **A support address for the website.** Contact currently points at the releases repo's issues.
- ~~**Where installers are hosted.**~~ Settled in S-011: GitHub Releases on a separate public repo.
- ~~**Whether the website joins the monorepo.**~~ Settled in S-011: it stays its own repo.
- ~~**Whether to proxy speech-to-text.**~~ Settled in S-010: proxy if under 100 ms; measured 41 ms.
- ~~**Code signing.**~~ Settled in S-010: unsigned. A self-signed certificate does not reduce the
  SmartScreen warning, so it buys nothing. Confirmed in S-011 that unsigned builds auto-update fine.

## Ruled out

- **Supabase Storage for installers** — free tier caps egress at 5 GB/month, about 35–45 downloads
  of a ~110 MB installer. 001 (S-011).
- **Making `subxvoice-app` public**, and **shipping a GitHub token in the app**, as ways to serve
  releases from a private repo. 001 (S-011).
- **Publishing from CI on a tag** — the user wanted a command they run. 001 (S-011).
- **electron-builder's default publish behaviour** — `draft` releases 404 for anonymous callers, and
  concurrent uploaders race into two half-filled releases. 001 (S-011).
- **Soniox** — replaced by Gnani on 2026-10-30, a project requirement. 001 (S-009).
- `WebSocketStream` in Supabase Edge Functions — not defined in that runtime at all. `npm:ws`
  instead, which can set the upgrade headers Gnani needs. 001 (S-010).
- Opening the relay's upstream socket beside `Deno.upgradeWebSocket`, or from a `setTimeout(…, 0)` —
  both leave the client connection dead. Only `client.onopen` works. 001 (S-010).
- `format=transliterate` as a replacement for the LLM pass — it paraphrases. 001 (S-009).
- `indic-auto` as the recognition locale — guessed Telugu on a Hindi-English clip. 001 (S-009).
- Driving this app with synthetic mouse/keyboard input — the ALT trick opens the native menu bar and
  the next click closes the window. Restart with a different default page instead. 001 (S-009).
- Batch speech-to-text (buffer the clip, send at release) — release→paste scaled with how long the
  user spoke. 001 (S-002).
- A low-level Windows keyboard hook (uiohook-napi) — Windows silently removes it. 001 (S-001).
- `llama-4-scout` and `qwen3-32b` for transliteration — wrong output. 001 (S-001).
- Restoring only clipboard *text* after a paste. `docs/decisions.md`, 2026-10-01.

## Settled

- `context/` is **committed**, not gitignored — 2026-10-30, S-007.
- Email and password only: no OAuth, no OTP, no email confirmation; and signing up does not sign you
  in — S-010.
- Settings (hotkey, microphone, open-at-login) stay with the **machine**; transcripts, dictionary and
  audio follow the **account** — S-010.
- `pnpm dist:*` never publishes; `pnpm release:*` is the only thing that does — S-011.

## Sessions

| # | Date | What | File |
|---|---|---|---|
| S-001 | 2026-10-01 | Connected the pipeline; built the Windows platform; PR #1 | 001 |
| S-002 | 2026-10-01 | Roman by default; streaming STT; Cerebras first | 001 |
| S-003 | 2026-10-01 | Settings store froze old defaults into the saved file | 001 |
| S-004 | 2026-10-21 | Soniox India region; workflow engine; merged Aryan's main; PR #2 | 001 |
| S-005 | 2026-10-30 | English-in-Devanagari came out phonetic; prompt rewritten | 001 |
| S-006 | 2026-10-30 | Deep repo read; context system set up | 001 |
| S-007 | 2026-10-30 | Commands moved to workspace root so they are callable | 001 |
| S-008 | 2026-10-30 | Pushed everything to Aryan's repo, cut it loose, fresh repo | 001 |
| S-009 | 2026-10-30 | Gnani replaces Soniox; dashboard, insights, Windows app context | 001 |
| S-010 | 2026-10-31 | Supabase backend, accounts, 2 h/day limit, per-account data | 001 |
| S-011 | 2026-11-01 | Auto-update, public release repo, website live on Vercel | 001 |
