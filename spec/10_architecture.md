# 10. Architecture and data schemas

nulls-skatepark/
  index.html  package.json  vite.config.ts  tsconfig.json  README.md
  PROGRESS.md  DECISIONS.md  CREDITS.md
  docs/        GAME_DESIGN.md  ASSET_SPEC.md  spec/ (this brief split by section)  qa/ (screenshots vs references)
  tasks/       one task file per milestone (section 12.1)   ESCALATION.md (only when needed)
  tools/       extract_palette.py  downscale_refs.py  make_placeholders.py  pack_atlas.*
  public/assets/  ref_scaled/  sprites/  backgrounds/  ui/  audio/
  public/      manifest.webmanifest  sw.js  (PWA for phone)
  src/
    main.ts  config.ts
    scenes/    Boot  Preload  Title  CharacterSelect  LevelSelect  Game  Hud  Pause  Results  Settings
    sim/       (pure TS, no Phaser)  SkaterSim  StateMachine  TrickSystem  ComboScore
               GrindSystem  ManualSystem  Terrain  GoalSystem  Physics
    entities/  Skater  Prop (Ramp, Rail, Ledge)  Collectible  Hazard (Train, Conveyor, Barrel)
    systems/   InputManager  TouchControls  PlatformProfile  AdaptiveQuality  CameraRig  LevelLoader
               SaveSystem  AudioManager  Particles  Palette
    data/      physics.json  tricks.json  characters.json  goals.json
               levels/alley.json  subway.json  warehouse.json
    strings/   en.json
  tests/       scoring.test.ts  combo.test.ts  trick.test.ts  goals.test.ts  save.test.ts
Principles: sim/ never imports Phaser; scenes only read sim state and render it. Level JSON describes everything about a
level, so adding a level means adding a JSON file and art. Example level schema (abridged):
{
  "id": "alley", "name": "Last Call Alley", "width": 2400, "timeLimit": 120,
  "spawn": { "x": 120 },
  "ground": [ { "x": 0, "y": 220, "type": "flat" }, { "x": 380, "y": 220, "type": "kicker", "rise": 28, "run": 64 } ],
  "props":  [ { "type": "rail", "x": 640, "y": 206, "len": 96 }, { "type": "dumpster", "x": 820, "y": 206 } ],
  "gaps":   [ { "id": "dumpster", "name": "Dumpster Gap", "from": 800, "to": 900, "points": 500 } ],
  "collectibles": [ { "type": "letter", "char": "S", "x": 700, "y": 150 } ],
  "hazards": [ { "type": "barrel", "x": 1500, "interval": 6 } ],
  "layers": [ { "key": "bg_alley_far", "scroll": 0.2 }, { "key": "bg_alley_mid", "scroll": 0.5 } ],
  "goals":  [ { "id": "score_bronze", "type": "score", "target": 15000 } ]
}
