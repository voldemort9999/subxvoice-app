# Context index

Rewritten in full by `/context-write`. Read this plus `CLAUDE.md` at the start of every session;
read a numbered file only when the topic table below points at it.

Where things live: this journal is `subxvoice/context/`; the `/context-read` and `/context-write`
commands are one level up at `pillow/.claude/commands/`, because Claude Code is rooted at `pillow/`
and that folder is not a git repository. See `subxvoice/CLAUDE.md` → "Context system".

Last updated: 2026-11-14 · after S-016 · `subxvoice-app` `main` at `9fe35f6` (0.4.0 is `ab3949b`),
**nothing uncommitted** · website `main` at `6fdf2c4`, unchanged · current journal file **`002`**
(463 lines; `001` closed at 992).

## Where things stand

**SUBXVoice 0.4.0 is released (2026-11-14) and live everywhere.** The release `v0.4.0` on
`subxvoice-releases` carries the installer (113,214,013 bytes), its blockmap and `latest.yml`; the
website's download button (`subxvoice-web/src/lib/download.ts`, a `releases/latest/download/` link)
serves it; every 0.3.0 install auto-updates to it. The website needed no change — it names no
version. On the dev machine 0.4.0 was installed from that installer, then every SUBXVoice process
was force-killed at the user's request, so **nothing SUBXVoice is running**; a copy of the
installer is at `C:\Users\BHAVESH\Downloads\SUBXVoice-0.4.0-setup.exe`.

What 0.4.0 is. **Dictation** (since 0.1): hold `Ctrl+Win`, speak Hindi/English/mixed, release, and
Roman Hinglish lands at the cursor — Gnani `prisma-v3.0` for speech, gpt-oss-120b (Groq) for the
rewrite, Jev to tell dictation from "write me an email". New in 0.4.0, a Devanagari answer when
Roman was asked for is retried once. **Command mode** (new): hold **`Ctrl+Alt`**, say what to do;
Gemini (`google/gemini-2.5-flash`) plans steps, Jev (`typesafe/jev-1.14`) picks an action per step,
Gemini fills its details. Windows actions are `packages/platform-win/src/commands.ts` on one
long-lived PowerShell running C# (`interop.ts`): apps, websites, volume, keys, windows, programs,
files, screenshot, brightness, radios, **Bluetooth devices** (connect paired earbuds), power,
status. **Screen control** reads any app's accessibility tree through hand-declared UIA3 and lets
Jev pick the element (YouTube results, WhatsApp chats, Gmail rows, a named box). WhatsApp messages
are a fixed checked procedure — the open chat's box must name the person — and are **typed, never
sent** unless the user separately says "ab send kar do". All of it: `docs/command-mode.md`. The
pill-stuck-on-"•••" race and the Roman retry: `docs/architecture.md`.

How it got here. S-014/S-015 built command mode through eight voice tests by the user, each log
driving fixes; S-016 fixed the last test's faults (folders that opened invisibly, Bluetooth
devices, Roman, "quit" planned as killing), ran the live suites (Windows 12/12, end-to-end 22/24
with both failures passing on rerun), smoke-tested the packaged exe from the inside, committed and
released. **The user has not yet used 0.4.0 by voice after the S-016 fixes**; nothing is known to
be broken.

Known weak spots, none blocking: "Pictures" is misheard among Hindi ("search folder", "features"),
with `COMMAND_TERMS` keyterms added but unmeasured; the planner occasionally plans differently for
the same sentence (BlueStacks Instance Manager once became a screen click); apps that draw their own
screen (BlueStacks, games) have no tree, so screen control cannot act in them — the **image
fallback** the user asked for would; a probe showed Jev takes screenshots through our backend for
~$0.0003 but placed a click one grid cell off. The Gnani challenge deadline is ~**2026-11-15**; the
demo video is `pillow/subxvoice-video/out/subxvoice-demo.mp4`.

Three repos, and confusing them is the easy mistake: `subxvoice-app` holds the app (private);
`subxvoice` holds the website, working copy `pillow/subxvoice-web/` (private);
`subxvoice-releases` holds installers and `latest.yml` and **must stay public**.

## Continue from here

1. Ask the user how 0.4.0 behaves in use. For a fault, run the dev app (method below; close the
   installed app first — it holds the single-instance lock and starts itself after a reboot) and
   read the log's `command:` / `agent:` / `screen:` / `dictation:` lines. If the pill freezes, do not
   restart: attach the inspector and read the controller (002 S-015 Part 3).
2. Waiting on the user: the image fallback (design in Open decisions) and the installer UAC prompt.
3. Small, unlooked-at: "dictation: nothing heard" twice in the 2026-11-14 test log; a second
   opinion that ran `open_folder` for "resume ChatGPT pe upload kar" and reported done.
4. Next release: bump `apps/desktop/package.json`; `dist:win`; smoke-test `dist/win-unpacked`
   (launch it, attach the inspector, run a command through the workflow's `command` — 002 S-016);
   commit; push; `release:win`; check `latest.yml` and the site link.

### Methods that work here

- **Dev app**, from PowerShell: stop `electron`, free port 5173,
  `Remove-Item Env:ELECTRON_RUN_AS_NODE`, then
  `Start-Process cmd.exe "/c cd /d <subxvoice> && pnpm dev:desktop > <new log>" -WindowStyle Hidden`.
  A backgrounded Bash run dies with its task; cmd's `set X= &&` leaves a space; a still-locked old
  log makes the redirect fail.
- **Installed exe** from an agent shell: `explorer.exe <path>` (ELECTRON_RUN_AS_NODE leaks in).
- **Inside a running main process** (dev or packaged): `node -e "process._debugProcess(<pid>)"`,
  CDP on 127.0.0.1:9229; a never-pausing conditional breakpoint in the hotkey `tick` grabs the
  poller, `[[Scopes]]` of its `onEvent` reach the `DictationController` and the workflow `deps`.
  Scripts were in the session scratchpad (`grab.mjs`, `deps.mjs`, `run-command.mjs`) — rewrite
  from 002 S-015/S-016 if gone.
- **Live suites**: `LIVE=1` for `packages/platform-win/src/commands.live.test.ts`;
  `LIVE=1 SUBX_TOKEN=$(node reference/command-tests/token.mjs apps/desktop/src/main/auth.ts)` for
  `apps/desktop/src/main/command.live.test.ts` (spends model calls); `LIVE_WHATSAPP=1` for
  `whatsapp.live.test.ts` (the user's own chat). `console.log` from a vitest probe is swallowed —
  write to a file.
- **Model tests**: `reference/command-tests/test3.mjs`; spend OpenRouter credits carefully.
- **Long text / regexes**: the Write tool; never a Bash heredoc with quotes or backslashes.

## Topic → file

| Topic | File |
|---|---|
| **Command mode: design, loop, screen control, waits, WhatsApp, files, Bluetooth, images probe** | **`docs/command-mode.md`** |
| Stuck "•••" pill (press race, watchdog); Roman retry | `docs/architecture.md`, 002 (S-015 Part 3, S-016) |
| The 0.4.0 release: smoke test, publish, verification, UAC question | 002 (S-016) |
| Command mode user tests 1–9: what failed and each fix | 002 (S-014 part 4, S-015, S-016) |
| Invisible Explorer windows (`windowsHide`), `CmdBluetooth` | `docs/command-mode.md`, 002 (S-016) |
| UIA3 in C#, WhatsApp/YouTube tree facts, Jev element accuracy | `docs/command-mode.md`, 002 (S-015 Part 2) |
| Live-debugging the Electron main process | 002 (S-015 Part 3, S-016) |
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
| Auto-update, release pipeline, public releases repo | 001 (S-011, S-013), 002 (S-016), `docs/decisions.md` 2026-11-01 |
| Gnani provider; Supabase backend; auth; daily limit | 001 (S-009, S-010) |
| Streaming pipeline; Windows hotkey and paste; toolchain traps | 001 (S-001, S-002, S-011, S-012) |

## Open decisions

- **Image fallback for apps with no tree (BlueStacks)** — asked for on 2026-11-12 (deferred on
  11-11). Proposed: screenshot of the window (≤1,568 px a side) → coarse numbered grid → Jev picks a
  cell → crop with a finer grid → Jev again → click only above a floor; used only when the tree
  finds nothing. Start from `reference/command-tests/grid.ps1` / `jev-image.mjs`; needs
  `DecisionRequest.state` to carry an image part. Go-ahead not given.
- **UAC prompt in the installer** — asked for on 2026-11-14; not done: nothing needs admin, the
  installer is per-user (a per-machine one would strand every existing install's updates), and an
  elevated app cannot receive key presses (UIPI). Waiting on the user.
- **Language picker** (fixed to hi-IN) — deferred by the user.
- **Per-device quota, or leave account-hopping open?** Unanswered since S-010.
- ~~Confirm risky actions~~ — no "pakka?". ~~Send messages~~ — never, unless asked separately.
  ~~Ship command mode before the deadline~~ — released in 0.4.0.

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
- **`spawn("explorer.exe", …, {windowsHide})`** — opens folders invisibly. 002 S-016.
- **WinRT / PnP / Python libraries for Bluetooth device connect** — the computer-mcp's record;
  `BluetoothSetServiceState` cycling instead. `docs/command-mode.md`.
- **Bundling the Python MCP**; **Fn in a hotkey**; **C# in a plain template literal** — 002.
- **Cerebras**; **Archivo Expanded**; **Marigold on Ice Silver**; **`npx electron-builder`**;
  **synthetic input to drive this app**; **Supabase Storage for installers**; **Soniox**; **a
  low-level keyboard hook** — 001, `docs/design.md`.

## Settled

- `context/` is committed — S-007. Email/password only — S-010. `dist:*` never publishes,
  `release:*` does — S-011. Every example on the site and in the app is real output — S-012.
- Command mode never touches dictation: separate key, separate writer, `Pipeline.listen()`.
- The original MCP at `Projects/mcp/computer-mcp` is never touched; the copy is in
  `reference/computer-mcp/` (gitignored). Do not push to or re-add `aryan-2255/subxvoice`.

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
| S-016 | 2026-11-14 | Invisible folders; Bluetooth devices; Roman retry; live suites; **0.4.0 released** | 002 |
