# 4. Art direction

The four attached images are the style bible. They are 1024x572 AI-generated pixel-art stills. Reproduce their look at
480x270 in-game.

Style. Modern retro pixel art: chunky 1-pixel dark outlines on sprites, soft rim lighting, ordered (Bayer/checker)
dithering for light cones, haze and gradients (see the dithered streetlamp cones in the alley reference), saturated neon
accents against a desaturated dark base.

Palette. Extract the master palette from the reference images automatically (tools/extract_palette.py,
median-cut to 32 colours, save palette.json) and lock it. Every asset you create must use only palette colours
(per-level sub-palettes of about 16 colours are allowed). Mood colours below are approximate, for orientation only.

Lighting. Warm sodium streetlamp cones (dithered edges, additive blend), neon sign glow with subtle flicker, cold
fluorescent tubes in subway and warehouse (green-white, occasional flicker), pooled floor light, gentle vignette. Optional
CRT scanline filter (settings toggle, default off).

Parallax. 3 to 5 layers per level (far skyline or ceiling, mid facade or wall, near details, gameplay plane, foreground
occluders).

FX. Dust puffs on push and land, yellow-white grind sparks, short board trails on flips, landing impact rings, combo text
pops, screen shake and hit-stop on bails and big landings.
Mood colour
Approx.
Used for
Night navy / indigo
#0c1226
Sky, deep shadows, UI backgrounds
Brick red-brown
#6b2f26
Alley and warehouse brick walls
Sodium amber
#e8a93a
Streetlamp cones, subway window glow, special effects
Neon magenta / cyan
#e0245e / #12d4e0
ARCADE / LIQUOR signs, light spill, UI accents, rainbow visor
Tile sage green
#6f7a5e
Subway wall tiles, bench seats in character art
Maroon and dark green
#5a1f22 / #1f3b2b
Subway train body, puffer jacket
Rust orange / wood tan
#b8642a / #c79a5b
Ramps, pipes, crates, barrels
Fluorescent green-white
#c8f0a0
Warehouse tube lights
