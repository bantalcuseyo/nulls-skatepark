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
- `docs/spec/` — the build brief split by section (source of truth).
- `tasks/` — one task file per milestone.

## Deploy

`npm run build` produces a static `dist/`; upload as-is to itch.io or GitHub Pages. The build is
relative-based (`base: './'`) so it works from any subdirectory.
