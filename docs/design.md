# SUBXVoice — design system

The website was rebuilt on this on 2026-11-10. **The desktop app has not been, and is next.**
Everything below is what the app must match, so this file is the brief for that work.

Live reference: <https://subxvoice.vercel.app> · source in `pillow/subxvoice-web/`.

## Three colours, in proportion

Given by the user, to be used roughly **60 / 30 / 10**:

| Name | Hex | Share | What it is |
|---|---|---|---|
| Ice Silver | `#DDE3E8` | 60% | the page |
| Deep Aubergine | `#3A0F34` | 30% | every word you read, and the one surface that inverts |
| Marigold | `#EAAA00` | 10% | the few places the eye is meant to land |

### The rule that keeps the 10% honest

**Marigold on Ice Silver measures about 1.9:1 — it cannot be read.** So:

- On light ground it is a **fill**, never type: buttons, rules, numerals, edges, marks.
- It becomes **type only on Aubergine**, where it reaches 7.5:1.
- Aubergine **on** Marigold is 7.5:1, which is why the primary button is a Marigold fill with
  Aubergine text — the one place the accent can be large and legible at once.
- When accent-coloured *text* is genuinely needed on light ground, use `--marigold-ink` `#7D5C00`.

There is no way left to overuse it, which is the point. Nobody has to count.

### Derived values — no fourth hue

Every other value is one of the three moved toward another.

```
--silver        #dde3e8   the page
--paper         #e9edf1   Silver lifted, for the few things sitting on it
--aubergine     #3a0f34   type, and inverted sections
--aubergine-soft #4c1f46  rules inside dark sections
--marigold      #eaaa00   fills on light ground
--ink           #3a0f34   body text
--ink-soft      #6e4a68   secondary text, ~5.9:1 on Silver
--ink-faint     #8f7389   ~3.6:1 — large text and marks only
--marigold-ink  #7d5c00   accent text on light ground
--rule          rgb(58 15 52 / 14%)
--rule-strong   rgb(58 15 52 / 32%)
```

## Type

One superfamily does both jobs, separated by weight and width rather than a second face.

| Role | Face | Notes |
|---|---|---|
| Display (h1–h3) | **Bricolage Grotesque** | 700, `opsz 48`, tracking `-0.028em`, line-height `0.95` |
| Body and UI | **Archivo** | 400/500/600/700 |
| Speech as captured | **DM Mono** | marks raw input; a semantic, not a label style |
| Devanagari | **Noto Sans Devanagari** | the app quotes real Hindi; it gets a face drawn for it |

Archivo *Expanded* was tried for display first and rejected by the user — it widened the face to
get presence and read as stretched. Bricolage has an optical-size axis, so it holds its shape at
hero sizes without being stretched.

## Motion

Added 2026-11-10 after the user said the page looked plain. All of it honours
`prefers-reduced-motion`, in CSS and again in `Reveal.tsx` via `matchMedia`.

- **Reveal on scroll** — 10px rise, 500ms, once, `IntersectionObserver`. Deliberately small: a long
  slide on every block stops reading as a response to the reader and starts reading as decoration.
- **The hero waveform breathes** — each bar scales from its own drawn height with a phase taken
  from its position, so the movement travels across the page instead of pulsing together.
- **The hero transcript loops** — listen, type, hold 5s, restart. The hold is long because being
  readable is the point.
- **Tab change cross-fades** the example. Motion that answers a click is always welcome.
- **The download dot pulses.** It is the one thing the page wants pressed.

## Principles this page is held to

1. **Every example is real output from the shipped app.** The sick-leave email, the message to
   Mummy, the Devanagari in the hero — all produced by the product during testing. Nothing on the
   page is invented copy pretending to be output.
2. **Marigold is spent, not sprinkled.** It marks the action and the result, nothing decorative.
3. **No card grids.** Rules, columns and space carry structure. Containers exist only where the
   content is genuinely an artefact (an email, a chat bubble).
4. **Numbering only where the content is a sequence.** `HowItWorks` earns 1·2·3; nothing else does.
5. **No eyebrow labels above headings**, no single word of a headline in a different colour. Both
   were tried and removed — they are the commonest tells of a generated page.
6. **Copy is run against `unslop`** (see `context/INDEX.md`) for AI writing patterns.

## Carrying this into the desktop app

The mark already moved: `apps/desktop/src/shared/mark.ts` draws an Aubergine plate, Ice Silver
bars and the tallest bar in Marigold, and feeds the window icon, the tray, the installer and the
website's favicons from one definition.

The app's interface has **not** moved. `apps/desktop/src/renderer/src/styles.css` still holds the
old violet/cyan tokens, and every page is built on them. What must change:

- Replace the token block with the values above. The app already supports light and dark via
  `:root[data-theme]`; the user asked for **light default, same as the site**.
- Two colours used to carry meaning there — violet for "the product acting", cyan for "the user's
  voice". The new palette has one accent, so decide that mapping deliberately rather than
  search-replacing: Marigold is the obvious carrier for the product acting, and voice needs
  either a desaturated Aubergine or Marigold at lower intensity.
- Load the same three faces. `--font-voice` already exists for Devanagari transcripts.
- Pages to redesign: Dashboard, Insights, History, Dictionary, Settings, SignIn, Onboarding, plus
  the pill overlay, the sidebar and the tray.
- **The pill floats over other applications.** It should almost certainly stay Aubergine whatever
  the window theme is, so it reads on any background.
