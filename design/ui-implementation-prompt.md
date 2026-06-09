# CarDex — UI Implementation Prompt

A ready-to-use brief for Claude (or a coding agent) to implement the GBC
retro-modern design system in the existing CarDex app. Paste it into a coding
session that has the repo open.

The **visual source of truth** is `design/ui-design-prompt.md` (palette, fonts,
component language, per-screen direction). This document is about *how to build
it in code* — incrementally, without breaking the working capture → garage flow.

---

## The prompt

You are implementing the CarDex visual design system in an existing **Expo SDK
54 / React Native / TypeScript** app. The app already works end-to-end (auth,
camera capture via a state machine, recognize/confirm Edge Function calls,
garage, sets, set detail, map, profile, set-completion celebration). Your job is
to apply the **Game Boy Color retro-modern** look from `ui-design-prompt.md`
across the UI **without changing behaviour or data flow** — these are
presentational changes layered on the existing screens.

Read `design/ui-design-prompt.md` first; it defines the palette tokens, the two
fonts, the full-screen scanline (no bezel), the component language, motion, and
per-screen direction. Implement to that spec.

### Guardrails (do not violate)

- **No behavioural changes.** Don't touch the `useCatchFlow` state machine,
  `lib/api.ts`, `lib/collection.ts` query logic, navigation structure, or the
  Edge Functions. Style and recompose presentation only.
- **Keep it usable** (the "retro-flavored, modern-functional" principle): pixel
  chrome + bitmap headers, but readable body text, 44pt+ touch targets, real
  scrolling. Clarity wins over authenticity where they conflict.
- **`npm run typecheck` must pass** after each step. Work incrementally — one
  screen/component at a time, verify, move on.
- **No new heavy dependencies** beyond the two Google fonts. No UI kit.
- Honour **reduce-motion** (`AccessibilityInfo.isReduceMotionEnabled`) for
  scanline shimmer, wipes, and flicker.

### Step 1 — Fonts

Add `@expo-google-fonts/press-start-2p` and `@expo-google-fonts/vt323` (plus
`expo-font`). In `App.tsx`, load them with `useFonts` and gate the tree on
`fontsLoaded` (show a minimal boot screen meanwhile). These load in Expo Go too,
so the type system is testable before the dev client.

### Step 2 — Theme module (`src/theme/`)

Centralise design tokens so screens stop hardcoding hex:

- `colors.ts` — export the palette tokens from the design spec
  (`ink`, `lcdBg`, `panel`, `panelHi`, `line`, `text`, `textDim`, `accent`,
  `green`, `gold`, `purple`, `red`, `teal`, `orange`).
- `type.ts` — font families (`display: "PressStart2P"`, `body: "VT323"`) and a
  type scale; helpers like `displayText(size)` / `bodyText(size)`.
- `space.ts` — spacing + radii constants.
- Update `src/lib/rarity.ts` `RARITY_COLOR` to the design-spec rarity hexes
  (common `#9BA7B0`, uncommon `#36D17A`, rare `#3FA7F6`, epic `#B36BE6`,
  legendary `#FFC833`) — adopt these as the source of truth. Leave
  `RARITY_POINTS` / `RARITY_ORDER` unchanged.

### Step 3 — Component library (`src/components/ui/`)

Build small, reusable, typed primitives that encode the look:

- `Frame` / `Panel` — the 9-slice beveled pixel border (light top-left, dark
  bottom-right) wrapping any content.
- `PixelButton` — variants `primary | confirm | danger | ghost`; visibly
  depresses on press; uses display font, uppercase labels.
- `RarityChip` — tier color + label (pair color with text; never color alone).
- `Selector` — a list row with a blinking `▶` cursor for the focused item.
- `PixelProgressBar` — chunky segmented fill.
- `Badge` — set medal (earned colored / locked silhouette).
- `PixelCard` — the trading-card layout (sprite, "No. 0xx", name, rarity ribbon).
- `TypewriterText` — types characters with a blip, tap-to-skip, reduce-motion =
  instant.
- `ScanlineOverlay` — a full-screen `pointerEvents="none"` absolute layer of
  faint 1px lines; subtle shimmer gated behind reduce-motion.

Each component: typed props, theme tokens only (no literals), dark-LCD by
default.

### Step 4 — Global LCD treatment

- Set the app background to `lcdBg` globally; configure the React Navigation
  theme to the dark palette (so there are no white flashes between screens).
- Mount `<ScanlineOverlay />` once, above the navigator in `App.tsx`, so every
  screen reads as "on the LCD." No bezel/device chrome.

### Step 5 — Retrofit screens (one at a time, verify between each)

Apply the per-screen direction from the design spec, reusing the Step 3
primitives. Keep all existing props/handlers:

- `AuthScreen` → console boot + "PRESS START" + framed credential panel.
- `CaptureScreen` → full-screen reticle + "SCANNING…"; big pixel shutter; keep
  the dev "Simulate" affordance and the no-camera fallback.
- `ConfirmSheet` → `Selector` menu of candidates + rarity chips + "SEARCH
  MANUALLY".
- `CatalogueSearch` → "DEX LOOKUP" framed search field + selector results.
- `RevealCard` → "NEW DATA REGISTERED" Pokédex entry: framed bobbing sprite,
  dex number, `TypewriterText` name/rarity, rarity flash, "NEW!" stamp.
- `GarageScreen` → grid of `PixelCard`s; header "0xx / 0xx" completion.
- `SetDetailScreen` → caught in color, missing as `???` silhouettes,
  `PixelProgressBar`, set `Badge` that lights at 100%.
- `MapScreen` → native map inside the framed LCD with scanline overlay; pixel
  pin sprites by rarity; the Expo Go fallback list styled as a selector menu.
- `ProfileScreen` → "TRAINER CARD": avatar, handle, stat tiles, badge row,
  rarest find as a showcased card.
- `SetCompleteCelebration` → keep the existing trigger; restyle as a badge-award
  fanfare with pixel confetti.

### Step 6 — Motion

Use Reanimated (already installed) for stepped/snappy motion: catch reveal pops
in scale frames, selector + "PRESS START" blink, sprites bob in 2–3 frame loops.
Screen transitions use a curtain/wipe (or fade under reduce-motion). All motion
must no-op gracefully when reduce-motion is on.

### Deliverables & verification

1. `src/theme/` tokens + updated `rarity.ts`.
2. `src/components/ui/` primitive library.
3. Global LCD background + scanline overlay + dark nav theme.
4. All ten screens retrofitted, behaviour unchanged.
5. `npm run typecheck` clean; sanity-run in Expo Go (fonts + layout) and note
   what needs the dev client (camera, map, reanimated motion).

Work screen-by-screen, keep diffs presentational, and verify types after each.
