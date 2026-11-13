# 7. Core gameplay specification

This is the heart of the project. "Forward" means the direction the skater faces; "Back" the opposite. All numbers are
tunable and live in data/physics.json and data/tricks.json.
7.1 Controls
Action
Keyboard
Gamepad
Touch (phone)
Notes
Push forward / lean
forward
Right or D
Stick right /
D-pad
D-pad right
Hold to push. In air: rotate forward (frontflip).
Brake / lean back
Left or A
Stick left /
D-pad
D-pad left
Turns around when nearly stopped. In air: rotate
back.
Crouch / nose
manual
Down or S
Stick down
D-pad down
Modifies tricks (see 7.4).
Manual / tail lift
Up or W
Stick up
D-pad up
Tap on flat ground to enter manual.
Ollie (jump)
Space or Z
A / Cross
OLLIE (largest button)
Hold for height.
Flip trick
X
X / Square
FLIP button
Plus direction selects trick.
Grab
C
B / Circle
GRAB button
Plus direction; hold for time bonus.
Grind
V
Y / Triangle
GRIND button
Hold in air near a rail to snap.
Special trick
X + C
together
X + B together
SPECIAL button
(appears when the
meter is full)
Only when special meter is full.
Pause / Restart
Esc or P / R
Start / hold
Select
Pause icon top-centre;
Restart in pause menu
and results
Restart must be under 1 second.

Touch layout (phone): left thumb = 4-way D-pad (a floating-stick variant is optional); right thumb = four buttons in a
diamond: OLLIE (largest, bottom), FLIP (left), GRAB (right), GRIND (top). SPECIAL appears above the diamond only
when the meter is full.

All touch buttons are multi-touch, show a pressed state, and give a short haptic tick via navigator.vibrate where
supported (Settings toggle). Left-handed layout swaps the two sides.
7.2 Skater state machine
States: Ground (idle, push, roll, brake, crouch) -> Air (ollie, flip, grab, rotate) -> Grind -> Manual -> Ramp ride (ground
state on slopes) -> Bail (slam, tumble, get-up) -> Special. Write the state machine as pure logic with explicit, tested
transitions. No state may be inescapable.
7.3 Movement and physics (starting values)
Parameter
Start value
Notes
Gravity
1400 px/s^2
Tune with jump height; skater is ~44 px tall.
Ollie impulse
420 px/s tap, up to 520 px/s held
About 63 to 96 px apex.
Max ground speed
260 px/s (x Speed stat factor 0.9 to 1.15)
Higher speed allowed on downhill slopes and
conveyors.
Push acceleration
160 px/s^2
Rolling friction 30 px/s^2, brake 260 px/s^2.
Slopes
Gravity component along the surface
Preserve tangent velocity when launching off a
ramp.
Air rotation
540 deg/s (x Air factor)
Held Forward/Back in air rotates the body.
Coyote time / jump buffer
6 frames / 6 frames
Also 8-frame trick input buffer (10 with Assist).


7.4 Tricks (all values tunable, defined in data/tricks.json)
Category
Trick (input)
Duration
Base pts
Flip (Flip + direction)
Kickflip (neutral), Heelflip (Down), Pop Shove-it (Up), Hardflip
(Forward), Inward Heelflip (Back)
0.45 to 0.7 s
100 to 250
Grab (Grab + direction)
Indy (neutral), Melon (Up), Stalefish (Down), Method (Forward),
Mute (Back). Bonus points per second held.
hold
150 to 300 + 100/s
Rotation (hold
Forward/Back in air)
Frontflip / Backflip, 360 and 720 variants (bonus)
by angle
500 / 2000
Grind (Grind + direction)
50-50 (neutral), 5-0 (Down), Nosegrind (Up), Boardslide
(Forward), Tailslide (Back). Points tick per 0.1 s and multiplier
grows each second.
balance
50/tick
Manual (tap Up / Down on
flat)
Manual and Nose manual, balance based
balance
40/tick
Gap (area trigger)
Named gaps in level data (e.g. "Dumpster Gap"), counts as a
trick for the multiplier
n/a
300 to 1500
Special (Flip + Grab, meter
full)
One unique special per character, 1.2 s animation, may be
chained
1.2 s
1500
7.5 Combo and scoring

A combo is a chain of tricks, grinds, manuals and gaps linked without a bail and without more than 1.2 s of plain rolling
between links. When the link timer expires the combo banks into total score.

Combo score = (sum of trick points) x multiplier. The multiplier is the number of distinct tricks in the combo. A
repeated trick scores 50% and does not raise the multiplier.

Special trick (consumes the full meter) doubles the multiplier for the remainder of that combo.

Special meter fills from trick points (faster with long combos and clean landings; Loop fills fastest) and drains to zero on
bail.

HUD callouts: stacked trick names with running total and multiplier, e.g. KICKFLIP + INDY + 50-50 1,250 x 3.
Add "SICK!" style callouts at score thresholds (original wording).

At timer end, any combo in progress gets a short grace period and then banks automatically.
7.6 Landing, balance and bail

Landing angle relative to the surface normal: Clean within 25 deg (full points, small speed bonus), Sketchy 25 to 50
deg (combo kept, points reduced, speed loss), Bail beyond 50 deg.

A flip trick not finished at touchdown: if more than 35% of the animation remains it is a Bail, otherwise Sketchy.

Balance meter (grind and manual): value b in [-1, 1] drifts away from 0 at a rate that increases with time and is reduced
by the Balance stat. Left/Right nudges it back. The green zone (|b| < 0.35) pays points; |b| >= 1 bails. An Assist setting
widens the zone and enables rail auto-snap (default ON on phone, OFF on desktop).

Bail costs only the current combo and about 1.0 s. No lives or health. The skater respawns rolling at the last safe
ground position. Bailing off the map edge or into a bail zone (track bed) is handled the same way. The skater can never
fall out of the world.
7.7 Goals, collectibles and progression
Goal slot (per level)
Description
Example (Level 1)
1 to 3 Score
Bronze / Silver / Gold total score within the time limit
15,000 / 30,000 / 50,000
4 S-K-A-T-E
Collect all five letters in one run
Letters placed along lines
5 Secret
Find the hidden item
Arcade Token / Spray Cans / Golden
Wrench
6 Level challenge
Level-specific trick goal
Grind all 3 rails in one combo; clear all 3
gaps in one run

Unlocks (default, tunable): Level 2 after 3 total goals; Level 3 after 8; Prism after 3 goals; Brass after 8; Loop after 14.
Riff and Level 1 available at start.



Free Skate shows high scores and lets the player practise with no timer. Save best score, completed goals and unlocks.
7.8 Camera
Look-ahead in the direction of travel scaled by speed, vertical dead zone, smooth follow, whole-pixel snapping, slight
zoom-out is not allowed (keep integer scale). Screen shake on bail and big landings (respect the reduce-flashing/shake
setting).
7.9 Game-feel checklist (mandatory)

Variable jump height, coyote time, jump buffer, trick input buffer, continuous collision, slope-following that never sticks or
launches randomly.

Landing squash (2 frames), dust puff, hit-stop (3 frames) on big landings, board and wheel sounds pitched by speed,
speed lines at high speed.

Grind sparks and scrape loop pitched by speed, clear visual cue when a rail is snappable (subtle outline pulse), clear
audio/visual cue on combo bank.

Debug overlay (F1): FPS, state, speed, angle, balance, colliders, combo timer. Physics values hot-reloadable in dev.
