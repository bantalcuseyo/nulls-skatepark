# CREDITS

## Code
- Phaser 3 (MIT) — https://phaser.io
- Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT)

## Art
- All sprites, tiles, props and backgrounds are generated procedurally for this project by
  `tools/gen_art.py` from the palette in `public/assets/palette.json`. No third-party art.
- Style references (`docs/refs/`) were supplied by the project owner and are used as art
  direction only; no pixel data is copied into shipped assets except the deliberately
  downscaled reference stills used for the M0 background, the title screen backdrop and the
  level-2/3 first-screen mid layer (per brief section 6).

## Audio
- All music and SFX are synthesised at runtime with WebAudio (procedural) or generated as
  OGG by `tools/gen_audio.py`. No third-party samples.

## Fonts
- Bitmap pixel font generated in `tools/gen_font.py` (project-original glyphs, 5x7 cell).
  No external font licence applies.
