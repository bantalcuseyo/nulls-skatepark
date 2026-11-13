# 8. UI / UX

Screen flow: Boot -> Title (animated alley art, neon signs flicker) -> Main menu (Career, Free Skate, Settings, Credits) ->
Character select (portraits in the REF-CHAR style, stat bars) -> Level select (level card, goal checkmarks, padlock) ->
Game + HUD -> Pause -> Results (score breakdown, goals, unlocks) -> back.
HUD element
Position / behaviour
Score and best combo
Top-left, large pixel font, count-up animation.
Current combo line
Top-centre: trick names stacked, total and multiplier, fades after banking.
Timer
Top-right, turns red and pulses under 10 s.
Special meter
Bottom-left neon bar (under the score on phone) with glow when full (shape + colour, not colour
alone).
Balance meter
Appears only during grind/manual: arc with needle, green zone, shake when near failure.
S-K-A-T-E letters
Bottom-right on desktop (under the timer on phone); letters light up when collected.
Goal toast
Short banner when a goal is completed.
Phone adjustments
Keep both bottom corners free for thumbs (touch controls live there). Score top-left, combo
top-centre, timer top-right. Minimum text size 8 virtual px.

Font: a free pixel font with an open licence (e.g. Press Start 2P or Silkscreen, SIL OFL) or a bitmap font you create.
Record the licence in CREDITS.md.

Menu style: neon-sign look (cf. ARCADE and LIQUOR signs), dark navy backgrounds, magenta and cyan accents,
subtle dither gradients, clear focus highlight, full keyboard/gamepad navigation.

Settings: master/music/SFX volume, screen shake and flashing reduction, CRT scanlines, assist balance, key
rebinding (minimal), fullscreen, and for phone: touch layout (left-handed swap, size, opacity) and haptics. Profile
override (auto / desktop / phone).

Language: UI is English only. Keep all UI text in strings/en.json (no hard-coded strings) so wording can be
changed in one place.
