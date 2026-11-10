# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-10 · after S-012 · branch `main` at `6b7a3e3`, remote `voldemort9999/subxvoice-app`

## ⏭ The work in flight: redesign the desktop app's interface

**This is the one open task, and it was deliberately moved to a fresh chat because the last
session ran out of context. Start here.**

The website was rebuilt on a new three-colour design system and is finished and live. The desktop
app has **not** been — its renderer is still on the old violet/cyan palette. Only the app mark has
moved across so far (`apps/desktop/src/shared/mark.ts`, committed in `6b7a3e3`).

**Read `docs/design.md` first.** It is the whole brief: the three colours and the proportion, the
contrast rule that governs where the accent may be used, the typefaces, the motion vocabulary, the
principles the site is held to, and a closing section naming exactly what has to change in the app.

In short: Ice Silver `#DDE3E8` 60%, Deep Aubergine `#3A0F34` 30%, Marigold `#EAAA00` 10%.
Marigold is a **fill** on light ground (1.9:1 as type — unreadable) and becomes type only on
Aubergine. Display face Bricolage Grotesque, body Archivo, DM Mono for captured speech, Noto Sans
Devanagari for Hindi. The user asked for **light default, same as the site**.

Pages to do: Dashboard, Insights, History, Dictionary, Settings, SignIn, Onboarding, plus the pill
overlay, the sidebar and the tray. The user's words: *"Complete ka matlab complete."* They also
said, about the logic underneath: *"please bigaadna mat"* — the renderer is the only layer this
touches.

Two judgement calls waiting inside that work: the old palette used **two** meaningful colours
(violet "the product acting", cyan "the user's voice") and the new one has a single accent, so
that mapping needs deciding rather than search-replacing; and the **pill floats over other
applications**, so it should almost certainly stay Aubergine whatever the window theme is.

### Tools that session should pick up again

- **`frontend-design` skill** — load before writing UI. It is what kept the site off the generated-
  page defaults (no eyebrow labels, no one-word headline accents, no card-grid-for-everything).
- **`unslop`** — <https://github.com/theclaymethod/unslop>, cloned to a scratchpad in S-012. **It is
  a writing skill, not a UI one**, despite how it was introduced; it removes AI writing patterns
  from prose. Use it on every string the user will read. `references/core-contract.md` and
  `references/taboo-phrases.md` are the useful files.
- `superpowers:systematic-debugging` — used in S-012 to root-cause the Cerebras and pill failures.
- The app cannot be driven with synthetic clicks (see "Ruled out"). To see a page, temporarily
  change the default page in `renderer/src/App.tsx`, rebuild with **`pnpm dist:win`** (never bare
  `electron-builder` — koffi will not unpack), screenshot, then revert.

## Where things stand

SUBXVoice is shipped, at **0.2.0**, and the website is live at <https://subxvoice.vercel.app>.

Three repos, and confusing them is the easy mistake: `voldemort9999/subxvoice-app` holds the
desktop app and the Supabase functions (**private**); `voldemort9999/subxvoice` holds the website,
working copy at `pillow/subxvoice-web/` (private); `voldemort9999/subxvoice-releases` holds
installers and `latest.yml` and **must stay public**, because a private repo's release assets 404
for anonymous callers and that would break the download button and every update check at once.

**Dictation.** Hold `Ctrl+Win`, speak Hindi/English/mixed, release, and Roman-script Hinglish is
pasted at the cursor. Gnani `prisma-v3.0` for speech, OpenRouter for the rewrite, both behind
Supabase Edge Functions that a signed-in account unlocks, two hours per account per day.

**Composing, added in S-012.** Every transcript now goes to TypeSafe's Jev — a *decisions* model,
not a chat model — which answers one multiple-choice question: dictation, or is the speaker asking
for an email or a message to be written? Confident non-dictation answers compose instead of typing.
Everything about that path is biased toward not composing: below the 0.7 threshold, on a failed
call, with no classifier, or on an empty result, the user's own words go in. Tones are per kind
(professional / formal / casual), set in onboarding and in Settings → Writing. Emails are always
English and signed with the account name; messages keep the spoken language.

**Three releases of fixes preceded it.** 0.1.3 added a single-instance lock — opening the app
twice ran two whole copies, with two pills, two hotkey registrations and two processes writing the
same history. 0.1.4 fixed long dictations coming back in Devanagari (an upstream provider, not the
model — see below) and a pill that died and stayed dead because nothing ever recreated it. 0.1.5
stopped an unreadable clipboard taking the whole dictation down with it.

**The website was completely rebuilt** on the new palette: new tokens, a generated waveform hero,
scroll motion, and three template sections deleted outright because showing the same before-and-
after four times is what made it read as generated. 46 unused shadcn components went too.

Not built: `packages/mcp`, active-app context on macOS, `openApp` on Windows, `native/win-helper`,
SQLite, a macOS release. The build is unsigned by decision.

## After the app redesign

1. **Account-hopping resets the quota.** Two hours is per account, signup is open, so a new account
   grants another two hours. Needs a device component in `public.daily_usage` and
   `supabase/functions/_shared/usage.ts`. Raised three times; still not built.
2. Two Supabase test accounts from S-012 reproduction work are still there —
   `subx-repro-1793622615@example.com` and `subx-jev-<timestamp>@example.com`. The Management API
   could not delete them; use the dashboard.
3. `0.1.1` was only a step in testing the update path and could be removed from the releases.
4. macOS has a `release:mac` script that has never been run.

## Topic → file

| Topic | File |
|---|---|
| **Design system: three colours, the contrast rule, type, motion** | **`docs/design.md`** (read first for the app redesign) |
| Website redesign: what was deleted and why, the waveform, Reveal | 001 (S-012) |
| Composing: Jev, the decisions endpoint, thresholds, tones | 001 (S-012), `docs/decisions.md` 2026-11-10 |
| Why long dictations returned Devanagari (Cerebras, not the model) | 001 (S-012) |
| Pill and main window dying with no recovery; `revive()` | 001 (S-012) |
| Single-instance lock; dev vs installed sharing userData | 001 (S-012) |
| Clipboard snapshot throwing away a dictation | 001 (S-012) |
| Auto-update: `updater.ts`, states, install-on-quit | 001 (S-011) |
| Release pipeline: `dist` vs `release`, draft/race traps | 001 (S-011), `docs/decisions.md` 2026-11-01 |
| Why installers live in a separate **public** repo | 001 (S-011), `docs/decisions.md` 2026-11-01 |
| `productName`, install directory, `migrateUserData` | 001 (S-011) |
| Generated icon: `shared/mark.ts`, `build-icon.mjs`, zlib PNG | 001 (S-011, S-012) |
| Gnani provider: upgrade headers, commit-with-no-ack, framing | 001 (S-009) |
| Supabase backend: stt relay, llm proxy, usage, why `npm:ws` | 001 (S-010), `docs/decisions.md` 2026-10-31 |
| Auth, sessions, `safeStorage`, token-as-a-function | 001 (S-010) |
| Daily limit: table, RLS, counting bytes, Asia/Kolkata day | 001 (S-010) |
| Per-account data isolation (`userData/accounts/<id>/`) | 001 (S-010) |
| Custom hotkeys: `accepts()`, key vocabulary, the recorder | 001 (S-010) |
| Dashboard/Insights, `shared/stats.ts` | 001 (S-009) |
| Transliteration prompt, English-in-Devanagari | 001 (S-005) |
| Streaming pipeline: `open/push/finish`, why not batch | 001 (S-002) |
| Windows hotkey and paste: koffi, `GetAsyncKeyState`, `SendInput` | 001 (S-001) |
| Toolchain traps: `ELECTRON_RUN_AS_NODE`, koffi, pnpm `allowBuilds` | 001 (S-001, S-011, S-012) |
| Screenshotting and driving this app from outside — what breaks it | 001 (S-009, S-012) |

## Open decisions

- **Per-device quota, or leave account-hopping open?** Machine id alongside user id in
  `daily_usage`, close signup, or accept it. Raised in S-010, S-011 and S-012; nothing chosen.
- **What carries "the user's voice" in the app's new palette?** The old one used cyan for it and
  violet for "the product acting". The new palette has a single accent. Decide during the redesign.
- ~~**Light or dark.**~~ Settled 2026-11-10: light, for both site and app.
- ~~**Display typeface.**~~ Settled 2026-11-10: Bricolage Grotesque, after Archivo Expanded was
  rejected as stretched.
- ~~**Where installers are hosted.**~~ Settled in S-011: GitHub Releases, separate public repo.
- ~~**Code signing.**~~ Settled in S-010: unsigned. Confirmed in S-011 that unsigned auto-updates.

## Ruled out

- **Cerebras for `gpt-oss-120b`** — stops following the system prompt on long input and returns the
  Devanagari unchanged. 7 of 7 failures; Groq, CoreWeave, BaseTen and Near AI all passed. It is
  `ignore`d, not merely demoted. 001 (S-012).
- **Archivo Expanded as the display face** — widens to gain presence, read as stretched. 001 (S-012).
- **Colouring one word of a headline**, and **eyebrow labels above every heading** — named tells of
  a generated page; both tried and removed. 001 (S-012).
- **Marigold as type on Ice Silver** — 1.9:1. Fills only. `docs/design.md`.
- **A loop on the hero transcript that is short** — the hold is 5s on purpose; a tight loop turns
  the page's one honest moment into wallpaper. 001 (S-012).
- **`npx electron-builder` directly** — koffi is not unpacked and the app crashes at import. Always
  `pnpm dist:win`. 001 (S-012).
- **Driving this app with synthetic mouse/keyboard input** — ALT opens the native menu bar and the
  next click closes the window. Change the default page and rebuild instead. 001 (S-009, S-012).
- **Supabase Storage for installers** — free tier caps egress at 5 GB/month. 001 (S-011).
- **`WebSocketStream` in Supabase Edge Functions** — not defined in that runtime. 001 (S-010).
- **Batch speech-to-text** — release→paste scaled with how long the user spoke. 001 (S-002).
- **Soniox** — replaced by Gnani on 2026-10-30, a project requirement. 001 (S-009).
- `format=transliterate` as a replacement for the LLM pass — it paraphrases. 001 (S-009).
- A low-level Windows keyboard hook (uiohook-napi) — Windows silently removes it. 001 (S-001).

## Settled

- `context/` is **committed**, not gitignored — S-007.
- Email and password only; signing up does not sign you in — S-010.
- Settings stay with the **machine**; transcripts, dictionary and audio follow the **account** — S-010.
- `pnpm dist:*` never publishes; `pnpm release:*` is the only thing that does — S-011.
- Every example on the website is **real output from the shipped app**, never written for the page
  — S-012, `docs/design.md`.

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
| S-012 | 2026-11-02 → 11-10 | Composing via Jev; 0.1.3–0.2.0 fixes; website rebuilt on the new palette | 001 |
