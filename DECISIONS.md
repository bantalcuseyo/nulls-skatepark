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

## D009 - Skater sprites are built to a measured budget
The first sprite pass built the figure 59-62 px tall inside a 64 px cell. That overflow is what
made the limbs collapse into one silhouette: there was no room left for a background gap between
the legs. The renderer is now built to the brief's numbers (section 5.1): a 40-48 px figure, feet
at y=58, a head about a third of the figure, a wide stance and thin limbs.

`tools/gen_art.py` is verified by measuring the rendered PNG rather than by looking at it:
silhouette height per animation, and the width of the transparent channel between the legs.
Current measurements: heights 45-50 px, leg gap 3-7 px on every character and every ground
animation. Re-run that measurement after any change to the geometry constants.

Note for whoever picks this up next: an image-description model rated these sprites 7/10, then
4/10, then 5/10 across three rounds while the actual measurements improved each time, and it
described a side-view sprite as "top-down". Do not tune art against that signal; tune against the
measurement, and judge the result at 1x in the running game.
