# 13. Working rules, defaults and Definition of Done

Working rules

Do not stop to ask for decisions covered by the defaults below. Pick, record the choice in DECISIONS.md and
continue.

When blocked (missing asset, ambiguous requirement, tool failure): state the problem, give 2 or 3 options with a
recommendation, and continue with the recommended option unless the human replies.

No scope creep before M8. Do not add features not in this document until the game is complete and polished.

Commit often with clear messages (feat:, fix:, tune:, art:, docs:). Keep main always runnable.

PROGRESS.md after each milestone: done, how to test, known issues, next steps, asset size. DECISIONS.md: any
deviation or default chosen, with the reason.

Playtest by playing. Where possible run the game, capture screenshots, and tune the numbers. Log tuning changes in
docs/GAME_DESIGN.md.
Defaults for open decisions (human may override)
Decision
Default
Platform
Web: desktop browser and phone browser (landscape), two profiles (section 3.1), offline,
single-player, installable as a PWA on phone.
Engine
Phaser 3 + TypeScript + Vite.
Perspective
2D side view with parallax.
Title
NULLS SKATEPARK (placeholder; keep it in one config constant).
Final art source
Placeholder-first, then swap in final pixel art; references are the style target.
UI language
English only; strings still externalized in strings/en.json.
Music
Original synth/procedural; no copyrighted music.
Agent models
Tier L deepseek/deepseek-v4.1-flash (default), Tier M moonshotai/kimi-k3.1-pro, Tier H
anthropic/claude-sonnet-5.5 (section 12.1).
Online / accounts / monetization
None.
Content scope
3 levels, 4 characters, ~30 tricks, 6 goals per level.
Definition of Done

Playable from title to results for all 3 levels and 4 characters without console errors, softlocks, or falling out of the world.

60 FPS on a mid-range laptop; near 60 FPS (or graceful adaptive degradation) on a mid-range phone browser;
production build under 20 MB.

Phone: comfortable to play in landscape with the touch controls, rotate screen in portrait, installs as a PWA and runs
offline; verified in Playwright device emulation and on a real device by the human.

All 18 goals (6 per level) are achievable; unlocks and saves work across reloads.

Controls feel tight (section 7.9 checklist passes); bail and respawn are fast and fair.

Visuals consistent with the references (docs/qa has side-by-side shots); audio mixed and togglable.

Unit tests pass; npm run build succeeds; README explains install, controls, build and deploy; CREDITS lists every
third-party asset and licence.


Appendix A: sprite generation briefs (for an image generator or a
pixel artist)
Use these only if you (or the human) have an image generation tool. AI image tools often produce inconsistent frames, so
generate one character pose sheet first, then animation strips, then clean up in a pixel editor (Aseprite / LibreSprite) and
convert to the exact grid and palette. If no generator is available, keep the procedural placeholders and tell the human what
is missing.
Global style block (prepend to every prompt)
Modern retro pixel art, crisp pixel edges, no anti-aliasing, 1-pixel dark outline, limited 32-colour palette,
ordered dithering for gradients, soft rim lighting, nocturnal urban mood, 2D side view, transparent background,
64x64 pixel cells aligned on a strict grid, consistent proportions across frames.
Shared character block
Anthropomorphic black cat skateboarder, chibi proportions (head one third of body height), completely solid flat
black head with no mouth and no nose, pointed ears, luminous white half-lidded crescent eyes, black gloves,
baggy 90s streetwear, standing on a skateboard.
Per-character additions
Skater
Add to prompt
RIFF
wide spiky upright ears with no inner colour; white half-moon half-lidded eyes; red over-ear headphones with a thin
red band and a cord hanging down; oversized beige t-shirt with loose short sleeves; very wide-leg blue jeans with
dark folds; black gloves; red handheld game console held in both hands; dark sneakers with white soles; warm red
rim light on the left.
PRISM
tall rounded-pointed ears with peach inner ear; wrap-around rainbow gradient visor (cyan, green, yellow, magenta)
with a white crescent eye visible; one silver headphone cup on the left; black and purple zip tracksuit with high collar,
neon rainbow piping on sleeves and legs and a rainbow chevron on the chest; red handheld console; white cream
chunky sneakers; cool rim light.
BRASS
tall pointed ears with tan inner ear; round brass goggles with glowing amber lenses; rust-brown jacket with cream fur
collar; black gloves; grey baggy pants with orange rim light; small notebook with brown cover and cream pages;
brown shoes with white soles; warm orange rim light.
LOOP
pointed ears with lavender-silver rim highlight; teal over-ear headphones with silver adjuster arm and a cord to a
silver portable CD player; round clear glasses with thin white rims and closed-eye arcs; dark green chunky puffer
jacket with high zip collar; navy baggy pants with red-orange rim light; dark sneakers; warm red-orange rim light.
Animation strips and environment pieces

Strip request template: "sprite sheet strip, N frames in one row, each 64x64, animation: <idle | push | ollie | kickflip |
grind 50-50 | manual | bail slam | get up>, same character and palette as the pose sheet."

Environment pieces: "seamless horizontally tileable background layer, 480x270, <brick alley facade | tiled subway wall
with graffiti | warehouse brick wall with steel beams>, dithered lighting, same palette as the reference." Props separately
on transparent background: kicker ramp, grind rail, dumpster, bench, quarter-pipe, funbox, crates, drums, neon signs.

Menu portrait: "128x128 pixel art portrait of <character> seated on a green subway bench, same style, lighting and
framing as REF-CHAR". Use the matching detail sheet as the visual reference.

Negative prompt: photorealistic, smooth gradients, anti-aliased edges, text artefacts, extra limbs, inconsistent
proportions, logos, copyrighted characters.


Appendix B: reference images (style bible)
Original files are provided alongside this PDF. If you cannot open them, use the embedded copies below. Look at palette,
outline weight, dithering, lighting and silhouettes, and match them. If your model cannot view images, rely on the written
specs (sections 4 to 6) and the sampled colours in section 5.4.
File
What it is
ref_env_alley.png
REF-ENV-1: alley (level 1)
ref_env_subway.png
REF-ENV-2: subway platform (level 2)
ref_env_warehouse.png
REF-ENV-3: warehouse skatepark (level 3)
ref_characters.png
REF-CHAR: the full 2x2 sheet of all four skaters
character_refs/ref_char_NN_name_sheet.png
One detail sheet per skater (01 riff, 02 prism, 03 brass, 04 loop): panel,
enlarged detail crops, spec, swatches, stats, sprite notes
character_refs/ref_char_NN_name_panel.png and
_detailN_*.png
Raw crops at original resolution (panel and three detail crops per skater)
character_refs/palettes.json
Sampled key colours per skater
REF-ENV-1: Alley (level 1, one-point perspective; neon ARCADE and LIQUOR signs, dithered lamp cones, kicker ramp, rail, dumpsters)


REF-ENV-2: Subway platform (level 2, side-on; graffiti tile wall, train, bench, kicker ramp, spray cans)


REF-ENV-3: Warehouse skatepark (level 3, side-on; brick, steel beams, fluorescent tubes, concrete bowl, funbox, machinery)
REF-CHAR: the four skaters (top-left RIFF, top-right PRISM, bottom-left BRASS, bottom-right LOOP)
