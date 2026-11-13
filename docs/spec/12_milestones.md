# 12. Milestones, acceptance criteria and agent tiers

Complete milestones in order. After each: run build and tests, commit, update PROGRESS.md (what was done, how to
test, known issues, asset size), then continue immediately to the next unless blocked.
ID
Lead tier
Deliverable
Acceptance criteria
M0
Foundation
H then L
H writes src/sim/types.ts (interfaces), data schemas,
folder skeleton and the input contract. L does repo, Vite +
TS + Phaser, 480x270 scaling for both profiles, tools
(palette, downscale), debug overlay, README stub,
splits this brief into docs/spec and tasks/. Show
downscaled REF-ENV-2 as static background.
npm run dev works; crisp pixels at
integer scales; phone landscape viewport
with flexible width works; palette.json
exists; FPS overlay.
M1 Skate core
H
Skater controller (push/roll/brake, variable-height ollie),
camera follow, fixed timestep. Input layer: keyboard,
gamepad and touch overlay (M builds the touch
behaviour against H's input contract; L draws the button
art).
Responsive controls, no jitter, apex 63 to
96 px, latency within 1 frame, touch buttons
are multi-touch.
M2 Terrain
and ramps
H
Polyline ground with slopes, kicker and quarter-pipe
props, momentum conservation, ramp launch, landing
evaluation, bail and respawn.
Ride up and launch off a quarter-pipe; no
tunnelling at max speed; respawn works.
M3 Tricks and
score
M
Flips, grabs, rotations, trick durations, combo manager,
scoring/multiplier, special meter, HUD, unit tests.
Scoring and combo tests pass; repeated
tricks decay; HUD text matches state.
M4 Grinds
and manuals
H
Rails/ledges, snap logic, balance meter, manual on flat,
linking combos, sparks FX.
Can chain ollie -> grind -> ollie -> manual in
one combo; balance failure bails.
M5 Level 1
(vertical slice)
M (L for
data)
Alley: parallax, kit props, dithered lamp cones, neon
signs, gaps, S-K-A-T-E, secret, 2:00 timer, goals, results
screen, instant retry.
Whole loop playable on desktop and
phone; side-by-side screenshot vs
REF-ENV-1 saved in docs/qa (reviewed by
H).
M6 Meta and
menus
L (M for
save)
Title, main menu, character select (4 characters, stats,
unlock rules), level select, pause, settings, save system,
desktop and phone menu layouts.
State persists; unlocks work; all four
characters playable via paper-doll/palette
swap; menus usable by touch.
M7 Levels 2
and 3
M (L for
data)
Subway (train, spray cans, track gap) and Warehouse
(bowls, funbox, conveyor, drums).
Each level has 6 completable goals;
difficulty ramps from L1 to L3.
M8 Audio and
juice
M (H
tunes)
Music loops, SFX, shake, hit-stop, particles, light flicker,
CRT toggle, camera polish, adaptive quality for phone.
Mix is balanced; toggles work; no clipping;
phone keeps near 60 FPS or degrades
gracefully.
M9 Ship
H
Profiling, size optimization, device tests (emulation plus
human real-device check), bug bash, tuning pass,
README, CREDITS, PWA, production build and
itch.io-ready zip.
Definition of Done (section 13) fully met.
Stretch (only after M9): local leaderboard, replay of the best combo, in-game level editor, extra characters and levels.
12.1 Agent tiers and task routing
The human runs three agent tiers; the model names live in this table only, so they can be swapped without touching the
rest of the brief. Route work by difficulty, not by milestone number. If your harness can route a model per task, use the
table below; if one agent does everything, it follows the same task breakdown and the human switches model at the
marked checkpoints. Model capabilities (vision, context size) are not assumed.


Tier
Model (set by human)
Use for
L (default)
deepseek/deepseek-v4.1-flash
Everyday work: scaffolding, tooling scripts, JSON data (levels, tricks, characters,
goals, strings), menus and settings scenes, HUD layout, touch button art,
placeholder generation, README and docs, unit-test boilerplate, simple bug fixes
with a clear repro.
M
moonshotai/kimi-k3.1-pro
Medium-complexity systems: trick/combo/score logic, goal system, save system
with migration, level loader, camera rig, hazards (train, conveyor, barrels), audio
manager and procedural music, particles, adaptive quality, touch behaviour
(multi-touch, haptics).
H
anthropic/claude-sonnet-5.5
Hard and cross-cutting work: architecture and interface contracts, skater physics
(slopes, continuous collision, landing evaluation), grind and balance mechanics,
game-feel tuning, anything that needs reading images (style QA against
references, screenshot comparison, palette decisions), code review at checkpoints,
hard bug triage, performance profiling, the final Definition of Done audit.
Task
Tier
Done when
Repo, Vite, scaling for both profiles, tooling, README
L
dev server and build work; both viewports
render crisp
Interfaces, data schemas, folder skeleton, input contract
H
types compile; docs/spec written
Skater controller, slopes, landing, bail
H
M1 and M2 acceptance met
Keyboard and gamepad input layer
M
buffers and mappings tested
Touch overlay and platform profile detection
M (art by L)
works in Playwright device emulation
Trick, combo and score logic plus unit tests
M
tests pass
Grind and balance mechanic
H
M4 acceptance met
Level JSON authoring (props, gaps, collectibles, goals)
L (M reviews)
level loads; all goals completable
Menus, settings, character and level select, results
L
navigable by keyboard, gamepad and touch
Save system with versioned migration
M
tests pass; survives reload
Hazards: train, conveyor, barrels
M
behave per section 6; never softlock
Audio manager, SFX and music
M
mix balanced; toggles work
Particles, juice, lighting overlays
M (H tunes)
matches reference look; no FPS drop
Adaptive quality and profiling
M builds, H profiles
phone holds near 60 FPS or degrades
gracefully
Visual QA against references
H
side-by-side shots in docs/qa
Milestone code review and playtest notes
H at M2, M4, M5, M9; M
otherwise
issues logged in PROGRESS.md
Bug fixing
L first, escalate
regression test added
12.2 Handoff, escalation and context hygiene

First task of M0: split this brief into docs/spec/NN_section.md files and write tasks/Mx.md for every milestone
listing the exact spec files, source files and acceptance checks. Every later session reads only its task file, the relevant
spec files and PROGRESS.md, never the whole brief.

Small tasks: one task is one module or one file group (about 300 changed lines at most) with a runnable acceptance
check. Every task ends with: tests pass, build passes, PROGRESS.md updated, one commit.

Escalate one tier after 2 failed attempts or a failing test with an unclear cause. Write ESCALATION.md (goal, what was
tried, error output, files involved) and stop. The higher tier resolves it and deletes the file.

Interfaces are owned by Tier H (src/sim/types.ts). Other tiers may not change a public interface without a note in
DECISIONS.md.

Review checkpoints: Tier H reviews code and playtest notes at M2, M4, M5 and M9; Tier M reviews the other
milestones.


Per-task prompt template (the human or the orchestrator sends this to the chosen tier):
You are working on NULLS SKATEPARK (repo root). Read: tasks/M3.md, docs/spec/07_gameplay.md, PROGRESS.md.
Task: implement src/sim/ComboScore.ts per section 7.5, with unit tests in tests/combo.test.ts.
Only modify: src/sim/ComboScore.ts, tests/combo.test.ts, data/tricks.json.
Acceptance: npm test passes, npm run build passes, PROGRESS.md updated, one commit.
If stuck after 2 attempts: write ESCALATION.md and stop.
