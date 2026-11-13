# PROGRESS

## M0 — Foundation (done)

**Done**
- Repo scaffold: Vite 5 + TypeScript 5 (strict) + Phaser 3.80.1, Vitest.
- 480x270 virtual resolution, integer scaling, nearest-neighbour, letterboxed; phone profile flexes
  virtual width 480-576 at fixed height 270 (`src/systems/Scaling.ts`).
- Platform profile detection with manual override; portrait "ROTATE YOUR DEVICE" gate on phone.
- `src/sim/types.ts`: InputAction / InputFrame contract (Tier H owned).
- Tools: `tools/extract_palette.py` (median-cut 32 colours), `tools/downscale_refs.py`,
  `tools/split_brief.py`, `tools/gen_art.py`, `tools/gen_font.py`, `tools/gen_env.py`.
- Boot flow: Preload -> Title.

## M1-M4 — Skate core, terrain, tricks, grinds (done)

**Done**
- `src/sim/SkaterSim.ts`: pure-TS state machine (ground / air / grind / manual / bail / special).
  Push, roll, brake, turn; variable-height ollie (tap 63-96 px apex window); coyote time; jump
  buffer; trick buffer (8 frames, 10 with assist).
- `src/sim/Terrain.ts`: base ground polyline **plus** floating surfaces (ramps, platforms) with
  explicit ridden-surface tracking so ramps climb instead of snapping to the base ground.
  Quarter-pipe and kicker launch; one-way platforms; bail zones.
- `src/sim/TrickSystem.ts` + `data/tricks.json`: 5 flips, 5 grabs, 5 grinds, 2 manuals, 4 rotations,
  per-character specials. Flip duration scales with the Flip stat.
- `src/sim/ComboScore.ts`: distinct tricks raise the multiplier, repeats pay 50 %, special ×2,
  `bank()` on a 1.2 s link timeout.
- `src/sim/Balance.ts`: drift that grows with time, reduced by the Balance stat; green zone
  |b| < 0.35 (0.55 with assist); bail at |b| >= 1.
- `src/sim/FixedStep.ts`: fixed 60 Hz stepping with render interpolation.
- Input: keyboard, Gamepad API, and a DOM multi-touch overlay (48 px targets, pointer capture
  per pointer id so several buttons can be held, left-handed swap, opacity/size, haptics).
- Camera: look-ahead by speed, vertical dead zone, trauma-based shake (never per-frame random).
- 30 unit tests pass (`npm run test`): scaling, terrain, tricks, combo, balance, and full-run
  sim integration (push, ollie heights, flip land + bank, grind chain, ramp launch + clean land).

## M5-M7 — Levels, presentation, meta (done, first pass)

**Done**
- 3 levels in `src/data/levels/`: LAST CALL ALLEY, PLATFORM ZERO, THE FOUNDRY, each 2600-2800 px
  with ramps, rails, ledges, gaps, S-K-A-T-E letters, secret item, hazards and 6 goals.
- `src/sim/GoalSystem.ts`: all 6 goal types evaluated per tick (score, letters, secret, spray,
  rails-in-one-combo, gaps, big air).
- Procedural art: 4 skater sprite sheets (64x64 cells, 20 animations each, paper-doll layers),
  FX sheet, 3-level parallax layers with dithered light cones and neon signs, 19 props.
- UI: original 5x7 bitmap font, HUD (score count-up, combo line + multiplier, timer that pulses
  red under 10 s, special meter with a stripe pattern when full, balance arc with a needle,
  S-K-A-T-E tracker), Title / character select / level select / settings / pause / results.
- Audio: WebAudio step sequencer (menu 80, alley 96, subway 110, warehouse 124 BPM), full SFX
  list, separate master/music/SFX buses with a soft limiter, roll loop pitched by speed.
- Save: versioned localStorage with migration and in-memory fallback. Unlocks: L2 at 3 goals,
  L3 at 8, PRISM 3, BRASS 8, LOOP 14.
- PWA: manifest + service worker precaching every generated asset.

**How to test**
```
npm run dev      # http://127.0.0.1:5173
npm run test     # 30 unit tests
npm run build    # production build in dist/
```

**Verified by driving the real browser** (headless Chrome, dev server): title -> character
select -> level select -> gameplay; recorded a full ollie+kickflip land banking 242 points, a
50-50 grind worth 300, and a kicker ride 220->198 into an air launch.

**Known issues / next**
- Final art pass: skater sprites are readable but still placeholder-grade next to the reference
  sheets. Plan is a detail pass on the head/ears/headgear and the rim light.
- Background layers tile visibly at 3-screen width; needs mirrored seam tiling.
- Adaptive quality (phone frame-time step-down) is not implemented yet.
- CRT toggle and reduce-flash are stored but not yet applied to the renderer.
- Results screen "next level" flow and per-level 720 goal need a final pass.
- Asset size after build: pending the M9 measurement pass.
