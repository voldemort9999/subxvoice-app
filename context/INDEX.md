# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-10 · after S-013 · `subxvoice-app` `main` at `394c600` (+ this journal
commit), `subxvoice` (website) `main` at `6fdf2c4`. **`001` is at 992 lines — the next entry
starts `002`.**

## Where things stand

SUBXVoice is shipped at **0.3.0**, released 2026-11-10 to `voldemort9999/subxvoice-releases`
(not a draft; `latest.yml` = 0.3.0), and installed on the user's machine. The website is live at
<https://subxvoice.vercel.app>; its download button points at `releases/latest/download/`, so it
already hands out 0.3.0 and never needs a redeploy for a release. Installed copies on 0.2.0 pick
the update up through the auto-updater.

**0.3.0 is the redesign.** Both the site and the app now run on one design system — Ice Silver
`#DDE3E8` 60%, Deep Aubergine `#3A0F34` 30%, Marigold `#EAAA00` 10% — written up in
`docs/design.md`, which now has a section on how the app applies it. In short: light by default;
the sidebar is the one Aubergine surface, so the current page can be Marigold *type*; no cards,
sections sit on hairlines; the user's voice is a typeface (heard = DM Mono, typed = Archivo on a
Marigold edge) rather than a second accent; no red or green — attention is a `Notice` on a
Marigold edge; the pill is Aubergine in both themes. Fonts are bundled from `@fontsource` because
the window must work offline and its CSP allows only `'self'`. The user used it and approved it:
"UI bhi achhi hai, dono cheezein achhi hain".

**Icons are one definition everywhere.** `apps/desktop/src/shared/mark.ts` holds the geometry and
feeds the window and tray (`main/brand.ts`), the installer (`scripts/build-icon.mjs`), the
in-app logo (`renderer/src/shared/Mark.tsx`) and the website's favicons. The Windows tray now
shows the whole mark. The website's tab icon looked stale only because browsers cache favicons by
URL; the links are versioned `?v=2` — bump that whenever the mark changes.

**What the product does.** Hold `Ctrl+Win`, speak Hindi/English/mixed, release, and Roman-script
Hinglish lands at the cursor. Gnani `prisma-v3.0` for speech, OpenRouter for the rewrite, both
behind Supabase Edge Functions that a signed-in account unlocks, two hours per account per day.
Every transcript also goes to TypeSafe's Jev (a decisions model) to decide dictation vs "write me
an email/message"; anything below 0.7 confidence, or any failure, types the user's own words.

Three repos, and confusing them is the easy mistake: `subxvoice-app` holds the app and the
Supabase functions (private); `subxvoice` holds the website, working copy `pillow/subxvoice-web/`
(private); `subxvoice-releases` holds installers and `latest.yml` and **must stay public**.

Not built: `packages/mcp`, active-app context on macOS, `openApp` on Windows, `native/win-helper`,
SQLite, a macOS release. The build is unsigned by decision.

## Continue from here

**The demo video.** The user is about to make one and wants Claude to build it. Plan offered in
S-013: the user screen-records real dictation (Win+Alt+R / OBS, a few takes of Hinglish into
WhatsApp/Gmail/Notepad, plus one "write a mail to…" compose); a session scaffolds a **Remotion**
project *outside the app repo* (e.g. `pillow/subxvoice-video/`), builds title cards, the waveform
and captions on the site's palette and fonts, cuts the recordings in, and renders an MP4 locally
with `npx remotion render`. Every on-screen example must be real app output (`docs/design.md`,
principle 1). Ask for the recording paths and the target length/format first.

After that, in order:

1. **Account-hopping resets the quota.** Two hours is per account and signup is open. Needs a
   device component in `public.daily_usage` and `supabase/functions/_shared/usage.ts`. Raised in
   S-010, S-011, S-012; still not built.
2. Two Supabase test accounts from S-012 (`subx-repro-1793622615@example.com`,
   `subx-jev-<timestamp>@example.com`) — delete from the dashboard; the Management API could not.
3. `0.1.1` was only a step in testing the update path and could be removed from the releases.
4. macOS has a `release:mac` script that has never been run.

### Tools and methods that work here

- **`frontend-design` skill** before writing UI; **`unslop`** (writing, not UI) on user-facing copy.
- **Seeing the renderer without the app**: the browser preview harness described in 001 (S-013,
  Established) — plain vite on `src/renderer`, stub `window.subx`, real `history.json` copy,
  headless Edge `--screenshot`. Use it instead of rebuilding when the installed app is running.
- **Launching the installed exe from an agent shell**: `explorer.exe <path>`, because
  `ELECTRON_RUN_AS_NODE=1` leaks in from VS Code (`CLAUDE.md` gotchas).
- Releasing: bump `apps/desktop/package.json`, `pnpm dist:win` as a dry run, commit and push, then
  `pnpm release:win`; verify `latest.yml` and the `releases/latest/download/` size.
- Long text through a bash heredoc has failed twice with "unexpected EOF"; write it with the Write
  tool and `cat` it instead.

## Topic → file

| Topic | File |
|---|---|
| **Design system: colours, contrast rule, type, motion, how the app applies it** | **`docs/design.md`** |
| App redesign: tokens as roles, Section/Figure/Notice, theme key v2, what broke | 001 (S-013) |
| Why the user's voice is a typeface, fonts bundled not linked | `docs/decisions.md` 2026-11-10 |
| Renderer preview harness (vite + stub `window.subx` + headless Edge) | 001 (S-013) |
| Favicon caching and `?v=` on the website's icon links | 001 (S-013) |
| Unlayered CSS overriding Tailwind utilities | 001 (S-013) |
| `ELECTRON_RUN_AS_NODE` breaking the installed exe | 001 (S-013), `CLAUDE.md` |
| Website redesign: what was deleted and why, the waveform, Reveal | 001 (S-012) |
| Composing: Jev, the decisions endpoint, thresholds, tones | 001 (S-012), `docs/decisions.md` 2026-11-10 |
| Why long dictations returned Devanagari (Cerebras, not the model) | 001 (S-012) |
| Pill and main window dying with no recovery; `revive()` | 001 (S-012) |
| Single-instance lock; dev vs installed sharing userData | 001 (S-012) |
| Clipboard snapshot throwing away a dictation | 001 (S-012) |
| Auto-update: `updater.ts`, states, install-on-quit | 001 (S-011) |
| Release pipeline: `dist` vs `release`, draft/race traps | 001 (S-011, S-013), `docs/decisions.md` 2026-11-01 |
| Why installers live in a separate **public** repo | 001 (S-011), `docs/decisions.md` 2026-11-01 |
| `productName`, install directory, `migrateUserData` | 001 (S-011) |
| Generated icon: `shared/mark.ts`, `build-icon.mjs`, zlib PNG | 001 (S-011, S-012, S-013) |
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
| Toolchain traps: `ELECTRON_RUN_AS_NODE`, koffi, pnpm `allowBuilds` | 001 (S-001, S-011, S-012, S-013) |
| Screenshotting and driving this app from outside — what breaks it | 001 (S-009, S-012, S-013) |

## Open decisions

- **Demo video: length, format, where it goes** (site hero? YouTube? social?). Not asked yet.
- **Per-device quota, or leave account-hopping open?** Machine id alongside user id in
  `daily_usage`, close signup, or accept it. Raised in S-010, S-011 and S-012; nothing chosen.
- ~~What carries "the user's voice" in the new palette~~ — settled in S-013: a typeface.
- ~~Pill colour~~ — settled in S-013: Aubergine in both themes.
- ~~Light or dark~~ — light, for site and app (2026-11-10).
- ~~Display typeface~~ — Bricolage Grotesque (2026-11-10).
- ~~Where installers are hosted~~ — GitHub Releases, separate public repo (S-011).
- ~~Code signing~~ — unsigned (S-010, confirmed S-011).

## Ruled out

- **Unlayered element styles in the renderer CSS** — they beat every Tailwind utility; defaults go
  in `@layer base`. 001 (S-013).
- **Linking Google Fonts from the app** — CSP is `'self'` and the window must work offline;
  bundle from `@fontsource`. 001 (S-013).
- **Keeping the old `subx.theme` key with a new default** — every install already stored "dark".
  001 (S-013).
- **Cerebras for `gpt-oss-120b`** — ignores the system prompt on long input. 001 (S-012).
- **Archivo Expanded as the display face** — read as stretched. 001 (S-012).
- **Colouring one word of a headline**, **eyebrow labels above every heading** — generated-page
  tells. 001 (S-012).
- **Marigold as type on Ice Silver** — 1.9:1. Fills only. `docs/design.md`.
- **A short loop on the hero transcript** — the 5s hold is deliberate. 001 (S-012).
- **`npx electron-builder` directly** — koffi is not unpacked. Use `pnpm dist:win`/`release:win`.
  001 (S-012).
- **Driving this app with synthetic mouse/keyboard input** — ALT opens the menu bar and the next
  click closes the window. 001 (S-009, S-012).
- **Supabase Storage for installers** — free tier caps egress at 5 GB/month. 001 (S-011).
- **`WebSocketStream` in Supabase Edge Functions** — not defined there. 001 (S-010).
- **Batch speech-to-text** — release→paste scaled with speech length. 001 (S-002).
- **Soniox** — replaced by Gnani on 2026-10-30. 001 (S-009).
- `format=transliterate` instead of the LLM pass — it paraphrases. 001 (S-009).
- A low-level Windows keyboard hook (uiohook-napi) — Windows silently removes it. 001 (S-001).

## Settled

- `context/` is **committed**, not gitignored — S-007.
- Email and password only; signing up does not sign you in — S-010.
- Settings stay with the **machine**; transcripts, dictionary and audio follow the **account** — S-010.
- `pnpm dist:*` never publishes; `pnpm release:*` is the only thing that does — S-011.
- Every example on the website **and in the app** is real output from the shipped app — S-012, S-013.

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
| S-013 | 2026-11-10 | App redesigned on the new palette; favicon cache fix; 0.3.0 released | 001 |
