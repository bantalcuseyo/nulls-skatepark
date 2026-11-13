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
individual detail sheets arrived as separate images. All were copied into `spec/refs/` so the
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

## D010 - Character stats and palette provenance corrected (brief step 0)
`src/data/characters.json` carried stats that never matched the original spec (RIFF 4/4/3/3 instead
of 3/3/3/3). All four rows are now the spec's numbers, each totalling 12: RIFF 3/3/3/3, PRISM
3/4/2/3, BRASS 2/2/5/3, LOOP 4/2/4/2. Specials, unlocks, roles and descriptions are untouched.

Every `docs/refs/` path was wrong: the reference images live in `spec/refs/`. Fixed in
`tools/extract_palette.py`, `tools/downscale_refs.py`, `public/assets/palette.json`,
`DECISIONS.md`, `CREDITS.md` and `README.md`. Re-running `tools/extract_palette.py` over
`spec/refs/*` reproduces the exact same 32 colours, so only the provenance was wrong, not the art.

## D011 - HEALTH and STAMINA are real mechanics (overrides the original spec)
The original spec said there is no health: a bail costs the combo only. The rebuild brief makes both
real, so this entry records the override. Numbers live in `src/data/physics.json` and are read by
`SkaterSim`, never hardcoded in the HUD:

| Rule | Value |
|:--|:--|
| HEALTH max | 100 (all four characters) |
| Bail | -25 (and still costs the combo) |
| Rolling hazard hit | -10, rate-limited to one hit per 0.8 s |
| Clean landing after a scored trick | +5, capped at 100 |
| HEALTH 0 | run over: BAILED OUT screen, score kept, RETRY offered |
| STAMINA max | 100 |
| Ollie / flip / grab | -15 / -10 / -10 |
| Grind | -20 per second, scaled by BAL (5 BAL drains at 60 %) |
| Push | -5 per stroke, scaled by SPD (5 SPD is 40 % cheaper) |
| Regeneration | +25/s while rolling on the ground and not pushing |
| Lockout | under 15: ollie / flip / grab refused, bar flashes, rolling still works |

Bars animate toward the real value (160 HUD px/s for HEALTH, 200 for STAMINA) instead of jumping.
Log any playtest retune here.

## D012 - In-game skater is a 3/4 side view built from a profile bias
The reported problem was that the in-game skater was a small rear view with no face. The sprite
renderer in `tools/gen_art.py` was geometrically symmetric, so at 40-48 px it read as a front-on
mask. Two constants (`PROFILE_HEAD_DX`, `PROFILE_FOOT_DX`) bias the head and lead foot along the
direction of travel, and the eye row now draws a full-size near eye plus a narrower far eye.
RIFF's headphone band was raised off the brow because it was covering his crescent eyes.

The characters are NOT redrawn from a description. Outfit colours, ears, headgear and props come
from the owner's character sheets in `spec/refs/` and are encoded in the `SKINS` table; the HUD
portrait is a crop of the owner's own panel (`tools/gen_portraits.py`).

## D013 - D007 is superseded: backgrounds repeat instead of mirroring
Mirror-tiling a strip produces a mirror-symmetric wall with a visible centre seam, which is one of
the reported defects. `mirror_seam()` now returns the strip unchanged so layers tile as a plain
repeat. The tile is authored to end on a course boundary, and the alley facades now fill their full
240 px cell (they used to stop at +232, leaving an 8 px flat gap that read as a hard vertical seam
every 240 px).

## D014 - One ground line: art and terrain share y=208
The painted environment and the level geometry disagreed, so props and the skater appeared to float.
`alley.json` was at y=220 while subway and warehouse were at 208; the alley is now 208 like the
rest. `tools/gen_subway.py` paints its platform surface at 208, and levels can declare a
`groundBand` (a tile sprite that scrolls 1:1 with the camera) so the drawn ride line cannot drift off
the sim's ground polyline. When a `groundBand` exists the graphics floor is suppressed, because two
drawn ground lines is exactly the defect being fixed. Brick and shopfronts are drawn only ABOVE 208;
below it is roadway, never wall.

## D015 - Scene instance reuse caused the pause and RUN COMPLETE soft-locks
Phaser reuses scene instances. `Pause` and `Results` kept their `items` array across a
stop-and-relaunch, so the second pause (and the second run) re-measured destroyed `BitmapText`
objects inside `refresh()`. `BitmapText.width` then threw `Cannot read properties of null (reading
'scaleX')` in `create()`, which left the game paused with no overlay and the timer stuck at 0:00.

Both scenes now reset `items`/`actions`/`idx` at the top of `create()` and `refresh()` skips entries
whose `frame` is gone. `togglePause()` also debounces repeat presses for 250 ms so one physical
keypress cannot toggle twice. Verified by driving the real browser: ESC x4 cycles
paused -> resumed -> paused -> resumed, and pause -> resume -> finish -> RETRY works every time.

## D016 - HUD text is measured from string length, not BitmapText.width
Right-aligning with `right - obj.width` clipped the head off long labels ("SPECTRUM SPIN" rendered as
"TRUN SPIN") because the bitmap text bounds cache is stale on the frame a string changes. The HUD
right-aligns using `textW(text) = len * 8` (the font is fixed-width 8 px) AFTER setting the string.
Both clusters also sit on a soft dark plate: the scene is mid-value pixel art, and bare text on top
of a lit train window was unreadable even when correctly positioned.

## D017 - Text colour is baked, not tinted (tint is WEBGL-only in Phaser 3)
`BitmapText.setTint()` silently does nothing under Phaser's **CANVAS** renderer, which is what any
browser without WebGL falls back to. The whole HUD relied on `setTint` for the per-character
colours, so on such a browser the name, the special name and the special bar label all rendered as
plain cream — a direct failure of the brief's "portrait, name, special name and bar colour must all
change when the selected character changes".

This was caught by sampling screenshot pixels, not by eye: `comboValue.tintTopLeft` reported
`e8a93a` while the rendered glyphs were `#f4f0e8`. Confirmed the cause by printing
`game.renderer.type` (1 = CANVAS, no WebGL in this environment).

`tools/gen_font.py` now emits one pre-coloured sheet per UI colour (`font_cream.png`,
`font_amber.png`, ...) and `PixelText` swaps the font sheet, so colour works on both renderers.
`setTint(hex)` is kept and maps to the nearest baked sheet, so existing call sites are fixed
without being rewritten. On WEBGL the output is identical to before.

Note for future QA: all screenshots in this pass were captured under CANVAS. Any effect that is
WEBGL-only (tints, some blend modes) will look different in that environment than on a normal
desktop browser, so pixel-sample the result rather than trusting the reported tint value.

## D018 - Both character-select columns sit on opaque plates
The list column had no plate, so the alley's maroon ARCADE neon showed through the row area and
read as a phantom selection highlight (reported as an "ARCADE PRISM" ghost row). The info column's
text was centred on the screen's 0.66 mark rather than on the plate, so long descriptions spilled
~20 px outside their own panel.

Both columns now have opaque plates, and the info column's text is left-aligned on a single x
derived from the portrait's right edge, so nothing can leave the plate regardless of length.
