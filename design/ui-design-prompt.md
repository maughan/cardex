# CarDex — UI Design Prompt

A ready-to-use brief for Claude (or any designer) to produce the visual design
system and screen mockups for CarDex. Paste it as-is, or trim to the section
you need.

---

## The prompt

You are the visual designer for **CarDex**, a mobile app that is a "Pokédex for
the cars you spot in the wild." A user photographs a real car, the app
identifies it, and it joins their collection with a rarity tier. The app is
built in React Native (Expo) with tabs for **Hunt** (camera capture), **Garage**
(collection grid), **Map** (catch locations), and **Profile** (stats), plus a
**Set detail** screen and a **catch reveal** moment.

Design a cohesive UI heavily influenced by the **Game Boy Color and that era of
handheld consoles** — pixel art, sprites, and an 8-bit sensibility — while
remaining a genuinely usable modern phone app.

### 1. Guiding principle — "retro-flavored, modern-functional"

Evoke the handheld era; don't sacrifice usability to it. That means:

- **Do** use pixel-art sprites, 9-slice dialog frames, a period palette, a
  bitmap display font, blinking selectors, typewriter text, and snappy stepped
  motion.
- **Don't** make body text an unreadable bitmap, cram lists into 4 visible rows,
  drop below 44pt touch targets, or rely on dithering where legibility matters.
- When authenticity and clarity conflict, **clarity wins** — apply the retro
  styling to chrome, sprites, headers, and key moments; keep long text (car
  names, descriptions) crisp and readable.

### 2. Full-screen LCD treatment

There is **no handheld bezel or shell** — the LCD *is* the whole screen,
edge-to-edge. The retro feel comes from the screen surface itself, not a frame
around it.

- The entire app surface is the **dark LCD** (`lcd-bg`), full-bleed to every
  edge — no device chrome, D-pad, or face buttons stealing space.
- A faint **scanline texture** overlays the full screen (thin 1px lines every
  ~4px, low opacity), plus optional gentle **LCD ghosting** on fast motion.
- Implement as a single **full-screen overlay layer** above all content (a
  `pointerEvents: none` scanline view), so every screen reads as "on the LCD"
  without wrapping anything in a frame.
- **Respect reduce-motion / accessibility:** drop the scanline shimmer and
  ghosting (a static, very faint overlay or none) when the OS setting is on, and
  keep the overlay subtle enough that text contrast is never harmed.

### 3. Palette — GBC colorful-limited (~16 colors)

Use this curated, saturated, era-flavored palette. Treat it as design tokens.

| Token | Hex | Role |
|---|---|---|
| `ink` | `#15182A` | Darkest — outlines, text on light |
| `lcd-bg` | `#1C2335` | LCD screen background (content base) |
| `panel` | `#28324A` | Panels / cards |
| `panel-hi` | `#3A4A6B` | Raised panel / selected row |
| `line` | `#5C6E92` | Borders, dividers, frame edges |
| `text` | `#E6F1F7` | Primary text |
| `text-dim` | `#90A2B6` | Secondary text |
| `accent` | `#3FA7F6` | Primary interactive / focus |
| `green` | `#36D17A` | Success / confirm |
| `gold` | `#FFC833` | Highlights / legendary |
| `purple` | `#B36BE6` | Epic / accent 2 |
| `red` | `#FF5A78` | Danger / rejection |
| `teal` | `#28E5D0` | Accent 3 / map pins |
| `orange` | `#FF914D` | Accent 4 / streaks |
| `shell` | `#2A3340` | Handheld bezel base |
| `shell-hi` | `#46566B` | Bezel highlight/bevel |

**Rarity tiers** (must stay visually distinct, brightest = rarest):

- Common → `#9BA7B0` · Uncommon → `green #36D17A` · Rare → `accent #3FA7F6` ·
  Epic → `purple #B36BE6` · Legendary → `gold #FFC833` (give legendary an
  animated shimmer/glow).

An optional **DMG green LCD mode** (4-shade pea-soup green) can be offered as a
toggle/skin, but the colorful palette above is the default so rarity reads.

### 4. Typography

- **Display / labels / numbers:** `Press Start 2P` — used large and sparingly
  (screen titles, rarity labels, stat numerals, "NEW DATA").
- **Body / readable text:** `VT323` (terminal-style, stays legible at small
  sizes) for car names, descriptions, list rows, helper text.
- Both are on Google Fonts (load via `expo-font` / `@expo-google-fonts`).
- Establish a tight type scale; never set long sentences in `Press Start 2P`.

### 5. Component language

- **9-slice dialog frames:** every panel/menu/card uses a chunky pixel border
  with beveled light/dark edges (top-left light, bottom-right dark) — the
  classic Pokémon text-box look.
- **Buttons:** beveled pixel blocks that visually "depress" on press; primary in
  `accent`, confirm in `green`, danger in `red`.
- **Selectors:** a blinking `▶` cursor marks the focused row in menus/lists.
- **Chips/badges:** rarity chips (tier color + label), set badges (earned =
  colored pixel medal, locked = grey silhouette).
- **Cards:** each caught car is a pixel **trading card** — its sprite, a "No.
  0xx" dex number, name, rarity ribbon, and where/when caught.
- **Typewriter text:** dialog/"data" text types in character-by-character with a
  blip, with tap-to-skip.

### 6. Motion

8-bit motion is **stepped and snappy**, not smooth-eased:

- State changes are near-instant; transitions use **screen-wipe / curtain**
  effects (the Pokémon battle swipe), pixel dissolves, or a "shutter" iris.
- Sprites **bob** in 2–3 frame loops; the selector and "PRESS START" blink.
- The catch reveal "pops" in stepped scale frames with a rarity flash.
- Always honor reduce-motion: fall back to simple fades.

### 7. Screen-by-screen direction

- **Boot / Auth:** a console boot screen — logo, a blinking "PRESS START," then
  an "ENTER NAME" style email/password panel in a dialog frame.
- **Hunt (capture):** the live camera fills the full screen with a targeting
  reticle and a "SCANNING…" readout; a large pixel **shutter button** anchors the
  bottom. Keep the dev "Simulate catch" as a small "CHEAT" toggle. On no-camera
  (Expo Go), show a framed placeholder + the simulate button.
- **Confirm step:** a Pokémon-style selection menu — candidate list with a
  blinking `▶`, each row a rarity chip + confidence, plus a "SEARCH MANUALLY"
  option. (Search = a "DEX LOOKUP" panel with a pixel search field.)
- **Catch reveal:** the hero moment — a **"NEW DATA REGISTERED"** Pokédex entry:
  framed sprite bobbing, dex number, typewriter name/rarity, rarity-scaled
  flash. "NEW!" stamp for first catches; "x{n}" for repeats.
- **Garage:** a **binder** of pixel trading cards in a grid; header shows dex
  completion "0xx / 0xx." Missing models can appear as faint silhouettes.
- **Set detail:** a "collection page" — caught entries in full color, missing
  ones as **??? silhouettes**, with a pixel progress bar and a set badge that
  lights up at 100%.
- **Map:** the native map sits inside the LCD frame with a scanline overlay;
  catches are **pixel pin sprites** colored by rarity. (Note: the underlying map
  tiles can't be truly pixelated — lean on the frame, pins, and overlay for the
  retro feel. Provide the Expo Go fallback list styled as a dialog menu.)
- **Profile:** a **TRAINER CARD** — avatar, handle, play-time-style stats
  (caught, rarity score, sightings), a row of **set badges**, and the rarest
  find showcased like a prize card.
- **Set complete:** a victory fanfare screen — a badge is awarded with a pixel
  shine, confetti as pixel sprites, "SET COMPLETE!" banner.

### 8. Accessibility & constraints

- Minimum 44pt touch targets even when the visual is small/pixel.
- WCAG-reasonable contrast for all text; never rely on color alone for rarity
  (pair with the label).
- Body text at a readable size; `Press Start 2P` only for short strings.
- Full reduce-motion path (no scanline shimmer, no flicker, fades not wipes).
- The bezel is decorative — it must never block or crowd interactive content,
  and should be slimmable per device size.

### 9. Deliverables

Produce:
1. A **visual design system**: the color tokens above, type scale, and a
   component library (frames, buttons, chips, cards, menus, selector, progress
   bar, badges, the bezel/LCD frame).
2. **Annotated mockups** of: Boot/Auth, Hunt, Confirm + manual search, Catch
   reveal, Garage, Set detail, Map, Profile, Set complete.
3. The **full-screen scanline/LCD overlay treatment** shown on at least two screens.
4. **Motion specs** for the key transitions and the catch reveal.
5. The **audio aesthetic** (Appendix A) captured as a later-phase spec, not v1.

Output the design system first, then the mockups, then motion and audio. Favor
SVG/HTML mockups with the real palette and fonts so they can guide
implementation directly.

---

## Appendix A — 8-bit audio aesthetic (later phase, spec only)

Capture this for a future milestone; do not build in v1.

- **Voice:** square + triangle + noise waves, short and punchy — classic
  4-channel chiptune. Keep SFX < 1s except fanfares.
- **Cues:**
  - UI tap / menu move → soft square "blip."
  - Confirm / select → rising two-note blip.
  - Cancel / reject → low buzz.
  - Capture shutter → quick noise-sweep "snap."
  - Catch reveal → rising arpeggio; **rarity-scaled** — common = 3 notes,
    legendary = a full triumphant jingle with a sparkle tail.
  - Set complete → short victory theme (think gym-badge fanfare).
  - Streak / daily → a cheerful chime.
- **Background music:** an optional looping chiptune theme, **off by default**,
  toggleable in settings (background loops are polarizing).
- **Implementation (later):** `expo-audio` for playback; preload small SFX;
  respect a master mute and the device silent switch; duck/avoid overlap on
  rapid taps. SFX assets authored as square/triangle one-shots (e.g. via a
  tracker or a tool like jsfxr/bfxr) and bundled as compressed audio.

---

## Notes for implementation hand-off

- Fonts: `Press Start 2P` + `VT323` via `@expo-google-fonts`.
- The rarity token hexes here differ slightly from the current
  `src/lib/rarity.ts` values — adopt these as the source of truth and update
  `RARITY_COLOR` to match when implementing.
- The scanline/LCD effect should be a single full-screen overlay layer
  (`pointerEvents: none`) above the navigator — no bezel or device chrome.
- Reduce-motion: gate scanline shimmer/wipes/flicker behind the OS setting.
