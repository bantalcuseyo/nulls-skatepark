# PROGRESS

## M0 — Foundation (done)

**Done**
- Repo scaffold: Vite 5 + TypeScript 5 (strict) + Phaser 3.80.1, Vitest, ESLint/Prettier installed.
- 480x270 virtual resolution, integer scaling, nearest-neighbour, letterboxed; phone profile flexes
  virtual width 480–576 at fixed height 270 (`src/systems/Scaling.ts`).
- Platform profile detection with manual override (`src/systems/PlatformProfile.ts`).
- `src/sim/types.ts`: InputAction / InputFrame contract, owned by Tier H.
- Tools: `tools/extract_palette.py` (median-cut 32 colours → `public/assets/palette.json`),
  `tools/downscale_refs.py` (LANCZOS 480x270 + quantize → `public/assets/ref_scaled/`),
  `tools/split_brief.py` (brief → `docs/spec/`).
- Boot scene draws downscaled REF-ENV-2 as a static background + FPS overlay.
- PWA manifest stub, touch gesture suppression, portrait handling planned for M6.

**How to test**
```
npm run dev      # open http://127.0.0.1:5173
npm run test     # unit tests
npm run build    # production build in dist/
```

**Known issues**
- FPS overlay is a plain Phaser text label (proper debug overlay lands in M1 with F1 toggle).
- Portrait "rotate device" screen is not wired yet (arrives with the menu shell in M6).

**Asset size**: palette.json 2 KB, 3 reference downscales 246 KB total.
