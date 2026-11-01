# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-01 · after S-010 · branch `main` at `1a74224`, remote `voldemort9999/subxvoice-app`

## Where things stand

SUBXVoice dictates end to end on Windows and on macOS. Hold `Ctrl+Win` (`fn` on Mac), speak
Hindi/English/mixed, release, and Roman-script Hinglish is pasted at the cursor. The two days since
the repo split changed three things underneath that sentence: the speech vendor, the window, and
where the credentials live.

**Speech-to-text is Gnani, not Soniox** (S-009). `prisma-v3.0`, one locale `hi-IN`, over a websocket
that opens on key-down. The swap was a project requirement rather than a measurement, and it cost
latency: release→text went from ~52 ms to 213–478 ms. It bought something back — v3.0 writes
Indian-accented English in Latin script rather than Devanagari, so pure-English dictation now skips
the LLM pass entirely. Its protocol has sharp edges (config in upgrade headers, a `commit` answered
with silence, fixed 1024-byte frames); they are written up in `CLAUDE.md` → gotchas, and ignoring
them produces bugs that look like something else.

**The window is a product, not a settings screen** (S-009). Dashboard, Insights, History,
Dictionary, Settings, dark by default. Everything on Dashboard and Insights is derived from the
history already on disk — no new tracking. Windows can now read the foreground window
(`platform-win/src/context.ts`), so "which app did I dictate into" has real data; macOS still
reports nothing and the chart says so rather than inventing a bar.

**The app holds no vendor keys** (S-010). Gnani has no short-lived tokens — checked, not assumed:
its docs have no authentication page at all, and Gnani's own guidance is to proxy from a backend. So
both vendors sit behind Supabase Edge Functions that a signed-in account unlocks:
`supabase/functions/stt` relays the dictation websocket, `supabase/functions/llm` forwards
rewriting, `supabase/functions/usage` reports the daily allowance. Measured cost of the relay:
+41 ms on release→text, against a 100 ms budget the user set. The app now opens on email-and-password
sign-in, then a two-step setup (name, hotkey), and enforces two hours of dictation per account per
day — counted from the audio the relay actually forwards, so it does not depend on the client being
honest.

The hotkey accepts **any combination of two or more keys**, recorded by holding them (S-010).
Per-account data isolation was a real hole found by the user's own final check: history, dictionary
and recordings were machine-level, so a new account saw the previous person's transcripts. They now
live under `userData/accounts/<user-id>/`.

What is **not** built: `apps/api` (the repo still has no backend of its own — Supabase Edge Functions
are it), `packages/mcp`, active-app context on macOS, `openApp` on Windows, `native/win-helper`,
SQLite (history and dictionary are JSON files), any release pipeline. The build is unsigned by
decision.

The last thing the user reported was that the hotkey and the pill "did not work". That was traced:
the pill was fine (it was correctly placed on their second-monitor setup), and the real fault was a
`catch { return text }` in `pipeline.ts` that hid every rewrite failure, plus being signed out. Both
are fixed. **They have not retested since.**

## Continue from here

Nothing is mid-flight; the working tree is clean and `main` is pushed.

First thing: **have the user retest a dictation end to end** — sign in, complete setup, hold the
hotkey. Every failure path now reports itself (an amber dot on the pill, "went in as heard" in
History, `SessionRecord.rewriteError`), so a repeat of the last complaint will say what is wrong.

Then, in order of how much they matter:

1. **Account-hopping resets the quota.** Two hours is per account, and signup is open, so a new
   account grants another two hours. Add a device component to `public.daily_usage` and to
   `supabase/functions/_shared/usage.ts`. Raised with the user; not built.
2. **LLM latency through the proxy**, measured at ~700–1700 ms against ~450 ms benchmarked in S-001.
   Start at `supabase/functions/llm/index.ts` and `packages/providers/src/llm/openrouter.ts`.
3. `AGENTS.md:11` and `readme.md` still describe the two-person Aryan/Windows split.

## Topic → file

| Topic | File |
|---|---|
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
| Toolchain traps: Python, pnpm `allowBuilds`, `ELECTRON_RUN_AS_NODE`, koffi | 001 (S-001) |
| Screenshotting and driving this app from outside — **what breaks it** | 001 (S-009) |
| Repo audit; repo split and the orphan commit | 001 (S-006, S-008) |

## Open decisions

- **Per-device quota, or leave account-hopping open?** Signup is open and the limit is per account.
  Options: machine id alongside user id in `daily_usage`; or close signup; or accept it for the demo.
  Raised, nothing chosen.
- **Where to cut LLM latency**, now ~700–1700 ms through the proxy. Prompt length, response
  streaming, a smaller model for short input, or the proxy hop itself. Nothing measured yet.
- ~~**Whether to proxy speech-to-text.**~~ Settled in S-010: proxy if under 100 ms added; measured
  41 ms.
- ~~**Code signing.**~~ Settled in S-010: unsigned. A self-signed certificate does not reduce the
  SmartScreen warning, so it buys nothing.

## Ruled out

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
