# 1. Mission and prime directives

Mission. Build a complete, polished, playable arcade skateboarding game in the spirit of the classic "pro skater"
score-attack formula (short timed runs, trick combos, grinds, manuals, collectibles, per-level goals, unlockable characters),
presented as moody nocturnal pixel art that matches the four attached reference images. The game must be light (low
resolution, small download) but feel like a real, finished game: menus, progression, saving, audio, juice and a satisfying
skating feel.
Prime directives

Playable first. The game must run (npm run dev) after every milestone. Never leave the repo broken.

Feel over features. Skating must feel tight, readable and fun within 10 seconds of first play. Spend time tuning.

Light and fast. 480x270 internal resolution, 60 FPS on a low-end laptop and mid-range phone, total download under 20
MB (aim for under 10 MB).

Two platforms, one game. Desktop and phone are both first-class targets with different input, layout, defaults and
performance handling (section 3.1).

Small, self-contained tasks. Work in small tasks with explicit files and acceptance checks so that smaller or cheaper
models can do most of the work (section 12.1).

Match the references. Characters and environments must look like they belong to the same world as the attached
images (sections 4 to 6).

Data-driven. Levels, tricks, characters, goals, physics values and strings live in JSON so content can be tuned without
code changes.

Original content only. Do not use the name, logo, characters, music or assets of any existing franchise (including Tony
Hawk's Pro Skater / Activision). Generic trick names (kickflip, 50-50, etc.) are fine. No copyrighted music or ripped
assets.

Autonomy with checkpoints. Work through the milestones in section 12 in order. After each: build passes, tests pass,
commit, update PROGRESS.md.
