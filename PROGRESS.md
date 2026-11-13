# PROGRESS

## Status: M0-M9 complete (first full pass). Playable end to end on desktop and phone.

Verified by driving the real browser against the dev server and the production build.

### M0 - Foundation
Vite 5 + TypeScript 5 (strict) + Phaser 3.80.1. 480x270 virtual resolution, integer scaling,
nearest-neighbour, letterboxed. Phone profile flexes virtual width 480-576 at a fixed height of
270 so there are no black bars; portrait shows ROTATE YOUR DEVICE and pauses. Platform detection
with a manual override (Settings, or `?profile=phone|desktop`). `tools/` holds the palette
extraction, reference downscale, brief split, and the art/font/environment generators.

### M1-M4 - Skate core, terrain, tricks, grinds
`src/sim/` is pure TypeScript with no Phaser imports, so every rule is unit-testable and runs
deterministically at a fixed 60 Hz with render interpolation.
- State machine: ground / air / grind / manual / bail / special.
- Push, roll, brake, turn; variable-height ollie (tap apex 63-96 px); coyote time; jump buffer.
- Terrain: a base ground polyline plus separate floating surfaces (ramps, platforms) with the
  ridden surface tracked explicitly, so a quarter-pipe or kicker climbs and launches correctly.
- 5 flips, 5 grabs, 5 grinds, 2 manuals, 4 rotations, 4 character specials.
- Combo: distinct tricks raise the multiplier, repeats pay 50 %, a special doubles it, and the
  chain banks on a 1.2 s link timeout.
- Grind/manual balance meter: drift grows with time, scaled by the Balance stat; green zone
  |b| < 0.35 (0.55 with assist); bail at |b| >= 1.
- Input: keyboard, Gamepad API, and a DOM multi-touch overlay (48 px minimum targets, per-pointer
  capture so several buttons are held at once, left-handed swap, size, opacity, haptics).

### M5-M7 - Levels, presentation, meta
- 3 levels (LAST CALL ALLEY, PLATFORM ZERO, THE FOUNDRY), each 2600-2800 px with ramps, rails,
  ledges, gaps, S-K-A-T-E letters, a secret item, hazards and 6 goals.
- Procedural art: 4 skater sheets (64x64 cells, 20 animations each, paper-doll layers), FX sheet,
  3-level parallax layers with dithered light cones and neon signage, 19 props, an original 5x7
  bitmap font.
- Screens: Preload, Title, character select, level select, settings, Game + HUD, pause, Results.
- HUD: score count-up, combo line with multiplier, timer (pulses red under 10 s), special meter
  (stripe pattern when full so it reads without colour), balance arc with a needle, S-K-A-T-E
  tracker.
- Audio: WebAudio step sequencer (menu 80, alley 96, subway 110, warehouse 124 BPM), the full SFX
  list, separate master/music/SFX buses with a soft limiter, and a roll loop pitched by speed.
- Save: versioned localStorage with migration and an in-memory fallback. Unlocks: level 2 at 3
  goals, level 3 at 8; PRISM at 3, BRASS at 8, LOOP at 14.
- PWA: manifest plus a service worker that precaches every generated asset.

### M8 - Juice
Trauma-based screen shake (decays in real time, never per-frame random), hit-stop on bails and big
landings, dust/spark/ring/streak particles, neon flicker, landing squash, speed streaks, a
CRT-scanline toggle, and a reduce-flashing setting. Adaptive quality measures average frame time
over 2 s and steps 1.0 -> 0.6 -> 0.4 on phones only.

### M9 - Ship
- Production build: **2.3 MB total** (budget 20 MB, target 10 MB). 361 KB gzipped JS.
- 30 unit + integration tests pass; `tsc --noEmit` clean.
- Production build served and played through the browser (not just the dev server).

## How to test

```
npm install
npm run dev                # http://127.0.0.1:5173/
npm run dev -- --host      # then open http://<lan-ip>:5173/ on a phone
npm run test               # 30 unit + integration tests
npm run typecheck
npm run build && npm run preview
```

Add `?profile=phone` to force the touch layout on a desktop browser, or `?profile=desktop` to
force the desktop layout on a phone.

## Controls

| Action | Keyboard | Gamepad | Touch |
|:--|:--|:--|:--|
| Push / lean forward | Right / D | Stick right, D-pad | R |
| Brake / lean back | Left / A | Stick left | L |
| Crouch | Down / S | Stick down | D |
| Manual / nose manual | Up / W | Stick up | U |
| Ollie (hold for height) | Space / Z | A | OLLIE |
| Flip (direction picks the trick) | X | X | FLIP |
| Grab (hold for a time bonus) | C | B | GRAB |
| Grind (hold near a rail) | V | Y | GRND |
| Special (meter full) | X + C | X + B | SPECIAL |
| Pause | Esc / P | Start | II |
| Restart | R | Select | - |
| Debug overlay | F1 | - | - |

## Known issues / next pass
- The skater sprites are readable but placeholder-grade next to the reference sheets; a head,
  ear, headgear and rim-light detail pass is the highest-value art work remaining.
- Adaptive quality steps down but never back up within a run (deliberate: avoids oscillation).
- The Results "next level" shortcut is not wired; SELECT LEVEL covers it.
- No Playwright smoke test yet; verification so far is hand-driven through the browser console.
- Real-device check on an actual phone (brief section 3.1) still belongs to the human operator.
