# NULLS SKATEPARK

2D pixel-art arcade skateboarding game. Score attack, 2-minute runs, combos, grinds, manuals,
night-city mood. Browser (desktop + phone landscape), 480x270 internal resolution, Phaser 3 +
TypeScript + Vite.

## Install

```
npm install
```

## Develop

```
npm run dev        # http://127.0.0.1:5173
npm run build      # production build in dist/
npm run preview    # serve dist/
npm run test       # vitest unit tests (pure sim logic)
npm run typecheck  # tsc --noEmit
```

## Controls (desktop)

| Action | Key | Gamepad |
|:--|:--|:--|
| Push / lean forward | Right / D | Stick right |
| Brake / lean back | Left / A | Stick left |
| Crouch | Down / S | Stick down |
| Manual | Up / W | Stick up |
| Ollie | Space / Z (hold for height) | A |
| Flip | X | X |
| Grab | C | B |
| Grind | V | Y |
| Special (meter full) | X + C | X + B |
| Pause | Esc / P | Start |
| Restart | R | Select |
| Debug overlay | F1 | — |

Phone: landscape only, on-screen diamond — OLLIE (large, bottom), FLIP (left), GRAB (right),
GRIND (top), SPECIAL above when the meter is full.

## Docs

- `PROGRESS.md` — what is done, how to test, known issues, asset size.
- `DECISIONS.md` — deviations and defaults chosen.
- `spec/` — the build brief split by section (source of truth).
- `tasks/` — one task file per milestone.

## Play it here

### https://bantalcuseyo.github.io/nulls-skatepark/

That link plays on a desktop browser and on a phone (landscape). It is served by GitHub Pages
from the `docs/` build output on `master`, so it stays up.

### Run it locally

**`http://127.0.0.1:5173/`** while the dev server runs, or:

```
npm run build && npm run preview   # http://127.0.0.1:4173/
```

Force a platform profile with `?profile=phone` or `?profile=desktop` — useful for checking the
touch layout without a phone.

## Project layout

```
src/sim/          pure TypeScript simulation, no Phaser imports (unit-testable)
  SkaterSim       state machine: ground / air / grind / manual / bail / special
  Terrain         base polyline + floating surfaces (ramps, platforms), surface tracking
  TrickSystem     flips, grabs, grinds, manuals, rotations, specials
  ComboScore      multiplier, repeats at 50 %, bank on a 1.2 s link timeout
  Balance         grind/manual meter, stat-scaled drift, bail at |b| >= 1
  GoalSystem      the six per-level goals
src/scenes/       Preload, Title, Game, Hud, Pause, Results
src/systems/      InputManager, TouchControls, PlatformProfile, Scaling, CameraRig,
                  LevelLoader, SaveSystem, AudioManager, Particles, PixelText,
                  AdaptiveQuality
src/data/         physics.json, tricks.json, characters.json, levels/*.json
src/strings/      en.json (all UI text; no hard-coded strings)
tools/            extract_palette, downscale_refs, split_brief, gen_art, gen_font, gen_env
tests/            30 Vitest unit + integration tests over the pure sim
```

## Design notes worth knowing

- **The simulation never imports Phaser.** Scenes read sim state and render it, so every physics,
  trick and scoring rule is testable in node and deterministic.
- **Fixed 60 Hz step with render interpolation.** Frame-rate independent; a slow frame runs more
  ticks rather than slowing the skater down.
- **Terrain is a base polyline plus floating surfaces.** Merging ramps into one polyline produced
  spurious near-vertical walls between street level and raised platforms, so ramps and platforms
  are separate one-way surfaces and the sim remembers which one it is riding.
- **Held direction does not auto-spin.** Holding "push" is also the air-rotation input, so a
  direction key held through a launch or a pop is treated as locomotion until it is released and
  re-pressed. Deliberate spins still work.
- **All art and audio are generated.** `tools/*.py` build the sprite sheets, environments, props,
  font and palette from `docs/refs/`; `AudioManager` synthesises every sound and music loop at
  runtime. Total download is 2.3 MB.

## Deploy

`npm run build` produces a static `dist/`; upload as-is to itch.io or GitHub Pages. The build is
relative-based (`base: './'`) so it works from any subdirectory. `public/sw.js` precaches every
asset, so the game installs to a phone home screen and runs offline.
