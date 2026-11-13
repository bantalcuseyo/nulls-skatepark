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

## D005 - Ramp launch must not auto-spin (playtest fix)
Holding a direction key to accelerate is also the air-rotation input. That meant every ramp
launch auto-rotated and bailed on landing. Fix: a direction key already held when the skater
leaves the ground is treated as locomotion, not rotation intent, until it is released or
re-pressed (`rotHoldLock` in `SkaterSim`). Deliberate spins still work by releasing then holding
in the air, or by ollieing (which does not set the lock).

## D006 - Terrain is a base polyline plus floating surfaces
Merging ramps and platforms into one ground polyline made the sampler interpolate spurious
near-vertical walls between the street and a raised platform, which both looked wrong (giant
triangles) and teleported the skater. Terrain is now a continuous base polyline plus separate
`surfaces` (ramps, platforms) with one-way flagging, and the sim remembers which surface it is
riding (`ridingIndex`) so a ramp can be climbed.

## D007 - Background layers are mirror-tiled
Each layer strip is generated at 1440 px then saved as `original + horizontal mirror` (2880 px).
Tiling that reads as a continuous street instead of hitting a hard repeat cut every 3 screens.

## D008 - Adaptive quality is phone-only and one-way down
`AdaptiveQuality` measures average frame time over 2 s and steps 1.0 -> 0.6 -> 0.4 on phones.
Enabled only for the phone profile so desktop visuals are never degraded.
