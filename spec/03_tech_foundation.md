# 3. Technical foundation

Area
Requirement (default unless the human overrides)
Language / engine
TypeScript + Phaser 3 (3.80 or newer), bundled with Vite. If you strongly prefer another engine (e.g.
Godot 4 web export, Kaplay), you may, but justify it in DECISIONS.md and keep every other constraint.
Targets
Modern desktop and mobile browsers (Chrome, Firefox, Safari, Edge). Static build in dist/ deployable to
itch.io or GitHub Pages. Fully offline single-player.


Area
Requirement (default unless the human overrides)
Resolution
480x270 virtual resolution (16:9). Integer scaling (2x, 3x, 4x...) with letterboxing. Nearest-neighbour
filtering, pixelArt: true, roundPixels: true, antialias off. Sprites and camera snap to whole
pixels.
Simulation
Fixed timestep at 60 Hz with render interpolation. Game logic (skater, tricks, scoring, goals) is pure
TypeScript with no Phaser imports so it can be unit-tested and tuned deterministically.
Physics
Custom kinematic skater controller (no general-purpose physics engine). Ground is a polyline with slope
data; continuous collision so the skater never tunnels at top speed.
Input
Keyboard and Gamepad API (desktop); on-screen multi-touch controls (phone, required). An external
gamepad or keyboard must also work on phone. One shared input abstraction. Input buffering (see 7.9).
Save data
localStorage, versioned schema, wrapped in try/catch with in-memory fallback. Stores goals, high scores,
unlocks, settings.
Quality
ESLint + Prettier, strict TypeScript, Vitest for pure-logic tests (scoring, combo, trick resolution, goal
evaluation, save migration). Optional Playwright smoke test that boots the game and captures
screenshots.
Performance
60 FPS target. Texture atlases under 2048x2048. Pool particles and sounds. No per-frame allocations in
the hot loop. Total assets under 20 MB.
3.1 Platform profiles: desktop vs phone
Both profiles share one codebase, one simulation and the same 480x270 art. They differ in viewport, input, HUD layout,
defaults and performance handling. Detect the profile at boot (touch capability and viewport size) and allow a manual
override in Settings.
Aspect
Desktop
Phone
Viewport
480x270 virtual (16:9). Largest integer
scale that fits, letterboxed. Fullscreen
toggle (F).
Landscape only. Virtual height fixed at 270; virtual width flexible from
480 to 576 (16:9 up to about 19.5:9) so there are no large black bars.
Gameplay-critical content stays inside the central 480x270 safe area.
Respect device safe-area insets (notch). Portrait shows a 'rotate your
device' screen and pauses.
Input
Keyboard, optional gamepad, mouse
for menus.
On-screen touch overlay (section 7.1), multi-touch so several buttons
can be held at once. External gamepad or keyboard also supported.
Touch UI
Not shown.
Buttons at least 48 CSS px (about 9 mm) with gaps of 8 px or more,
semi-transparent (default 55%), anchored to the bottom corners, never
covering the gameplay centre or HUD. Settings: left-handed swap,
size, opacity, haptics on/off.
Browser gestures
Not relevant.
Disable pinch zoom, double-tap zoom, scrolling, pull-to-refresh and
long-press menus (touch-action: none, user-select: none, viewport
meta, preventDefault on touch events).
HUD
As in section 8.
Same elements, thumb-safe: bottom corners left free. Larger text
(minimum 8 virtual px, scaled by the integer scale). See section 8.
Assist defaults
Off. Input buffer 8 frames.
On: wider balance zone, rail auto-snap, input buffer 10 frames.
Menus
Keyboard/gamepad focus plus mouse
hover.
Large tap targets (48 CSS px minimum), no hover-only states,
always-visible Back button.
Performance
60 FPS. Full particles and lighting
overlays.
Target 60 FPS with adaptive quality: measure average frame time
over 2 s; if above 20 ms, step down (halve particles, replace dithered
lighting overlays with pre-baked ones, disable CRT filter, reduce
shake). Memory under 150 MB. Pause updates when the tab is hidden.
Audio
Unlock on first key press or click.
Unlock on first touch; resume the AudioContext after visibilitychange
(iOS Safari).
Install / offline
Optional.
PWA: web manifest (landscape, fullscreen display) and a service
worker so the game installs to the home screen and runs offline. Title
screen shows short 'Add to Home Screen' help on iOS.


Aspect
Desktop
Phone
Testing
Latest Chrome, Firefox, Edge, Safari.
Chrome on Android and Safari on iOS. Playwright device emulation (for
example Pixel 7 and iPhone 14 in landscape) in the smoke test, plus a
real-device check by the human before shipping.
