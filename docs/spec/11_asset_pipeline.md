# 11. Asset pipeline

You cannot rely on perfect final art from the start. Use a placeholder-first pipeline so gameplay is never blocked, and so
final art can be swapped in later without touching code.
Step
What to do
1 Tools
tools/downscale_refs.py: resample the four reference images to 480x270 (LANCZOS, then quantize
to the master palette) into public/assets/ref_scaled/. tools/extract_palette.py: produce
palette.json.
2 Placeholders
tools/make_placeholders.py generates sprite sheets with the final names, sizes and frame counts:
black-head silhouette with ears, gloves, coloured outfit blocks, simple board, so every animation exists from
day one. Also placeholder tiles, ramps, rails, props in palette colours.
3 Final art
Replace placeholders by hand-drawn or AI-generated pixel art (see Appendix A). Naming:
char_{id}_{anim}_{frame} in a Phaser JSON atlas, or fixed 64x64 grid sheets. Swapping must require
zero code changes.
4 Backgrounds
Layered PNGs per level (far / mid / near / foreground). Ground tiles 16x16 or 32x32. Use REF-ENV-2/3
downscales as first-screen mid layers and extend with mirror-tiled seams. Build the alley side-on from the kit;
use REF-ENV-1 for the title and loading art.
5 Packing
Atlas packing (max 2048x2048), no sub-pixel offsets, power-of-two optional. Report total asset size in
PROGRESS.md at each milestone.


Visual QA loop
At every milestone that changes visuals, capture a screenshot of the running game (Playwright or the dev server) and
compare it side by side with the matching reference. Save pairs in docs/qa/ and note differences (palette, lighting,
outline weight, dithering, character silhouette) with fixes. Do not declare a milestone done if the look clearly diverges
from the references. Image reading is routed to a vision-capable tier (section 12.1). If your model cannot view images,
rely on the written specs, palette.json and the hex values in section 5.4, and ask the human or Tier H to run the visual
QA.
