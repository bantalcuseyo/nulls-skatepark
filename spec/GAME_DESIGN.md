# GAME DESIGN — current state

This supersedes the parts of `spec/07_gameplay.md` that the rebuild brief overrode. Where the two
disagree, this document and `DECISIONS.md` win.

## Characters

Stats are the original spec's (each row totals 12). HUD portrait, name colour, special name and
special-bar colour are all read from `src/data/characters.json` by `characterId` — nothing about a
specific skater is hardcoded in the HUD.

| Character | SPD | AIR | BAL | FLP | Special | Bar colour | Unlock |
|:--|--:|--:|--:|--:|:--|:--|--:|
| RIFF | 3 | 3 | 3 | 3 | Pixel Storm | red `#d42b2e` | 0 goals |
| PRISM | 3 | 4 | 2 | 3 | Spectrum Spin | rainbow gradient | 3 goals |
| BRASS | 2 | 2 | 5 | 3 | Long Hauler | amber `#ed8445` | 8 goals |
| LOOP | 4 | 2 | 4 | 2 | Repeat Mode | teal `#183337` | 14 goals |

## HEALTH — 100, segmented bar (top-left, red → orange → yellow → green)

| Event | Effect |
|:--|:--|
| Bail | −25 (and the combo is lost, as before) |
| Rolling hazard (trashcan / drum) | −10, at most once per 0.8 s of contact |
| Clean landing after a scored trick | +5, capped at 100 |
| HEALTH reaches 0 | run over → **BAILED OUT** screen, score kept, RETRY offered |

The bar blinks under 30. Segments drain from the green end, so damage is legible without reading
the number.

## STAMINA — 100, green bar (top-left, under HEALTH)

| Action | Cost |
|:--|:--|
| Ollie | −15 |
| Flip | −10 |
| Grab | −10 |
| Grind | −20 per second, scaled by BAL (5 BAL → 60 % drain) |
| Push | −5 per stroke, scaled by SPD (5 SPD → 40 % cheaper) |
| Rolling on the ground without pushing | +25 per second |

Under 15 the bar flashes and ollie / flip / grab are refused (the HUD says OUT OF STAMINA); rolling
and steering still work, so the player is never trapped. This is the same pattern as the balance
meter: a resource that gates the fun verbs without ending the run.

Bars animate toward their real value rather than jumping. All numbers live in
`src/data/physics.json`; retune there and log the change here.

## HUD layout (Figure 1)

```
[x] portrait   NAME (cyan, 2x)                    SPECIAL: [=====      ]
               HEALTH [####------]                SPECTRUM SPIN 0
               STAMINA [##########]                     1:57
COMBO: 1250 x4                                        SKATE S K A T E
SCORE 1,250
```

* Top-left: portrait, name, HEALTH, STAMINA, then COMBO with its multiplier and the running score.
* Top-right: SPECIAL label + bar in the character's colour, the special's name and points, the timer
  (small, under the cluster), then the S-K-A-T-E tracker.
* Both clusters sit on a soft dark plate so they stay readable over lit train windows and graffiti.
* Balance meter appears bottom-left only while grinding or manualling.

## Environment

One ground line at y=208 for every level. Props stand on it; brick, tiling and shopfronts are drawn
only above it, and below it is roadway. Backgrounds tile as a plain repeat (no mirror seam). The
subway is a side-on platform: tiled graffiti wall, track bed with rails, train in the background
plane, kicker / rail / ledge on the platform.

## Scoring (unchanged)

Free Skate score 0 → 500 → 1000 from S/K pickups and the dumpster-gap ollie. Every ollie adds 4 % to
the SPECIAL meter. Distinct tricks raise the combo multiplier, repeats pay 50 %, the chain banks on
a 1.2 s link timeout.
