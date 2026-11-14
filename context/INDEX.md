# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-14 · after S-016 · `subxvoice-app` `main` at `5bc4e7f` **plus a large
uncommitted change set (all of command mode, ~33 paths)** · website `main` at `6fdf2c4`. Current
journal file is **`002`** (407 lines; `001` closed at 992).

## Where things stand

SUBXVoice **0.3.0** is released (2026-11-10) and is what the website's download button serves:
hold `Ctrl+Win`, speak Hindi/English/mixed, release, Roman Hinglish at the cursor — Gnani
`prisma-v3.0` for speech, gpt-oss-120b (Groq) for the rewrite, Jev to tell dictation from "write me
an email". Two hours per account per day. The demo video for Gnani AI's Great Indian AI Internship
Challenge is rendered (`pillow/subxvoice-video/out/subxvoice-demo.mp4`); the deadline was extended
to roughly **2026-11-15**.

**Command mode is built and being tested by the user, still uncommitted.** Hold **`Ctrl+Alt`**, say
what to do; Gemini (`google/gemini-2.5-flash`) splits it into steps, Jev (`typesafe/jev-1.14`)
picks an action per step, Gemini fills the details. Windows actions live in
`packages/platform-win/src/commands.ts` on one long-lived PowerShell running C# (`interop.ts`):
apps, websites, volume, keys, windows, programs, files (find / show selected / copy / make folder),
screenshot, brightness, radios, power, status. **Screen control** reads any app's accessibility tree
through hand-declared UIA3 (`CmdUia`) and lets Jev pick the element: YouTube results ("chalao"
plays the 1st), WhatsApp search and chats, Gmail rows, typing into a named box. WhatsApp messages
are one fixed checked procedure and are **typed, never sent** unless the user separately says
"ab send kar do". Everything is described in `docs/command-mode.md`.

The user has run eight voice tests over 2026-11-11/12; each log drove fixes (S-015). The last
three problems, all fixed on 2026-11-12 and **not yet re-tested by the user**:
- WhatsApp cold after a reboot: steps now wait while a window is still loading, never for nothing.
- "hi" went to "Yash arya" for "Aryan" (a stale list was clicked — my own regression): results are
  now read until stable, and the message box's "Type a message to <name>" must match.
- **The pill stuck on "•••" for good** — root cause found live in the running app: a tap's late
  cancel cleared the next press's speech stream (`docs/architecture.md` → "One press at a time").
  Fixed with a press number; `dictation.test.ts` reproduces it.

On 2026-11-14 (S-016) the user's retest went mostly right (WhatsApp to the right chat, files,
brightness, radios). Fixed that day: "Opened Pictures" over **invisible** Explorer windows
(`windowsHide`), **`bluetooth_device`** (connect/disconnect paired earbuds — live: OnePlus Buds 4
in 6.2 s), a **Roman retry** for dictation answers left in Devanagari, "quit/band karo" planned as
closing the window, and a 4 s look for a just-opened page's window. Live suites: Windows 12/12,
end-to-end 22/24 with both failures passing on rerun. Not yet re-tested by the user.

"Pictures" is misheard constantly among Hindi ("search folder", "features"); command-mode keyterms
(`COMMAND_TERMS`) were added but are unmeasured. The user asked again for an **image fallback**
(look at a screenshot only when the tree fails — would make BlueStacks possible); a probe showed
Jev takes images through our backend cheaply but placed a click one grid cell off.

The dev app runs from the scratchpad log `dev15.log`; the installed 0.3.0 must be closed for it
(after a reboot it starts itself and takes the single-instance lock).

Three repos, and confusing them is the easy mistake: `subxvoice-app` holds the app (private);
`subxvoice` holds the website, working copy `pillow/subxvoice-web/` (private);
`subxvoice-releases` holds installers and `latest.yml` and **must stay public**.

## Continue from here

1. Ask the user how the retest went; read the dev log's `command:` / `agent:` / `screen:` /
   `dictation:` lines. If the pill freezes again, do not restart: attach with
   `node -e "process._debugProcess(<main pid>)"` and read the controller (method in 002 S-015
   Part 3 — conditional breakpoint in `tick`, then `[[Scopes]]` of `onEvent`).
2. If the user says yes to the image fallback: a screenshot of the target window (≤1,568 px a
   side), a coarse numbered grid → Jev picks a cell → crop and a finer grid → Jev again → click only
   above a floor; triggered only when `settled()` / a fixed procedure finds nothing. Start from
   `reference/command-tests/grid.ps1` and `jev-image.mjs`; needs `DecisionRequest.state` to carry an
   image part (`packages/core/src/contracts/decider.ts`, `providers/src/decider/jev.ts`).
3. Unlooked-at: "dictation: nothing heard" twice in `dev14.log`; a second opinion that ran
   `open_folder` for "resume ChatGPT pe upload kar" and said done (002 S-016 Open).
4. Then commit (the user has not asked yet), and release 0.4.0 if the user wants command mode in
   the installer before the deadline (`release:win` publishes; bump `apps/desktop/package.json`).

### Methods that work here

- **Restart the dev app** from PowerShell: stop `electron`, free port 5173,
  `Remove-Item Env:ELECTRON_RUN_AS_NODE`, `Start-Process cmd.exe "/c cd /d … && pnpm dev:desktop >
  <new log>" -WindowStyle Hidden`. A backgrounded Bash run dies with its task; `set X= &&` in cmd
  leaves a space.
- **Inspect the live main process**: `process._debugProcess(pid)` + CDP on 127.0.0.1:9229
  (scratchpad `probe.mjs`, `grab.mjs`, `deps.mjs`).
- **Live suites**: `LIVE=1` for `commands.live.test.ts`; `LIVE=1 SUBX_TOKEN=$(node
  reference/command-tests/token.mjs apps/desktop/src/main/auth.ts)` for `command.live.test.ts`
  (spends model calls); `LIVE_WHATSAPP=1` for `whatsapp.live.test.ts` (the user's own chat).
- **Model tests**: `reference/command-tests/test3.mjs`; spend credits carefully.
- **Long text / regexes**: the Write tool; never a Bash heredoc with quotes or backslashes.

## Topic → file

| Topic | File |
|---|---|
| **Command mode: design, loop, screen control, waits, WhatsApp, files, images probe** | **`docs/command-mode.md`** |
| Stuck "•••" pill: the press race and the watchdog | `docs/architecture.md`, 002 (S-015 Part 3) |
| Command mode user tests 1–8: what failed and each fix | 002 (S-014 part 4, S-015) |
| UIA3 in C#, WhatsApp/YouTube tree facts, Jev element accuracy | `docs/command-mode.md`, 002 (S-015 Part 2) |
| Live-debugging the Electron main process | 002 (S-015 Part 3) |
| Bluetooth device connect (`CmdBluetooth`), invisible Explorer windows, Roman retry | `docs/command-mode.md`, `docs/architecture.md`, 002 (S-016) |
| Jev with images (grid probe, limits, cost) | `docs/command-mode.md` → "Images", 002 (S-015) |
| Research of the three Jev repos and Windows MCPs | 002 (S-014 part 2) |
| Model comparison for the command writer | 002 (S-014 part 3), `docs/decisions.md` 2026-11-11 |
| PowerShell worker, brightness, radios, keyboard helpers | 002 (S-014, S-015 Part 1) |
| Demo video: script, Remotion project, render | 002 (S-014 part 1) |
| **Design system** | **`docs/design.md`** |
| App redesign, preview harness, favicon cache | 001 (S-013) |
| `ELECTRON_RUN_AS_NODE` | 001 (S-013), `CLAUDE.md`, 002 (S-015) |
| Website redesign | 001 (S-012) |
| Composing (Jev intent, decisions endpoint, tones) | 001 (S-012), `docs/decisions.md` 2026-11-10 |
| Pill/main window dying; `revive()`; single-instance lock | 001 (S-012) |
| Auto-update, release pipeline, public releases repo | 001 (S-011, S-013), `docs/decisions.md` 2026-11-01 |
| Gnani provider; Supabase backend; auth; daily limit | 001 (S-009, S-010) |
| Streaming pipeline; Windows hotkey and paste; toolchain traps | 001 (S-001, S-002, S-011, S-012) |

## Open decisions

- **Image fallback for apps with no tree (BlueStacks)** — the user asked for it on 2026-11-12 after
  deferring it on 11-11; probe results given, go-ahead not yet given. Costs ~$0.0003 a look.
- **Ship command mode in 0.4.0 before ~2026-11-15?** Judges download from the site.
- **Commit** — nothing from S-014/S-015 is committed; the user has not asked.
- **Language picker** (0.3.0 fixed to hi-IN) — deferred by the user.
- **Per-device quota, or leave account-hopping open?** Unanswered since S-010.
- ~~Confirm risky actions~~ — no "pakka?" (S-015). ~~Send messages~~ — never, unless asked separately.

## Ruled out

- **Asking the decider "what next?" after each step** — repeated actions. Plan first. 002.
- **A router between "API actions" and "UI automation"** — 002.
- **gpt-oss-120b / -20b as the command writer**; **gemini-2.5-flash-lite** (unstable across prompt
  changes) — 002, `docs/decisions.md`.
- **.NET `System.Windows.Automation`** — blind inside WhatsApp's WebView2; UIA3 COM instead. 002.
- **A flat UIA `FindAll`** — 2.4 s on WhatsApp. 002.
- **Messaging as four planned screen steps** — broke whenever one was skipped. 002.
- **Choosing a window by every word of the step** — "search" matched a Google tab. 002.
- **Reading WhatsApp's results right after typing** — stale list, wrong chat clicked. 002.
- **Supabase session lock as the cause of the stuck pill** — disproven live. 002.
- **Bundling the Python MCP**; **Fn in a hotkey**; **C# in a plain template literal** — 002.
- **Cerebras**; **Archivo Expanded**; **Marigold on Ice Silver**; **`npx electron-builder`**;
  **synthetic input to drive this app**; **Supabase Storage for installers**; **Soniox**; **a
  low-level keyboard hook** — 001, `docs/design.md`.

## Settled

- `context/` is committed — S-007. Email/password only — S-010. `dist:*` never publishes,
  `release:*` does — S-011. Every example on the site and in the app is real output — S-012.
- Command mode never touches dictation: separate key, separate writer, `Pipeline.listen()`.
- The original MCP at `Projects/mcp/computer-mcp` is never touched; the copy is in
  `reference/computer-mcp/`. Do not push to or re-add `aryan-2255/subxvoice`.

## Sessions

| # | Date | What | File |
|---|---|---|---|
| S-001–S-008 | 2026-10-01 → 10-30 | Pipeline, Windows platform, prompts, context system, fresh repo | 001 |
| S-009 | 2026-10-30 | Gnani replaces Soniox; dashboard, insights | 001 |
| S-010 | 2026-10-31 | Supabase backend, accounts, 2 h/day limit | 001 |
| S-011 | 2026-11-01 | Auto-update, public release repo, website live | 001 |
| S-012 | 2026-11-02 → 11-10 | Composing via Jev; 0.1.3–0.2.0 fixes; website redesign | 001 |
| S-013 | 2026-11-10 | App redesign; favicon fix; 0.3.0 released | 001 |
| S-014 | 2026-11-10 → 11-11 | Demo video; command mode researched, built, first test, loop rewritten | 002 |
| S-015 | 2026-11-11 → 11-12 | All Windows actions; screen control (UIA3 + Jev); eight user tests; stuck pill root cause | 002 |
| S-016 | 2026-11-14 | Invisible Explorer windows; Bluetooth devices; Roman retry; live suites | 002 |
