# Journal 002 — the demo video, and command mode

Continues `001-stt-pipeline-windows-and-prompt.md`, which reached 992 lines with S-013.

---

## S-014 · 2026-11-10 → 2026-11-11 · Demo video for the Gnani challenge; command mode built and first tested

Asked:
> Main ek audio record karunga, jiski script bhi tum hi doge … MiniMax Audio se voice cloning karwa
> ke … SRT file … tum ek-ek dedh minute maximum … motion graphics
> Thoda professionally English mein do … ek minute ki hi video honi chahiye
> problem statement … average typing speed human ki kitni hai, but bolne ki speed itni zyada hai
> … Key wali hata do, befaaltu lag rahi hai
> 20-30 seconds aur add, yani dedh minute ki
> all over video english me hgi rakhna … Hinglish aur Hindi mat kiya karna (except the one scene
> where Hindi is spoken, and there in English letters)
> ruko mere audio aur srt dene k baad kaam start karna
> video theek bani hai. Bahut zyada achhi to nahi, par theek bani hai … save rakhna
> ek feature lana chahta hoon … "Follow My Words" … Notepad open karo, to Notepad open apne aap ho
> jaye … volume ko kam kar do … Bluetooth off kar do … WhatsApp pe file bhej de
> best wala jo Computer Use ke MCP hai … meri wali personal MCP ko deeply analyze karo
> meri wali computer MCP … usi folder mein chhed do … mat … copy karke yahan lao
> GPT-OSS 120 billion … test karo … Agar tum kehte ho ki kaam ka nahi hai, to hum koi aur dhoondhte hain
> openrouter k credits ko waste mat karna wisely use karo
> Kya tum logs dekh sakte ho? … type karne keh raha hoon, to nahi kar raha hai … sirf Step One

### Part 1 — the 60–90 s demo video (2026-11-10)

Done:
- Challenge context from the user's screenshots: Gnani AI's "Great Indian AI Internship Challenge",
  deadline shown as 2026-11-10 23:59 IST. **On 2026-11-11 the user said it had been extended by
  five days** (so ~2026-11-15). Award categories that fit: Demo Day Drop (best 60-s video), Mixed
  Vibes (code-mixed voice).
- Script went through five versions, saved each time to `pillow/subxvoice-video/script.txt`:
  Hinglish → professional English → language-generic (not just Hindi) with a WhatsApp example and
  the exact model ("Prisma version 3.0") → problem statement first (typing ~40 wpm vs speaking
  ~150, "a 200-word email: 5 minutes typed, 80 seconds said") → expanded problem statement for
  ~90 s. The user's final edit changed "Prisma version 3.0" to "Prisma 3 model". Final script is
  the file as it stands.
- Voice: the user produced it with **ElevenLabs** (not MiniMax as first planned), voice "Hope -
  upbeat and clear", 87.17 s, plus an SRT with sentence-level cues. Copied to
  `subxvoice-video/public/voice.mp3` and `voice.srt`.
- Built `pillow/subxvoice-video/` (Remotion 4.0.542, npm, not a git repo): `src/timing.ts` holds the
  SRT cues and `when(phrase)` / `after(phrase)`, which place a phrase inside its cue by character
  share; `src/parts.tsx` (palette, Mark from mark.ts geometry, breathing Waveform, Key, Pill,
  AppWindow); `src/Demo.tsx` with 14 scenes, each pinned to phrases, two Marigold wipes, and the
  voice as `<Audio>`. `src/Root.tsx` gates rendering on fonts (`delayRender` + `document.fonts.load`).
- UI captures at 2× (2000×1360) via the S-013 preview harness: dashboard (light/dark), insights,
  history, dictionary, settings, sign-in, onboarding, four pill states (transparent PNG), website
  hero. **The history shown is curated**: 13 real, clean records from the user's accounts, dates
  spread over 13 days; profanity-laden test dictations excluded. Text, timings and audio lengths are
  real; only dates changed.
- Rendered `subxvoice-video/out/subxvoice-demo.mp4`: 1920×1080, 30 fps, H.264 CRF 16, AAC 320k,
  88.77 s, 13 MB. Sync checked by extracting frames at 12 beats from the MP4 — each visual on its word.
- Harness files copied for reuse into `subxvoice/reference/video-preview/` (gitignored).

Did not work (video):
- Long bash heredocs containing quotes/backticks failed ("unexpected EOF while looking for
  matching `'`") repeatedly; writing with the Write tool and splicing by file works.
- First stills: the question line wrapped and its caret drifted; the intro wordmark overlapped the
  challenge screenshot; the dashboard "Typed" highlight showed for 0.7 s because the history swap
  was pinned to "and every recording" — moved to "stays on".
- Headless Edge captures caught transitions mid-way until the stub injected
  `*{animation:none!important;transition:none!important}`.
- Remotion's bundled ffmpeg lacks `xstack` and `volumedetect`; contact sheets and loudness were
  done in Python instead. Measured: peak −6.8 dBFS, voice 0.07–86.87 s.

User decided (video):
- All on-screen text in English; Hinglish only in the "Kal meeting hai…" scene, in Roman letters.
- Keep the real dashboard screenshot even though its "Heard" column is Devanagari.
- No music in the render; the user adds it later.
- No language picker before the video; the "Hindi, Tamil, Bengali" line stays as a statement about
  Prisma (0.3.0 is fixed to hi-IN).
- Verdict: "theek bani hai. Bahut zyada achhi to nahi". Keep everything saved.

### Part 2 — command mode, researched (2026-11-11)

Done:
- Read the user's personal MCP at `Projects/mcp/computer-mcp` (91 tools, 18.4k lines Python,
  FastMCP, zero git commits). It has **no screen control at all** — `send_input` is terminal stdin.
- Researched the three repos the user gave and the field: `awlevin/typesafe-computer-use` (macOS),
  `ZJU-REAL/CUA-JEV` (Windows + UIA, research-grade), `browser-use/jev-ultrafast` (browser only).
  All three use the same shape: code builds a numbered list of legal actions, Jev picks one, a small
  LLM writes free text only. Windows-MCP (CursorTouch, UIA-based, Python 3.14+) is the common pick
  for Windows. Perception is the accessibility tree, not pixels.
- Talked the user out of a top-level "Mode A (API) vs Mode B (UI automation)" router: one loop, one
  merged menu, actions described by outcome, mechanism hidden from Jev. Named it in
  `docs/command-mode.md`. Hotkey **Ctrl+Alt** (Fn never reaches Windows; Win in a chord risks Start).
- Copied the MCP (minus `.venv`, `.git`) to `subxvoice/reference/computer-mcp/`, gitignored; the
  original was not touched, per the user.

### Part 3 — model test (2026-11-11)

Done (script: `reference/command-tests/test.mjs`, `test3.mjs`; one test account, token reused):
- Jev on a 15-option menu: 40/42, then **42/42** after renaming open_web to include "play something
  on YouTube" (the miss had confidence 0.50). **21/21 on Devanagari input** as Gnani returns it.
- Writer candidates, 17 cases × 3 runs:

  | model | right | calls > 2 s | median | max |
  |---|---|---|---|---|
  | openai/gpt-oss-120b (Groq) | 47/51 | 19 | 1377 ms | 15.0 s |
  | openai/gpt-oss-20b | 41/51 | 0 | 539 ms | 1.1 s |
  | meta-llama/llama-4-scout | — | — | not routable for this key | — |
  | google/gemini-2.5-flash-lite | 51/51 | 0 | 988 ms | 1.46 s |

  gpt-oss-20b's misses were dangerous (Chrome in the close list when told to keep Chrome; prose
  instead of a URL). Gemini on Devanagari: 15/17, the two being format (Devanagari kept in
  `type_text`; a bare list for `close_windows`) — fixed by prompt and by `parseArgs`.
  **Chosen: gemini-2.5-flash-lite for command mode; dictation stays on gpt-oss-120b.** →
  `docs/decisions.md` 2026-11-11.
- Total spend for all model tests ≈ 5–8 US cents. Test accounts created and still present:
  `subx-cmdtest-1794382081336@example.com`, `subx-cmdtest-1794382294689@example.com`.

### Part 4 — command mode, built (2026-11-11, uncommitted)

Done:
- `packages/core/src/agent/`: `types.ts` (AgentAction with describe/args/facts/available/
  unavailable/risky; ActionSource; CommandSource with warm/dispose), `match.ts` (`resolveOne`,
  ported from the MCP's tiered matcher), `memory.ts` (AgentMemory: last 5 commands, 10 min),
  `loop.ts` (`runCommand`, `parseArgs`, `menu`). Exported from `@subx/core`. 41 tests.
- `packages/platform-win/src/powershell.ts` (persistent PowerShell worker, -EncodedCommand loop),
  `interop.ts` (CmcpAudio copied verbatim, CmdWindows translated), `commands.ts`
  (`WinCommandSource`: open_app, open_web, set_volume, app_volume, type_text, close_windows,
  kill_process, system_status; unavailable: find_files, bluetooth, wifi, focus_mode,
  screen_action). `commands.live.test.ts` (LIVE=1) 7/7 on this machine.
- Plumbing: `Mode` gained `"command"`; `Pipeline.listen()` (STT + dictionary rules only);
  `Platform.commands`; `AppSettings.commandHotkey` (default ctrl+alt, ignored if equal to the
  dictation chord); `workflow.ts` `openCommand()` (no history, failure shown as error) and
  `explain()`; `providers.ts` builds the `writer` (gemini, reasoning off, 8 s); OpenRouterLlm got
  `reasoning` and `timeoutMs` options and `LlmRequest.json` → `response_format`. Defaults unchanged
  for dictation, pinned by two tests. `apps/desktop/src/main/command.live.test.ts`
  (LIVE=1 + SUBX_TOKEN) 5/5 end to end.
- `pnpm check` 10/10 before the loop rewrite. Dev app launched (`pnpm dev:desktop`) for the user.

Did not work:
- **C# in a plain template literal**: `"\\"` escapes were consumed by JS and Add-Type failed with
  "Unexpected character '\'". Fixed with `String.raw`.
- **Gemini appended junk after valid JSON**: `{"url": "…"}\n"}`. `parseArgs` now takes the first
  complete JSON value (string-aware bracket scan).
- **A skipped `describe` still runs its body**: the live test built Jev with an empty token and
  failed the normal suite ("Jev needs a token"). Providers moved into `beforeAll`.
- **The first loop (ask "what next?" after each step, `done` as an option) failed in real use** —
  from the dev log of the user's own test: "है type करा" typed *hai* 6 times; "volume 100%" set
  twice; "blue stack instance wali window cut kar do" closed the Instance Manager **and then
  "Ownly 08" (the main BlueStacks window) twice**; "Hi लिखो" after an earlier "hi" chose `done`
  (memory read as already done); type_text came back at 0.48–0.55 and hit the 0.55 threshold
  ("Didn't catch that"); "minimize" mapped to close_windows, whose args had no minimize, so
  "Which windows?" ×5; "Control+V dabao" / "paste kar do" had no action; brightness fell to
  screen_action; Bluetooth off was unavailable; the first "YouTube खोलो" vanished without a result
  line (a writer error was not caught by the loop).
- A bash `python -c "…"` with backticks inside double quotes ran the backticked words as commands
  (it even tried to execute `docs/command-mode.md`); `docs/decisions.md` lost two words and was
  repaired with Edit. Never put backticks inside a double-quoted bash string.

Established:
- `user32` window enumeration through C#: the dev machine's taskbar is exactly four windows; ~70 ms
  first call. Program-by-memory list puts chrome (5.5 GB), Code, node, msedgewebview2, **claude**
  at the top — "claude" is Claude Code itself and is not protected.
- `Get-StartApps`: 255 apps, ~676 ms; Chrome's AppID is `Chrome`, Notepad and WhatsApp are packaged
  (`…!App`). Notepad opens and is focused in ~1 s.
- The dev machine has **no battery** (desktop); WMI brightness returns no instances; **DDC/CI works**
  on its monitor — `[CmdBrightness]::Get()` read 100 (`reference/command-tests/brightness.cs`).
- Keyboard input already exists: `sendChord(modifiers, vk)` and `waitForModifiersUp()` in
  `platform-win/src/win32.ts`; the key vocabulary is `KEYS` in `hotkey.ts` (not exported yet).
- Radios: the MCP turns Wi-Fi/Bluetooth on and off with WinRT `Windows.Devices.Radios.Radio`
  through an `Await` reflection helper (`reference/computer-mcp/.../core/network.py`, `_AWAIT`,
  `_RADIO_SCRIPT`, `set_radio`); "Allowed" means permitted, so state must be re-read.

User decided:
- Build the merged loop now; keep UI automation in the menu but disabled ("UI automation full rahe,
  lekin use abhi ke liye disabled ho").
- Do not touch the original MCP; work from a copy.
- Spend OpenRouter credits carefully.
- Judges download from the site, so whatever is demoed must work from the installer.

Open — exactly where this stopped:
- **The loop was rewritten to plan-first** (`loop.ts`, 41 tests green) **but `commands.ts` has not
  been updated for it yet**, and `pnpm check` has not been run since. Still to do in `commands.ts`:
  mark `close_windows` and `kill_process` `risky: true`; split windows into `close_windows` (risky)
  and `arrange_windows` (minimize / maximize / restore / focus, via a `ShowWindow` method to add to
  `CmdWindows`); add `press_keys` (`{"keys": "ctrl+v", "times"?}` via exported `KEYS` +
  `sendChord`, after `waitForModifiersUp`); add `brightness` (`{"level": number|null}`; WMI for a
  laptop panel, `CmdBrightness` DDC/CI for monitors — embed `brightness.cs` as a third INTEROP
  block in `String.raw`); turn `bluetooth` and `wifi` into radio on/off with the MCP's `Await`
  helper as an extra preload; keep a separate unavailable `bluetooth_device` for connecting
  headphones. Then `pnpm check`, re-run the two live suites, restart the dev app and have the user
  repeat their test list.
- Not decided: ask "pakka?" before risky actions, or rely on the 0.7 confidence floor.
- Settings UI for the command key; `docs/command-mode.md` "First scope" list predates the rewrite.
- UI automation (`UiaSource`) for WhatsApp search, "second video", "top email".
- Nothing from this session is committed. The dev app (`electron.exe`) is running; the installed
  0.3.0 was closed for it.

---

## S-015 · 2026-11-11 → 2026-11-12 · Command mode finished on Windows, screen control (UIA3 + Jev), eight user tests, and the stuck "•••" pill found

Asked:
> continue karo … logs mein dikkat aayi thi … exactly spot karo jahan par hum ruke the … continnue koi pakka nahi karwa do bas
> screenshot nahi liya (2K display) … File Manager search in Pictures … Claude ki jagah YouTube/Google search … Maine kaha YouTube search maar, Google search maar, to maaro … BlueStacks default … Instance Manager … Phir UI automation bhi lagayenge.
> UI Automation jo hai, uske liye jo humne repos dekhi thi… waisi hi hai na?… Aisa to nahi ki tum starting se scratch se bana rahe ho
> main chahunga ki send na kare abhi ke liye, sirf type kare, ruk jaaye … main specifically kahun ki … ab ise send kar do, aisa kahunga to bhej do … Baaki by default na bheje
> ye screen pe click nahi kar raha hai … kuch kaam nahi kar rahi hai. Dekho kya dikkat hai aur fix karo.
> basic level of intelligence aur accountability … WhatsApp open hai ya nahi, search bar empty hai ya nahi … clear … name search … Hi likho
> YouTube pe chalao … first wala chalao … context management … time limit … shouldn't have to keep saying YouTube
> WhatsApp open tha, minimize nahi tha, phir bhi "Couldn't find WhatsApp" … ready banao har kaam ke liye
> stuck ho gya restasrt kro … firse atak gaya ache se fix karo , real cause find krke
> Wait tabhi karna hai jab WhatsApp loading mein chal raha ho … ye sirf WhatsApp ke liye nahi tha … saari possibilities ko dekh ke achhe se fix karo
> Pictures folder mein … My Resume.pdf … Downloads folder ko open kar diya … folder directly open hi karke dikha do … file hai to use highlight karo
> isne Arya ko message bheja hai … baar-baar search-search sun raha hai Pictures ko … transcription mein hi kami hai … apne configuration ko fix karo
> TypeSafe ka model … image support karta hai … jab "Can't find" aata hai … tabhi image dekhe. Har baar image nahi dekhe … BlueStacks bhi chala paayega.
> Ye phir se band pad chuka hai. Achhe se dekho kya dikkat hai … poora stuck ho chuka hai.

### Part 1 — `commands.ts` completed for the plan-first loop (2026-11-11)

Done:
- Everything S-014 left open in `packages/platform-win/src/commands.ts`: `close_windows` and
  `kill_process` `risky`; `arrange_windows` (minimize / maximize / restore / focus via
  `CmdWindows.Show(handle, cmd)`); `press_keys` (exported `KEYS` from `hotkey.ts`, `KEY_ALIASES`,
  PrintScreen VK 0x2C, at most 20 presses); `brightness` (WMI + DDC/CI as the `BRIGHTNESS` C# block);
  `bluetooth` / `wifi` radios (WinRT `Await`, wifi risky); `power` (risky: lock, sleep, restart /
  shutdown in 15 s, sign out, cancel); `system_status`; `screenshot` (largest display by default,
  `CmdScreen.Capture` with per-monitor DPI, to Pictures\Screenshots and the clipboard);
  `find_files`, `open_folder`, `make_folder`, `copy_files` (`PLACES` / `Resolve-Place`, never
  overwrite).
- `open_app` sees the installed-apps list, picks by sound, and on several equal matches takes the
  plainest name ("BlueStacks" → BlueStacks 5, not Multi-Instance Manager); `SITES` fallback for
  websites.
- Planner rules in `SPLIT_SYSTEM` for each failure in the user's second and third tests (no web
  search as a fallback, app names as heard, type only when asked, a tab is Ctrl+W, an "ALREADY
  DONE" heading for earlier commands). No "pakka?" (`docs/decisions.md` 2026-11-11).
- Writer moved to `google/gemini-2.5-flash` (`docs/decisions.md` 2026-11-11); `completeOnce`
  retries once after 0.7 s.

### Part 2 — screen control (2026-11-11)

Done:
- `packages/core/src/agent/screen.ts`: `screenSource` with `screen_click`, `screen_type`,
  `screen_read`; `clickable()` (one element per 40-char name start, best role), `boxes()`,
  numbered results ("1st result: …"; only timed items when items carry durations), unlabelled
  boxes described by position, single-candidate rule, writer second opinion within Jev's top 3.
  The CUA-JEV / jev-ultrafast shape the user asked about — not invented from scratch.
- `packages/platform-win/src/screen.ts` (`WinScreenDriver`, `chooseWindow`, `namedPlace`) and the
  `CmdUia` UIA3 block in `interop.ts` (hand-declared COM, depth-first pruned walk). Details in
  `docs/command-mode.md` → "Screen control".
- `whatsapp_message` as one fixed procedure; `holdBackSending`; `AgentMemory.continuing()` (3 min);
  `open_web` "here" (Ctrl+L in a New Tab); typing replaces the box (Ctrl+A) and is read back.
- Tests: core `screen.test.ts`, `loop.test.ts`; platform-win `screen.test.ts`; live
  `commands.live.test.ts` (12), `apps/desktop/src/main/command.live.test.ts` (24 e2e, real models),
  `whatsapp.live.test.ts` (`LIVE_WHATSAPP=1`, the user's own "@MCUPortal (You)" chat).

Did not work:
- .NET `System.Windows.Automation` saw five title-bar buttons in WhatsApp — UIA3 COM was needed.
- `CmdUia` failed to compile ("Unable to find type [CmdUia]") because a `Value` constant and a
  `Value` method clashed; renamed to `CurrentValue`. Preload failures were silent until
  `powershell.ts` started logging them.
- A flat `FindAll` on WhatsApp took 2.4 s; the depth-first pruned walk takes ~90 ms.
- Jev split its vote on YouTube (Text/Link/Group of one video, two link wordings) → dedupe.
  "4th video" unnumbered: 0.21; numbered: 0.99.
- Choosing the window by all of a step's words matched "search" to a Chrome tab "… Google Search";
  falling back to the front Chrome tab clicked an ad → place-only scoring, `GENERIC`, `namedPlace`.
- A live test closed the user's own "Untitled - Notepad" (same title as the test's). Duplicate
  titles now mean the topmost window only. Apologised; the user's Notepad stayed.
- Planner: the writer filled "hi" for the name (→ ARGS "THIS STEP only"); "Press Enter" was planned
  for "bhejo" (→ `holdBackSending` in code); "shutdown" re-killed msedgewebview2 from memory
  (→ did-only memory); flash-lite broke a different command per prompt change (→ flash).
- WhatsApp's search box loses its name once filled → HelpText fallback, `where`, position label.
- A live test of a misheard name opened the user's real "MCU Portal" group (messages likely marked
  read). An existing "Anal: Draft: hi" was found that this session did not create — left alone.
- Bash heredocs turned `\b` into backspace in TS regexes, and a heredoc with an apostrophe failed
  to parse; Python patches and long text are written with the Write tool, CRLF avoided with
  `newline=''`.

### Part 3 — the stuck "•••" pill, and the 2026-11-12 tests

Done:
- 2026-11-11: pill stuck on "•••", every later press ignored. A Supabase session lock was
  suspected and **disproven** live (`process._debugProcess` + CDP: `auth:state` answered in 0 ms;
  no open sockets). Added the `STUCK_MS` watchdog and stage logging in `dictation.ts`; restarted.
- 2026-11-12, first test (`dev-run10.log` in the scratchpad): WhatsApp cold after a reboot →
  "Couldn't find WhatsApp's search box"; "resume" in "इस तरह वाले folder" (Pictures, misheard)
  opened Downloads. Fixes: `settled()` in core `screen.ts` (re-read while the window changes,
  ≤10 s); `whatsappWait` per element (20 s / 4 s); `LAUNCH_WAIT_MS` 6 → 15 s; `find_files` opens a
  matching folder and names other folders; a planner example keeps the place.
- Second test (`dev12.log`): "hi" typed into **Yash arya's** chat for "Aryan"; "Pictures" heard
  as "search" / "features" / "picture" seven times; `in: "this folder"` / `"current folder"`
  failed. Fixes: `whatsappResults()` (rows read until two reads agree); the message box's name must
  match ("Type a message to <name>") or nothing is typed; `explorerFolder()` for "this folder";
  `FIND_SCRIPT` falls back to every place; `COMMAND_TERMS` keyterms in `Pipeline.listen()`.
  → `docs/command-mode.md`.
- Jev image probe: accepted through the backend, $0.0003, ~1 s, but one cell off on the one object
  present. → `docs/command-mode.md` → "Images". Scripts kept in `reference/command-tests/grid.ps1`
  and `jev-image.mjs`.
- Third freeze (2026-11-12, after a Gmail/YouTube run): **root cause found live.** A conditional
  breakpoint in the hotkey `tick` (`globalThis.__hk = this`, never pauses) and the `onEvent`
  closure's `[[Scopes]]` reached the `DictationController`: state "processing", stage "waiting for
  the speech stream to open", `opening` resolved, `run` null, 37 chunks in `pending`. A tap's
  cancel cleared the next press's `run`; the release returned on `!run` without leaving
  "processing" and cleared the watchdog. Fixed with a press number; `dictation.test.ts` replays it
  and fails without the fix. → `docs/architecture.md` → "One press at a time". Scripts:
  scratchpad `grab.mjs`, `deps.mjs`, `probe.mjs` (CDP at 127.0.0.1:9229).

Did not work:
- My own change in the first 11-12 fix removed the 700 ms pause after typing the WhatsApp search —
  that is what caused the Yash arya click (the list was still unfiltered).
- The watchdog did not fire on the third freeze because the `!run` path cleared it: the 60 s
  "safety net" promised to the user on 11-11 did not cover that path.
- Restarting the dev app: a backgrounded Bash `pnpm dev:desktop` exited when its shell task ended,
  leaving electron up with its vite renderer server gone. `cmd /c "set ELECTRON_RUN_AS_NODE= && …"`
  sets it to a space, so Electron ran as Node ("Cannot read properties of undefined (reading
  'getPath')"). A redirect to the old `dev.log` failed while it was still locked. What works:
  `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell, free port 5173, then a hidden
  `Start-Process cmd.exe "/c cd /d … && pnpm dev:desktop > <new log>"`.
- After a reboot the installed SUBXVoice starts itself and takes the single-instance lock; the dev
  app then exits (code 4).
- `grid.ps1`: `[Math]::Min(1, 0.83)` picked the int overload and returned 1 — use `1.0`.
- `console.log` from a vitest probe printed nothing; writing to a file worked.

Established:
- WhatsApp UIA: chat rows come twice ("Aryan Yesterday 👍 ya wali" and "Aryan Yesterday"); the open
  chat shows as `Button "Contact info <name>"` and `Edit "Type a message to <name>"`.
- File Explorer selection via `Document.SelectItem(item, 29)` holds (checked with
  `SelectedItems()`), in a fresh window or an open one.
- The user's resumes: `Pictures\My Resume.pdf`, `Downloads\My Resume.pdf`,
  `Downloads\Downloads\pdf files\My Resume.pdf`, plus newer `Bhavesh-Parmar-Resume*.docx` in
  Downloads.
- Jev on OpenRouter takes images in `state`; sides 256–1,568 px; no Box question there.

User decided:
- Never send by default; send only on a separate "ab send kar do" (`docs/decisions.md` 2026-11-11).
- No "pakka?" confirmation.
- Screen text may go to Jev/Gemini through the backend.
- The friend is "Aarnav" (heard as R9, NL, Anal; the Dictionary can map it).
- Vision fallback: first "Abhi nahi, baad mein"; on 2026-11-12 asked for it again ("tabhi image
  dekhe … BlueStacks bhi chala paayega") — answered with the probe results; build not started.

Open:
- Vision fallback: waiting on the user's go-ahead; design = coarse grid → zoomed grid → floor.
- The user is to retest: WhatsApp cold start, Aryan vs Yash arya, "Pictures wale folder", quick
  repeated presses (the race). Dev app log: scratchpad `dev13.log`.
- "Notepad band karo": close_windows reached at 0.46 with a second opinion and still stopped with
  "Didn't catch that" (risky needs Jev ≥ 0.7). Not looked at.
- A "hi" draft sits in the user's "Yash arya" WhatsApp chat — told the user; not touched.
- `dictation: slow — 15300 ms` on one WhatsApp message — not investigated.
- Nothing committed: HEAD `5bc4e7f`, ~32 paths changed. 0.4.0 not released; deadline ~2026-11-15.

---

## S-016 · 2026-11-14 · Folders that opened invisibly, Bluetooth devices, Roman retry, live suites

Asked:
> sirf Pictures folder kholo, to usne dikhaya ki opened, par kuch khula nahi. Same maine 2-3 baar kiya
> Bluetooth mein mere OnePlus Buds hain … jo meri MCP hai. Wo suitable hai, wo kar sakti hai … tum bhi use humse seekho … live test karke use fix kar sakte ho
> baaki ek baar overall har... check karke sab kuch final ready karo
> Roman mein transcription nahi aayi, normal Hindi text mein aayi … maine Roman select kar rakha tha … Control plus Windows … Kabhi kaam nahi … achhe se fix karo

Done:
- Read `dev14.log` (the user's test after the 2026-11-12 fixes). Worked: volume, Bluetooth radio
  off/on, brightness ×4, WhatsApp to Aryan (twice, right chat) and to "dragon", resume in Pictures
  found and selected, Chrome focus, BlueStacks.
- **Invisible Explorer windows.** `open_folder` and a folder match in `find_files` used
  `spawn("explorer.exe", [path], {detached, windowsHide: true})`. `Shell.Application.Windows()`
  showed four such windows with `Visible=False` (Pictures ×2, Screenshots, Documents); closed them
  with `.Quit()`. Both now go through `showFolder()` (the `SHOW_SCRIPT` used for files, with
  `Find-View` requiring `$w.Visible`), which waits for the window, focuses it and throws if none
  appears. `windowsHide` removed from every explorer spawn. Live: Pictures opened, `visible=True`.
- **`bluetooth_device`** built (was a NOT_YET stub): `CmdBluetooth` C# block in `interop.ts`
  (`Devices()`, `Connect(hex)`, `Disconnect(hex)` over `bthprops.cpl`), ported from
  `reference/computer-mcp/src/computer_mcp/core/bluetooth.py`. Its `facts` list the paired devices.
  Checked the state first with the user's computer-mcp (`bluetooth_devices`: OnePlus Buds 4 and
  HBTS004 paired, not connected), then connected the buds through the new code: **6.2 s,
  read back connected.** They were left connected.
- **Roman retry** in `Pipeline.finalise`: a reply still in Devanagari is asked for once more with
  `STILL_NATIVE` added to the system prompt. Reproduced first with scratchpad `roman.mjs` (the
  user's exact 900-char dictation, real prompt, real backend): Groq answered Roman both times,
  ~0.8–1.3 s — so the app's Devanagari answer came from a fallback upstream. → `docs/architecture.md`.
- Planner rule (5): closing / quitting / "band karo" an app is "Close the window <app>"; stopping
  the program only for force / kill / hangs. "WhatsApp quit kar" had split Jev between
  `close_windows` 0.56 and `kill_process` 0.36 — both risky — and did nothing, twice.
- `readSoon()` in core `screen.ts`: a step's named window is looked for again for up to 4 s.
- Checks: `pnpm check` green (core 101, platform-win 25, desktop 45); `commands.live.test.ts`
  12/12; `command.live.test.ts` 22/24, the two failures passing on a rerun; after `readSoon` the
  YouTube pair passed again. Dev app restarted, log `dev15.log`.

Did not work:
- e2e "plays a song on YouTube" failed once with "YouTube isn't open": the step read Chrome before
  the tab's title had become "… - YouTube". `settled()` retried only missing elements, not a
  missing window → `readSoon`.
- e2e "BlueStacks का instance manager खोलो" once planned a screen click in BlueStacks instead of
  opening Multi-Instance Manager ("BlueStacks isn't open"); passed on rerun. Planner variance, not
  fixed.

Established:
- `spawn` with `windowsHide: true` passes SW_HIDE to explorer.exe, which then opens its folder
  window hidden. App launches through `shell:AppsFolder` were not affected (the app is its own
  process) but the flag is gone there too.
- `BluetoothSetServiceState` cycle works from Windows PowerShell's Add-Type C#; the first service
  that lands (A2DP) brings the link up in ~6 s.
- OpenRouter with `order: ["groq"]` still falls back to other upstreams; one of them returns long
  Hindi unconverted.

Open:
- "dictation: nothing heard" twice at the end of `dev14.log` — not investigated (no detail logged).
- Second opinion acted on `open_folder` for "resume ChatGPT pe upload kar" (Jev's top was
  nothing_fits 0.44): it opened Pictures and said done. Not changed.
- Image fallback, commit, 0.4.0 release before ~2026-11-15: still the user's call.

### 0.4.0 released (2026-11-14, same session)

Asked:
> achhe se proper tareeke se EXE bana do … koi bhi us EXE ko chahe download kare, permissions maange bhi … pehle installation ke waqt achhe se poori permissions maang le … site pe bhi laga do … Update push kar do

Done:
- `apps/desktop/package.json` 0.3.0 → 0.4.0. `dist:win` first (no publish), then the packaged
  `dist/win-unpacked/SUBXVoice.exe` was smoke-tested: started, updater checked GitHub, and two
  commands run inside it through the inspector (scratchpad `grab.mjs` + `run-command.mjs`, which
  call the workflow's own `command`): "volume kitna hai aur battery kitni hai" → system status;
  "WhatsApp mein kya open hai" → `screen_read` → "Haan, WhatsApp logged in hai." So the PowerShell
  worker, the C# blocks and both models work from the installed layout.
- Secret scan of the change set (tokens, keys, the user's email): clean. `reference/` and `.env`
  are ignored.
- Commit `ab3949b` "feat: command mode … — 0.4.0" (41 paths) pushed to `subxvoice-app` `main`.
- `pnpm --filter @subx/desktop release:win` → release `v0.4.0` on `subxvoice-releases`, not a
  draft, with the exe (113,214,013 bytes), blockmap and `latest.yml` (version 0.4.0). The site's
  link (`subxvoice-web/src/lib/download.ts`, `releases/latest/download/…`) now redirects to
  v0.4.0; the website itself needed no change (it names no version).
- Installed 0.4.0 on the dev machine from the built installer, launched through `explorer.exe`;
  `SUBXVoice.exe` reports 0.4.0.0 and is running.

User decided / not done:
- The user asked for the installer to ask for "poori permissions" with Windows' Yes/No (UAC)
  dialog. Not done: nothing in the app needs administrator rights; the installer is per-user
  (`perMachine: false`), so a UAC prompt would mean a per-machine install, which would leave every
  existing per-user install updating separately; and an elevated SUBXVoice cannot receive key
  presses from normal apps (UIPI, `packages/platform-win/AGENTS.md`). The one permission that
  matters, the microphone, is Windows' privacy switch, which the app checks
  (`WinPermissions.status`) and opens Settings for. Told the user; their answer is pending.
