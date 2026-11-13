import Phaser from 'phaser';
import { SkaterSim } from '../sim/SkaterSim';
import { FixedStep } from '../sim/FixedStep';
import { GoalSystem } from '../sim/GoalSystem';
import { InputManager } from '../systems/InputManager';
import { CameraRig } from '../systems/CameraRig';
import { loadLevel, type LevelDef } from '../systems/LevelLoader';
import { Skater } from '../entities/Skater';
import { Particles } from '../systems/Particles';
import { TouchControls } from '../systems/TouchControls';
import { AudioManager } from '../systems/AudioManager';
import { PixelText } from '../systems/PixelText';
import { detectProfile } from '../systems/PlatformProfile';
import { AdaptiveQuality } from '../systems/AdaptiveQuality';
import type { SaveSystem } from '../systems/SaveSystem';
import charactersData from '../data/characters.json';
import alleyData from '../data/levels/alley.json';
import subwayData from '../data/levels/subway.json';
import warehouseData from '../data/levels/warehouse.json';
import type { GroundPoint, SurfaceSeg } from '../sim/Terrain';
import { surfaceAt } from '../sim/Terrain';

export const LEVELS: Record<string, LevelDef> = {
  alley: alleyData as unknown as LevelDef,
  subway: subwayData as unknown as LevelDef,
  warehouse: warehouseData as unknown as LevelDef,
};
export const LEVEL_ORDER = ['alley', 'subway', 'warehouse'];

export interface GameOptions {
  levelId: string;
  characterId: string;
  freeSkate: boolean;
}

export class Game extends Phaser.Scene {
  sim!: SkaterSim;
  private stepper = new FixedStep();
  private inputMgr!: InputManager;
  private rig!: CameraRig;
  private skater!: Skater;
  private fx!: Particles;
  private goals!: GoalSystem;
  private level!: LevelDef;
  private opts!: GameOptions;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private layerScroll: number[] = [];
  private groundGfx!: Phaser.GameObjects.Graphics;
  private propSprites: Phaser.GameObjects.Image[] = [];
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private audio!: AudioManager;
  private touch: TouchControls | null = null;
  private debugText!: PixelText;
  private debugOn = false;
  private paused = false;
  private timeLeft = 120;
  private lastGrounded = true;
  private hazardImgs: Phaser.GameObjects.Image[] = [];
  private hazardT = 0;
  private conveyor: { x: number; len: number; speed: number } | null = null;
  private hud!: import('../scenes/Hud').Hud;
  private finished = false;
  private hitStop = 0;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private endTime = 0;
  private quality!: AdaptiveQuality;
  private crtGfx!: Phaser.GameObjects.Graphics;
  private crtEnabled = false;
  private reduceFlash = false;
  private shakeScale = 1;
  private save!: SaveSystem;

  constructor() {
    super('Game');
  }

  init(data: GameOptions): void {
    this.opts = data ?? { levelId: 'alley', characterId: 'riff', freeSkate: false };
  }

  preload(): void {
    // assets are loaded once by Preload scene; this scene only uses them
  }

  create(): void {
    this.finished = false;
    this.paused = false;
    this.hitStop = 0;
    this.timeLeft = this.level?.timeLimit ?? 120;
    this.level = LEVELS[this.opts.levelId] ?? LEVELS.alley;
    this.timeLeft = this.level.timeLimit;
    const charDef = charactersData.find((c) => c.id === this.opts.characterId) ?? charactersData[0];
    const { terrain } = loadLevel(this.level);
    const profile = detectProfile();
    const assist = profile.profile === 'phone';

    this.audio = (this.game as unknown as { audio: AudioManager }).audio;
    this.inputMgr = (this.game as unknown as { inputMgr: InputManager }).inputMgr;

    this.sim = new SkaterSim(terrain, this.level.gaps, this.level.collectibles, charDef.stats, charDef.id, assist, {
      onEvent: (k, d) => this.onSimEvent(k, d ?? {}),
    });
    this.sim.x = this.level.spawn.x;
    this.sim.lastSafeX = this.level.spawn.x;
    this.sim.y = surfaceAt(terrain, this.sim.x, 400, false).y;
    this.goals = new GoalSystem(this.level.goals, this.sim);

    // --- parallax layers
    this.layers = [];
    this.layerScroll = [];
    for (const l of this.level.layers) {
      const t = this.add.tileSprite(0, 0, this.scale.width, 270, l.key).setOrigin(0, 0).setScrollFactor(0).setDepth(-10 + this.layerScroll.length);
      this.layers.push(t);
      this.layerScroll.push(l.scroll);
    }

    // --- ground polygon + props (ground behind props so ramps read correctly)
    this.groundGfx = this.add.graphics().setDepth(1);
    this.drawGround(terrain.ground, terrain.surfaces);
    this.drawProps();
    this.drawPickups();
    this.drawHazards();

    // --- skater
    const atlas = this.cache.json.get(`skater_${charDef.id}_atlas`) as { cell: number; anims: Record<string, { row: number; frames: number; fps: number; loop: boolean }> };
    this.skater = new Skater(this, charDef.id, atlas);
    this.fx = new Particles(this);

    this.rig = new CameraRig(this, this.level.width);
    this.rig.snap(this.sim.x);
    this.save = (this.game as unknown as { save: SaveSystem }).save;
    const st = this.save.data.settings;
    this.reduceFlash = st.reduceFlash;
    this.shakeScale = Math.max(0, Math.min(1, st.shake));
    this.rig.reduceShake = st.shake <= 0;
    this.crtEnabled = st.crt;
    this.fx.quality = 1;
    this.quality = new AdaptiveQuality(this, profile.profile === 'phone', (q) => {
      this.fx.quality = q;
      if (q <= 0.6) this.crtEnabled = false;
      if (q <= 0.4) this.fx.clear();
    });

    this.flashRect = this.add.rectangle(0, 0, this.scale.width, 270, 0xffffff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(50);
    // CRT scanlines: one dark line every other row, built once (cheap static overlay)
    this.crtGfx = this.add.graphics().setScrollFactor(0).setDepth(49).setVisible(this.crtEnabled);
    if (this.crtEnabled) this.drawCrt();

    // touch overlay
    if (profile.touch && this.touch === null) {
      this.touch = new TouchControls(this.inputMgr, {
        leftHanded: false, opacity: 0.55, size: 1, haptics: true,
      }, () => this.togglePause());
    }

    this.debugText = new PixelText(this, 6, 250, '', 1).setVisible(false);

    // HUD scene on top
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud', { game: this });
    this.hud = this.scene.get('Hud') as import('../scenes/Hud').Hud;

    this.input.keyboard?.on('keydown-F1', () => { this.debugOn = !this.debugOn; this.debugText.setVisible(this.debugOn); });
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.input.keyboard?.on('keydown-R', () => this.restart());

    this.audio.startMusic(this.level.music);
    this.stepper.reset();
    (window as unknown as { __sim: SkaterSim }).__sim = this.sim;
    (window as unknown as { __game: Game }).__game = this;
  }

  /**
   * Ground rendering. The level backgrounds are now the owner's reference artwork (brief section
   * 6 allows exactly this), so a deep filled ground polygon would paint over the art. Draw only a
   * thin floor band under the play surface plus the deck line the skater rides.
   */
  private drawGround(ground: GroundPoint[], surfaces: SurfaceSeg[]): void {
    const g = this.groundGfx;
    g.clear();

    // Base floor: a shallow band (12 px) instead of a full screen fill.
    g.lineStyle(13, 0x141a2e, 0.92);
    g.beginPath();
    g.moveTo(ground[0].x, ground[0].y + 5);
    for (const p of ground) g.lineTo(p.x, p.y + 5);
    g.strokePath();
    // rideable edge, one bright line so the surface is unmistakable
    g.lineStyle(2, 0xadb18c, 1);
    g.beginPath();
    g.moveTo(ground[0].x, ground[0].y);
    for (const p of ground) g.lineTo(p.x, p.y);
    g.strokePath();

    // Ramps / platforms: a transparent body with a bright deck edge, so the reference art behind
    // them still reads.
    for (const s2 of surfaces) {
      const pts = s2.points;
      g.fillStyle(s2.oneWay ? 0x1b2238 : 0x5a3a24, 0.55);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i].x, pts[i].y + 8);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, s2.oneWay ? 0xc8f0a0 : 0xe8a93a, 1);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.strokePath();
    }
  }

  private drawProps(): void {
    for (const p of this.level.props) {
      let key = '';
      let dy = 0;
      switch (p.type) {
        case 'rail': case 'flatrail': key = 'rail'; break;
        case 'dumpster': key = 'dumpster'; break;
        case 'bench': key = 'bench'; break;
        case 'funbox': key = 'funbox'; break;
        case 'barrier': key = 'barrier'; break;
        case 'manualpad': key = 'manualpad'; dy = -8; break;
        default: break;
      }
      if (!key) continue;
      const img = this.add.image(p.x, p.y + dy, key).setOrigin(0, 1).setDepth(4);
      if (p.len && (p.type === 'rail' || p.type === 'flatrail')) img.setDisplaySize(p.len, 24);
      this.propSprites.push(img);
      if (p.type === 'rail' || p.type === 'flatrail') img.y = p.y;
    }
  }

  private drawPickups(): void {
    for (const c of this.level.collectibles) {
      let key = '';
      if (c.type === 'letter') key = `letter_${c.char}`;
      else if (c.type === 'spray') key = 'spray';
      else if (c.type === 'secret') key = this.level.id === 'alley' ? 'token_arcade' : this.level.id === 'subway' ? 'token_metro' : 'wrench';
      if (!key) continue;
      const img = this.add.image(c.x, c.y, key).setDepth(6);
      this.pickupSprites.set(c.id, img);
      this.tweens.add({ targets: img, y: c.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }

  private drawHazards(): void {
    for (const h of this.level.hazards) {
      if (h.type === 'trashcan' || h.type === 'drum') {
        const img = this.add.image(h.x ?? 0, 206, h.type === 'trashcan' ? 'trashcan' : 'drum').setOrigin(0.5, 1).setDepth(8);
        img.setData('baseX', h.x ?? 0);
        img.setData('range', h.range ?? 80);
        this.hazardImgs.push(img);
      } else if (h.type === 'conveyor') {
        this.conveyor = { x: h.x ?? 0, len: h.len ?? 100, speed: h.speed ?? 60 };
        const img = this.add.tileSprite(h.x ?? 0, 214, h.len ?? 100, 6, 'rail').setOrigin(0, 0).setDepth(5);
        this.hazardImgs.push(img as unknown as Phaser.GameObjects.Image);
      }
    }
  }

  private onSimEvent(kind: string, d: Record<string, unknown>): void {
    const x = this.sim.x;
    const y = this.sim.y;
    switch (kind) {
      case 'ollie':
        this.audio.play('ollie');
        this.fx.dust(x, y, 4);
        break;
      case 'push':
        this.audio.play('push');
        this.fx.dust(x, y, 2);
        break;
      case 'land_clean':
        this.audio.play('land_clean');
        this.fx.dust(x, y, 5);
        this.fx.ring(x, y);
        this.skater.squash = 0.8;
        if ((d.airTime as number) > 0.7) { this.rig.shake(0.25 * this.shakeScale); this.hitStop = 0.05; }
        break;
      case 'land_sketchy':
        this.audio.play('land_sketchy');
        this.fx.dust(x, y, 4);
        break;
      case 'grind_start':
        this.audio.play('grind_start');
        break;
      case 'grind_end':
        this.audio.play('grind_end');
        break;
      case 'manual_start':
        this.audio.play('manual');
        break;
      case 'trick_start':
        this.audio.play((d.id as string).includes('flip') || d.id === 'popshove' ? 'flip' : 'grab');
        break;
      case 'bail':
        this.audio.play('bail');
        this.rig.shake(0.7 * this.shakeScale);
        this.hitStop = 0.08;
        this.fx.dust(x, y, 10);
        this.flash(0.25);
        break;
      case 'bank':
        this.audio.play('bank');
        this.hud?.showBank(d.total as number);
        break;
      case 'pickup':
        this.audio.play(d.type === 'secret' ? 'secret' : 'letter');
        this.pickupSprites.get(d.id as string)?.setVisible(false);
        this.fx.burst(x, y - 20);
        break;
      case 'gap':
        this.audio.play('gap');
        this.hud?.showCallout((d.name as string).toUpperCase() + ' +' + d.points);
        break;
      case 'special':
        this.audio.play('special');
        this.flash(0.4);
        this.rig.shake(0.3 * this.shakeScale);
        break;
      case 'special_done':
        this.fx.burst(x, y - 30);
        break;
      case 'launch':
        this.fx.dust(x, y, 3);
        break;
      default:
        break;
    }
  }

  private drawCrt(): void {
    const g = this.crtGfx;
    g.clear();
    g.fillStyle(0x000000, 0.16);
    for (let y = 0; y < 270; y += 2) {
      g.fillRect(0, y, this.scale.width, 1);
    }
  }

  private flash(a: number): void {
    if (a <= 0) return;
    if (this.reduceFlash) a = Math.min(a, 0.08);
    this.flashRect.setAlpha(a);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 200 });
  }

  togglePause(): void {
    if (this.finished) return;
    this.paused = !this.paused;
    if (this.paused) this.scene.launch('Pause', { game: this });
    else this.scene.stop('Pause');
    this.audio.setVolume('music', this.paused ? 0.2 : 0.6);
  }

  resumeGame(): void {
    this.paused = false;
    this.touch?.setVisible(true);
    this.scene.stop('Pause');
  }

  restart(): void {
    this.touch?.setVisible(false);
    this.touch?.destroy();
    this.touch = null;
    this.scene.stop('Hud');
    this.scene.stop('Pause');
    this.scene.restart(this.opts);
  }

  quitToMenu(): void {
    this.touch?.destroy();
    this.touch = null;
    this.scene.stop('Hud');
    this.scene.stop('Pause');
    this.scene.start('Title');
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused || this.finished) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.quality.step(deltaMs);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.fx.update(dt * 0.2);
      this.hud?.updateHUD(dt);
      return;
    }

    const ticks = this.stepper.advance(dt, (fixed) => {
      const frame = this.inputMgr.sample();
      this.sim.step(fixed, frame);
      if (this.conveyor && this.sim.grounded) {
        const c = this.conveyor;
        if (this.sim.x > c.x && this.sim.x < c.x + c.len) this.sim.vx += c.speed * fixed;
      }
      if (frame.pressed.pause) this.togglePause();
    });
    void ticks;

    // timer
    if (!this.opts.freeSkate) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0 && !this.finished) {
        this.timeLeft = 0;
        this.endTime += dt;
        if (this.sim.combo.active) this.sim.bankCombo();
        this.finishRun();
      }
    }

    // hazards
    this.hazardT += dt;
    for (const img of this.hazardImgs) {
      if (img.getData('baseX') !== undefined) {
        const bx = img.getData('baseX') as number;
        const range = img.getData('range') as number;
        img.x = bx + Math.sin(this.hazardT * 0.7) * range;
        img.setAngle(Math.sin(this.hazardT * 0.7) * 8);
        if (Math.abs(this.sim.x - img.x) < 12 && this.sim.grounded && this.sim.state !== 'bail') {
          this.sim.vx *= 0.6;
          this.fx.dust(this.sim.x, this.sim.y, 3);
        }
      }
    }

    // render skater
    this.skater.update(dt, this.sim.x, this.sim.y, this.sim.facing, this.sim.angle, this.sim.anim);
    this.rig.follow(this.sim.x, this.sim.y, this.sim.vx, this.sim.facing, dt);

    // parallax
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i].tilePositionX = this.cameras.main.scrollX * this.layerScroll[i];
    }

    // fx
    this.fx.update(dt);
    if (this.sim.state === 'grind') this.fx.sparks(this.sim.x - this.sim.facing * 6, this.sim.y + 2, this.sim.facing);
    if (Math.abs(this.sim.vx) > 200 && Math.random() < 0.25) this.fx.streak(this.sim.x - this.sim.facing * 20, this.sim.y - 14 - Math.random() * 16);
    if (this.sim.grounded && !this.lastGrounded) this.fx.dust(this.sim.x, this.sim.y, 3);
    this.lastGrounded = this.sim.grounded;

    // audio roll
    this.audio.setRoll(this.sim.grounded && Math.abs(this.sim.vx) > 15, Math.min(1, Math.abs(this.sim.vx) / 260), this.sim.state === 'grind');
    this.touch?.setSpecialVisible(this.sim.specialMeter >= 100);

    // goals
    const goalStates = this.goals.update();
    for (const g of goalStates) {
      if (g.done && !this.goalToastShown?.has(g.id)) {
        (this.goalToastShown ??= new Set()).add(g.id);
        this.hud?.showGoal(g.label);
        this.audio.play('goal');
      }
    }

    this.hud?.updateHUD(dt);
    if (this.debugOn) {
      this.debugText.setText(`${Math.round(this.game.loop.actualFps)}FPS ${this.sim.state} V${Math.round(this.sim.vx)} A${Math.round(this.sim.angle)} B${this.sim.balance.value.toFixed(2)} C${this.sim.linkTimer.toFixed(1)}`);
    }
  }

  private goalToastShown: Set<string> | null = null;

  private finishRun(): void {
    this.finished = true;
    this.audio.play('bank');
    this.time.delayedCall(700, () => {
      this.touch?.setVisible(false);   // menus own the screen from here
      this.scene.launch('Results', { game: this, goals: this.goals.update() });
      this.scene.pause();
    });
  }

  get runTimeLeft(): number { return this.timeLeft; }
  get isFreeSkate(): boolean { return this.opts.freeSkate; }
  get currentLevel(): LevelDef { return this.level; }
  get characterId(): string { return this.opts.characterId; }
}
