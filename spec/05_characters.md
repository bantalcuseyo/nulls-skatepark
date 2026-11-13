# 5. Characters (4 playable)

See REF-CHAR in Appendix B (four panels, each skater seated on a green subway bench). All four share one body plan
and one animation set; they differ by ears, headgear, outfit colours, props and stats.
5.1 Shared design rules

In-world the skaters are called Nulls: blank-faced skaters with solid black heads. This is the identity of the game, so the
blank black head is never replaced by a face.

Anthropomorphic cat-like skaters. The entire head is a solid, flat black silhouette: no mouth, no nose, no skin tones.
Pointed ears (inner ear may have a small tan or lavender highlight).

The only expressive features are luminous eyes (white half-lidded crescents or closed-eye arcs) or lenses/visors.
Expression comes from eye shape, posture and animation, not a face.

Black gloved hands. Chibi proportions: head is about one third of total height. Baggy, oversized 90s streetwear
silhouettes. Chill, relaxed body language.

In-game sprite: about 40 to 48 px tall on a 64x64 cell, 1-px dark outline, soft warm or cool rim light on one side.



Paper-doll layering so one animation set serves all four: base body (black head, gloves) + outfit layer
(palette-swappable) + headgear layer (headphones, goggles, visor, glasses) + board. Per-character ears are part of the
head variant.
5.2 The four skaters (names are placeholders)
Skater
Visual spec (from REF-CHAR)
Stats (1-5, total
12)
Role / special
RIFF
(panel
top-left)
Wide spiky ears. Red over-ear headphones with a cord.
White half-moon eyes. Oversized beige tee, wide-leg blue
jeans, black-red gloves. Idle prop: red handheld game
console.
Speed 3
Air 3
Balance 3
Flip 3
All-rounder, best for new players.
Special: Pixel Storm (fast flip
chain).
PRISM
(top-right)
Tall rounded ears with tan inner. Rainbow-gradient visor
goggles over a silver headphone cup. Black/purple zip
tracksuit with rainbow piping. White sneakers. Idle prop: red
handheld.
Speed 3
Air 4
Balance 2
Flip 3
High-air stylist, rewards big
rotations. Special: Spectrum Spin
(rainbow-trail 720).
BRASS
(bottom-left)
Tall pointed ears with tan inner. Round brass/amber
goggles. Rust-brown jacket with fur collar, grey baggy pants,
brown shoes. Idle prop: small notebook.
Speed 2
Air 2
Balance 5
Flip 3
Grind and manual specialist, very
stable. Special: Long Hauler
(extended balance-free grind).
LOOP
(bottom-right
)
Pointed ears with lavender rim highlight. Teal over-ear
headphones with silver arm, round clear glasses with
closed-eye arcs (serene look). Green puffer jacket, navy
baggy pants. Idle prop: silver portable CD player with cord to
headphones.
Speed 4
Air 2
Balance 4
Flip 2
Speedster, fills the special meter
fastest. Special: Repeat Mode
(self-replaying trick echo).
Stat effects (tunable): Speed = max speed and push acceleration; Air = jump impulse and rotation speed; Balance = how
slowly the grind/manual meter drifts; Flip = flip animation speed (shorter trick duration).
5.3 Required animations (per character, 64x64 cells)
Group
Animations (approx. frames)
Ground
idle on board (4), push (6), roll/crouch (2), brake (3), turn-around (3), land (3)
Air
ollie launch (3), rise/peak/fall (3), kickflip / heelflip / shove-it board spin (6 each, board only is acceptable),
body rotation overlay for front/back flips
Grabs
indy, melon, stalefish, method, mute: 1 hold pose each + 2 transition frames
Grind / manual
50-50, 5-0, nosegrind, boardslide, tailslide (loop 2 each) + balance wobble left/right (2); manual and nose
manual (loop 2 + wobble 2)
Bail
slam (5), tumble/slide (6), get up (6)
Extras
special wind-up (4) + special trick (per character, 8 to 12), victory pose (4), menu portrait 128x128 in the
style of REF-CHAR (seated, chill)
5.4 Key colours sampled from the reference, and detail sheets
Skater
Sampled colours (approximate; shadows and rim light shift them)
RIFF
Headphones #d42b2e, Tee #e9ad76, Jeans #254362, Handheld #5c0d11
PRISM
Visor glow #203270, Ear inner #d8956e, Tracksuit #1c1228, Pants #130e20, Sneakers #a28c89, Handheld #670b16.
The visor is a rainbow gradient, the hex is only its blue rim.
BRASS
Goggle lens #ed8445, Jacket #643522, Fur collar #9c6f58, Pants #5b5a53, Shoe upper #502120, Notebook #bb9a68
LOOP
Headphones #183337, Ear rim #66536b, Jacket #182b28, Pants #213047, CD player #95847a

These values come from a single AI-generated image. Treat them as guides; the locked palette is the one produced by
tools/extract_palette.py.

Footwear is not visible for RIFF and LOOP in the reference. Default: dark sneakers with light soles (record in
DECISIONS.md).

One detail sheet per skater (ref_char_01_riff_sheet.png ... ref_char_04_loop_sheet.png) holds the panel,
three enlarged detail crops, the spec, swatches, stats and sprite notes. See Appendix B for the file list.
