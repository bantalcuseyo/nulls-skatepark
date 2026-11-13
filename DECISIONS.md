# DECISIONS

Deviations and defaults chosen, with reasons (brief section 13).

## D001 — Engine: Phaser 3 + TypeScript + Vite (no deviation)
Default kept. Phaser 3.80.1 with `pixelArt: true`, `roundPixels: true`, `antialias: false`.

## D002 — Palette extraction source
`tools/extract_palette.py` reads the three environment references (extracted from the PDF at
1024x572) plus the four character sheets, concatenated before the median cut. Using all seven
avoids a palette tuned only for the subway.

## D003 — RiFF / LOOP footwear (brief section 5.4)
Not visible in the reference sheets. Chosen: dark sneakers with light soles, per the brief's
default. Implemented as `#1b2238` upper + `#adb18c` sole from the extracted palette.

## D004 — Reference images come from the PDF
The prompt PDF embeds the three environment stills and the 2x2 character sheet; the four
individual detail sheets arrived as separate images. All were copied into `docs/refs/` so the
repo is self-contained.
