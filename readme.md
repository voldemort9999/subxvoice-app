# SUBXVoice

Typing is optional. Hold a key, speak in any language, and clean text appears wherever your cursor is —
on macOS and Windows.

## Where things live

| What | Where |
|---|---|
| This repo | the desktop app and its Supabase backend — private |
| Installers and the update feed | [`voldemort9999/subxvoice-releases`](https://github.com/voldemort9999/subxvoice-releases) — public, because a private repo's release assets 404 for anonymous downloads |
| The website | [`voldemort9999/subxvoice`](https://github.com/voldemort9999/subxvoice), deployed at [subxvoice.vercel.app](https://subxvoice.vercel.app) |

## Releasing

`pnpm --filter @subx/desktop dist:win` builds an installer and publishes nothing.
`pnpm --filter @subx/desktop release:win` is the only command that publishes, and every installed
copy downloads what it publishes. Bump `apps/desktop/package.json` first.

## Getting started

Requirements: Node 22+ (24 LTS recommended) and pnpm 11. On Mac, also Xcode or the Xcode Command Line
Tools (the Swift helper is built automatically).

```bash
pnpm install
pnpm dev:desktop   # Electron app
pnpm check         # lint + typecheck + tests (run before every PR)
```

If the desktop app opens as plain Node inside a VS Code terminal, run `unset ELECTRON_RUN_AS_NODE`.

## What works today

| Feature | macOS | Windows |
|---|---|---|
| Hold hotkey → record | ✅ fn (🌐) by default, via the Swift helper | ✅ Ctrl + Win by default (key-state polling) |
| Microphone | ✅ native, on only while the key is held | ✅ Web Audio, with a mic picker in Settings |
| Speech-to-text, streamed while you speak | ✅ Gnani (needs `GNANI_API_KEY`) | ✅ same |
| Text pasted at the cursor, user's clipboard restored | ✅ ⌘V via the Swift helper | ✅ Ctrl+V via Win32 `SendInput` |
| Hindi etc. written in Roman letters (Hinglish) or native script | ✅ OpenRouter (needs `OPENROUTER_API_KEY`) | ✅ same |
| Always-on-screen pill: live waveform, then the words as heard | ✅ | ✅ |
| Dashboard: Home stats, History with playback, Dictionary, Settings | ✅ | ✅ |
| Settings: hotkey picker, script, engines status | ✅ | ✅ (+ microphone picker) |
| Menu bar / tray icon (open, quit) | ✅ | ✅ |
| Recordings + history saved locally | ✅ WAV + JSON files | ✅ |
| Style mode (rewrite in your tone), voice commands, MCP | ⏳ pipeline ready, no hotkey yet | ⏳ |
| Active-app context, open apps by voice | ⏳ | ⏳ |
| Backend: login, sync, stats, teams | ⏳ | ⏳ |
| Installers and auto-update | ⏳ builds, not released | ✅ released, updates itself |
| Website with the download button | ✅ | ✅ |

The app holds no vendor keys: speech-to-text and the Roman-script rewrite go through Supabase Edge
Functions that a signed-in account unlocks. `.env` at the repo root is developer tuning only
(`GNANI_MODEL`, `GNANI_LANGUAGE`, `GNANI_FORMAT`, `OPENROUTER_MODEL`) and is read in development
only — see `.env.example`.

## Docs

- [Agent guide](AGENTS.md) — repo map, rules, how-tos; also the best overview for humans
- [Features](docs/FEATURES.md) — the full product feature list
- [Architecture](docs/architecture.md) — how the pieces fit together
- [Tech stack](docs/TECH_STACK.md)
- [Decisions](docs/decisions.md) — why things are the way they are
