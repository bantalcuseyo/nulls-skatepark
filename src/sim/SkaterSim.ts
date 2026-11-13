import type { InputFrame } from './types';
import { PHYS } from './Physics';
import { ComboScore } from './ComboScore';
import { Balance } from './Balance';
import { makeActive, rotationAward, selectTrick, flipDuration, type ActiveTrick } from './TrickSystem';
import { inBailZone, railAt, surfaceAt, type TerrainData } from './Terrain';

export type SkaterState = 'ground' | 'air' | 'grind' | 'manual' | 'bail' | 'special';

export interface GapDef { id: string; name: string; from: number; to: number; points: number }
export interface CollectibleDef { type: string; char?: string; x: number; y: number; id: string }
export interface GoalResult { id: string; done: boolean; progress: number; target: number }

export interface SkaterEvents {
  onEvent?: (kind: string, data?: Record<string, unknown>) => void;
}

export interface SkaterStats { speed: number; air: number; balance: number; flip: number }

export interface CollectResult { type: string; char?: string; id: string }

/**
 * The whole skating simulation: ground/air/grind/manual/bail state machine, tricks, combo
 * scoring, balance, gaps and collectibles. Pure TypeScript — no Phaser imports.
 *
 * One instance per run. `step(dt, input)` advances exactly one 1/60 s tick.
 */
export class SkaterSim {
  x = 120;
  y = 220;
  vx = 0;
  vy = 0;
  facing = 1;
  state: SkaterState = 'ground';
  grounded = true;
  surfaceY = 220;
  surfaceSlope = 0;
  surfaceType = 'flat';
  currentSurface: import('./Terrain').FullHit | null = null;
  ridingIndex = -1;
  angle = 0;              // visual body rotation (deg), for flips
  rotationAccum = 0;
  spinning = false;
  /** Set when a rotation key was already held as we left the ground, so the held key does not
   *  auto-spin us into a bail. Cleared on release or a fresh press. */
  rotHoldLock = false;
  /** Direction key state as of the last tick, used to decide if a pop should lock rotation. */
  lastDirHeld = false;
  bodyLean = 0;

  combo = new ComboScore();
  balance = new Balance();
  trick: ActiveTrick | null = null;
  anim = 'idle';
  animTime = 0;

  score = 0;
  bestCombo = 0;
  specialMeter = 0;
  specialActive = false;
  specialTime = 0;
  linkTimer = 0;
  coyote = 0;
  ollieHold = 0;
  ollieCharging = false;
  airTime = 0;
  bailTimer = 0;
  lastSafeX = 120;
  lastSafeY = 220;
  justLanded = 0;         // frames since landing (for landing FX)
  landedClean = true;
  grindRailId = '';
  grindTime = 0;
  grindTick = 0;
  manualTime = 0;
  manualTick = 0;
  jumpBuffer = 0;
  trickBuffer: { action: 'flip' | 'grab' | 'grind' | 'special'; frames: number; dirX: number; dirY: number } | null = null;

  gapsHit = new Set<string>();
  collected = new Set<string>();
  letters = new Set<string>();
  secrets = new Set<string>();
  sprayCans = 0;
  railGrinds = new Set<string>();
  runTime = 0;
  bails = 0;
  tricksLanded = 0;
  gapInFlight: GapDef | null = null;

  constructor(
    public terrain: TerrainData,
    public gaps: GapDef[],
    public collectibles: CollectibleDef[],
    public stats: SkaterStats,
    public characterId: string,
    public assist: boolean,
    private events: SkaterEvents = {},
  ) {
    this.reset();
  }

  reset(spawnX = 120): void {
    const g = surfaceAt(this.terrain, spawnX, 400, false);
    this.x = spawnX;
    this.y = g.y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'ground';
    this.grounded = true;
    this.combo.reset();
    this.score = 0;
    this.specialMeter = 0;
    this.anim = 'idle';
    this.lastSafeX = spawnX;
    this.lastSafeY = g.y;
    this.runTime = 0;
    this.gapsHit.clear();
    this.collected.clear();
    this.letters.clear();
    this.secrets.clear();
    this.railGrinds.clear();
    this.sprayCans = 0;
    this.bails = 0;
    this.tricksLanded = 0;
  }

  private emit(kind: string, data?: Record<string, unknown>): void {
    this.events.onEvent?.(kind, data);
  }

  get maxSpeed(): number {
    return PHYS.maxSpeed * (0.9 + ((this.stats.speed - 1) / 4) * 0.25);
  }

  get ollieImpulse(): number {
    const f = 0.92 + ((this.stats.air - 1) / 4) * 0.2;
    return PHYS.ollieImpulseTap * f;
  }

  get rotationRate(): number {
    return PHYS.airRotation * (0.9 + ((this.stats.air - 1) / 4) * 0.2);
  }

  /** Current HUD-facing combo display: names + total + multiplier. */
  get comboLabel(): string {
    if (!this.combo.active) return '';
    return this.combo.entries.map((e) => e.name).join(' + ');
  }

  step(dt: number, input: InputFrame): void {
    this.runTime += dt;
    if (this.justLanded > 0) this.justLanded--;
    if (this.state === 'bail') {
      this.bailTimer -= dt;
      if (this.bailTimer <= 0) this.respawn();
      this.anim = this.bailTimer > PHYS.bailTime * 0.45 ? 'bail_slam' : 'getup';
      this.animTime += dt;
      return;
    }
    this.lastDirHeld = input.held.pushForward || input.held.brakeBack;
    this.captureBuffers(input);
    this.collectPickups();

    switch (this.state) {
      case 'ground': this.stepGround(dt, input); break;
      case 'air': this.stepAir(dt, input); break;
      case 'grind': this.stepGrind(dt, input); break;
      case 'manual': this.stepManual(dt, input); break;
      case 'special': this.stepSpecial(dt, input); break;
    }

    this.updateComboLink(dt);
    this.clampWorld();
  }

  private captureBuffers(input: InputFrame): void {
    if (input.pressed.ollie) this.jumpBuffer = PHYS.jumpBufferFrames;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;
    const bufferFrames = this.assist ? PHYS.trickBufferFramesAssist : PHYS.trickBufferFrames;
    const actions: Array<'flip' | 'grab' | 'grind' | 'special'> = ['special', 'flip', 'grab', 'grind'];
    for (const a of actions) {
      if (input.pressed[a]) {
        this.trickBuffer = { action: a, frames: bufferFrames, dirX: input.dirX, dirY: input.dirY };
        break;
      }
    }
    if (this.trickBuffer && --this.trickBuffer.frames <= 0) this.trickBuffer = null;
  }

  // ------------------------------------------------------------------ ground
  private stepGround(dt: number, input: InputFrame): void {
    const g = surfaceAt(this.terrain, this.x, this.y, false, this.ridingIndex);
    this.currentSurface = g;
    this.ridingIndex = g.index;
    this.surfaceY = g.y;
    this.surfaceSlope = g.slope;
    this.y = g.y;
    this.grounded = true;
    this.coyote = PHYS.coyoteFrames;
    this.lastSafeX = this.x;
    this.lastSafeY = g.y;

    const held = input.held;
    const forward = held.pushForward;
    const back = held.brakeBack;
    const dir = this.facing;
    if (forward) {
      this.vx += dir * PHYS.pushAccel * (0.9 + ((this.stats.speed - 1) / 4) * 0.25) * dt;
      this.anim = 'push';
    } else if (back) {
      if (Math.abs(this.vx) > PHYS.turnSpeed) {
        this.vx -= dir * PHYS.brakeDecel * dt;
        this.anim = 'brake';
      } else {
        this.facing = -this.facing as -1 | 1;
        this.vx = 0;
        this.anim = 'turn';
      }
    } else {
      const f = PHYS.rollFriction * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
      this.anim = held.crouch ? 'roll' : Math.abs(this.vx) > 30 ? 'roll' : 'idle';
    }

    // slope gravity
    this.vx += -g.slope * 320 * dt;
    const ms = this.maxSpeed * (1 + Math.min(0.6, Math.abs(g.slope) * 0.5));
    this.vx = Math.max(-ms, Math.min(ms, this.vx));

    // body rotation on ramps follows the slope; rotationAccum mirrors it so a ramp launch
    // does not get mistaken for an unfinished spin.
    const slopeDeg = (Math.atan(g.slope) * 180) / Math.PI * this.facing;
    this.angle = slopeDeg;
    this.rotationAccum = slopeDeg;
    this.surfaceType = g.type;

    // ollie (with buffer + coyote)
    if (this.jumpBuffer > 0) {
      this.startOllieCharge();
    }
    if (this.ollieCharging) {
      this.ollieHold += dt;
      if (!input.held.ollie || this.ollieHold >= PHYS.ollieHoldTime) this.releaseOllie();
    }

    // manual entry (tap Up or Down on flat)
    if (!this.ollieCharging && Math.abs(g.slope) < 0.08 && Math.abs(this.vx) > 25) {
      if (input.pressed.manualUp || (input.pressed.crouch && input.dirY < 0)) {
        this.enterManual(input.dirY < 0 ? 'nosemanual' : 'manual');
        return;
      }
    }

    this.tryBufferedTrick();

    // launch off a lip: only when we are near the TOP of a steep ramp. A convex break
    // (slope becomes less negative) right after the steepest section lets go of the ground.
    const next = surfaceAt(this.terrain, this.x + this.vx * dt * 2, this.y, false, this.ridingIndex);
    const steep = g.slope < -1.0;
    const lipAhead = next.slope > g.slope + 0.35 || g.type !== next.type;
    const ridingUp = this.vx * this.facing > 40;
    if (g.type === 'quarter' && steep && lipAhead && ridingUp) {
      const slopeAngle = Math.atan(Math.abs(g.slope));
      const speed = Math.abs(this.vx) / Math.max(0.3, Math.cos(slopeAngle));
      this.vy = -Math.sin(slopeAngle) * speed * 0.55 - 60;
      this.vx = Math.cos(slopeAngle) * Math.min(speed, this.maxSpeed * 1.2) * this.facing;
      this.state = 'air';
      this.grounded = false;
      this.airTime = 0;
      this.angle = -slopeAngle * (180 / Math.PI) * this.facing;
      this.rotationAccum = -slopeAngle * (180 / Math.PI);
      this.rotHoldLock = true;
      this.emit('launch', { x: this.x, vy: this.vy });
    } else if (g.type === 'kicker' && next.y > g.y + 2 && ridingUp) {
      // kicker lip: ramp ends and the surface drops away
      const slopeAngle = Math.atan(Math.abs(g.slope));
      const speed = Math.abs(this.vx);
      this.vy = -Math.sin(slopeAngle) * speed - 40;
      this.state = 'air';
      this.grounded = false;
      this.airTime = 0;
      this.angle = -slopeAngle * (180 / Math.PI) * this.facing;
      this.rotationAccum = -slopeAngle * (180 / Math.PI);
      this.rotHoldLock = true;
      this.emit('launch', { x: this.x, vy: this.vy });
    }

    this.x += this.vx * dt;
    this.animTime += dt;
  }

  private startOllieCharge(): void {
    if (this.ollieCharging) return;
    this.ollieCharging = true;
    this.ollieHold = 0;
    this.jumpBuffer = 0;
    this.anim = 'roll';
  }

  private releaseOllie(): void {
    // A direction held through the pop is locomotion (you were accelerating), not a spin
    // request. Without this, holding "push" on a d-pad makes every ollie auto-frontflip.
    if (this.lastDirHeld) this.rotHoldLock = true;
    const t = Math.min(1, this.ollieHold / PHYS.ollieHoldTime);
    const imp = this.ollieImpulse + (PHYS.ollieImpulseMax - PHYS.ollieImpulseTap) * t * (0.9 + ((this.stats.air - 1) / 4) * 0.2);
    this.vy = -imp;
    this.vx += this.facing * 6;
    this.state = 'air';
    this.grounded = false;
    this.airTime = 0;
    this.ridingIndex = -1;
    this.ollieCharging = false;
    this.coyote = 0;
    this.anim = 'ollie';
    this.animTime = 0;
    this.emit('ollie', { impulse: imp, x: this.x });
  }

  // ------------------------------------------------------------------ air
  private stepAir(dt: number, input: InputFrame): void {
    this.airTime += dt;
    this.vy += PHYS.gravity * dt;
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // In the air the body angle eases back to level when not spinning, so a ramp launch
    // lands flat instead of keeping the ramp's steep angle.
    // A direction key held through a ramp launch is locomotion, not intent to spin: require a
    // release (or a fresh press) before rotation starts, otherwise every launch auto-bails.
    const dirHeld = input.held.pushForward || input.held.brakeBack;
    if (this.rotHoldLock && !dirHeld) this.rotHoldLock = false;
    if (this.rotHoldLock && (input.pressed.pushForward || input.pressed.brakeBack)) this.rotHoldLock = false;
    const rotating = dirHeld && !this.rotHoldLock;
    if (rotating) {
      this.rotationAccum += (input.held.pushForward ? 1 : -1) * this.rotationRate * dt;
      this.spinning = true;
    } else if (this.spinning) {
      // player just let go of a spin: keep the accumulated angle (it is a real trick)
      this.spinning = Math.abs(this.rotationAccum) >= 180;
    } else {
      // no spin committed: straighten fast so the landing is level
      const target = 0;
      const d = target - this.rotationAccum;
      this.rotationAccum += d * Math.min(1, 9 * dt);
    }
    this.angle = this.rotationAccum * this.facing;

    // tricks from buffer
    this.tryBufferedTrick();

    // active flip duration
    if (this.trick && this.trick.duration > 0) {
      this.trick.elapsed += dt;
      this.anim = this.trick.anim;
      if (this.trick.elapsed >= this.trick.duration) {
        this.commitTrick(this.trick, 1);
        this.trick = null;
      }
    } else if (this.trick && this.trick.category === 'grab') {
      this.trick.elapsed += dt;
      this.anim = this.trick.anim;
      if (!input.held.grab) {
        const hold = this.trick.elapsed;
        this.commitTrick(this.trick, 1 + hold * this.trick.holdBonus / Math.max(1, this.trick.basePoints));
        this.trick = null;
      }
    } else if (!this.trick) {
      this.anim = 'air';
    }

    // grab start
    if (!this.trick) {
      const grabInput = this.trickBuffer?.action === 'grab';
      if (grabInput) {
        const def = selectTrick('grab', this.trickBuffer!.dirX, this.trickBuffer!.dirY);
        if (def) {
          this.trick = makeActive(def, 'grab');
          this.trickBuffer = null;
          this.emit('trick_start', { id: def.id });
        }
      }
    }

    // grind snap
    this.tryGrindSnap(input, nx, ny);

    if (this.state === 'grind') {
      this.x = nx;
      return;
    }

    // continuous collision: sample ground along the movement
    const steps = Math.max(1, Math.ceil(Math.abs(this.vy * dt) / 6));
    let landed = false;
    for (let i = 1; i <= steps; i++) {
      const px = this.x + (nx - this.x) * (i / steps);
      const py = this.y + (ny - this.y) * (i / steps);
      const g = surfaceAt(this.terrain, px, this.y + 1, true);
      if (py >= g.y && this.y <= g.y + 2 && this.vy > 0) {
        this.x = px;
        this.y = g.y;
        this.land(g.slope, g.type);
        landed = true;
        break;
      }
    }
    if (!landed) {
      this.x = nx;
      this.y = ny;
      if (inBailZone(this.terrain.bailZones, this.x, this.y)) this.bail('zone');
    }
    this.animTime += dt;
  }

  private tryBufferedTrick(): void {
    if (!this.trickBuffer) return;
    const b = this.trickBuffer;
    if (b.action === 'flip' && this.state === 'air' && !this.trick) {
      const def = selectTrick('flip', b.dirX, b.dirY);
      if (def) {
        this.trick = makeActive(def, 'flip');
        this.trick.duration = flipDuration(def.duration, this.stats.flip);
        this.anim = def.anim;
        this.animTime = 0;
        this.trickBuffer = null;
        this.emit('trick_start', { id: def.id });
      }
    } else if (b.action === 'special' && this.specialMeter >= PHYS.specialMeterMax && this.state !== 'special') {
      this.startSpecial();
      this.trickBuffer = null;
    }
  }

  private commitTrick(t: ActiveTrick, factor: number): void {
    const pts = Math.round(t.basePoints * factor);
    this.combo.add(t.id, t.name, pts, t.category);
    this.linkTimer = PHYS.comboLinkTime;
    this.tricksLanded++;
    this.specialMeter = Math.min(PHYS.specialMeterMax, this.specialMeter + pts * PHYS.specialPointFactor * (this.characterId === 'loop' ? PHYS.loopMeterBonus : 1));
    this.emit('trick', { name: t.name, points: pts });
  }

  // ------------------------------------------------------------------ grind
  private tryGrindSnap(input: InputFrame, nx: number, ny: number): void {
    if (this.state !== 'air') return;
    const want = input.held.grind || this.trickBuffer?.action === 'grind';
    if (!want && !this.assist) return;
    const snap = this.assist ? PHYS.grindSnapDistAssist : PHYS.grindSnapDist;
    for (const r of this.terrain.rails) {
      if (nx < r.x - 4 || nx > r.x + r.len + 4) continue;
      const dy = ny - r.y;
      if (dy >= -snap && dy <= snap + 4 && this.vy >= -PHYS.grindSnapVelYMax) {
        const def = selectTrick('grind', input.dirX, input.dirY) ?? selectTrick('grind', 0, 0)!;
        this.state = 'grind';
        this.grindRailId = r.id;
        this.grindTime = 0;
        this.grindTick = 0;
        this.balance.reset();
        this.balance.assist = this.assist;
        this.y = r.y;
        this.x = Math.max(r.x, Math.min(r.x + r.len, nx));
        this.vy = 0;
        this.angle = 0;
        this.rotationAccum = 0;
        this.anim = def.anim;
        this.combo.add(def.id, def.name, 0, 'grind');
        this.linkTimer = PHYS.comboLinkTime;
        this.trickBuffer = null;
        this.trick = null;
        this.railGrinds.add(r.id);
        this.emit('grind_start', { id: def.id, rail: r.id });
        return;
      }
    }
  }

  private stepGrind(dt: number, input: InputFrame): void {
    this.grindTime += dt;
    this.x += this.vx * dt;
    const nudge = (input.held.brakeBack ? -1 : 0) + (input.held.pushForward ? 1 : 0);
    // Long Hauler special: Brass freezes the meter while his special is running.
    if (!(this.specialActive && this.characterId === 'brass')) {
      this.balance.step(dt, nudge, this.stats.balance, this.assist);
    }
    this.grindTick += dt;
    if (this.grindTick >= PHYS.grindTickInterval) {
      this.grindTick -= PHYS.grindTickInterval;
      if (this.balance.inGreen) {
        const pts = Math.round(PHYS.grindTickPoints * (1 + Math.floor(this.grindTime)));
        const last = this.combo.entries[this.combo.entries.length - 1];
        if (last && last.category === 'grind') last.points += pts;
        this.specialMeter = Math.min(PHYS.specialMeterMax, this.specialMeter + pts * 0.02);
        this.emit('grind_tick', { points: pts });
      }
    }
    this.anim = Math.abs(this.balance.value) > 0.55 ? (this.balance.value < 0 ? 'grind_wobble_l' : 'grind_wobble_r') : 'grind';

    const rail = railAt(this.terrain.rails, this.x);
    const off = !rail || rail.id !== this.grindRailId || (rail && (this.x < rail.x - 2 || this.x > rail.x + rail.len + 2));
    if (off) {
      this.exitGrind(true);
    } else if (this.balance.failed) {
      this.bail('balance');
    } else if (this.jumpBuffer > 0 || input.pressed.ollie) {
      this.exitGrind(false);
      this.vy = -this.ollieImpulse - PHYS.railEndLaunchBonus;
      this.state = 'air';
      this.grounded = false;
      this.airTime = 0;
      this.jumpBuffer = 0;
      this.anim = 'ollie';
      this.emit('ollie', { impulse: -this.vy });
    }
    this.animTime += dt;
  }

  private exitGrind(natural: boolean): void {
    this.linkTimer = PHYS.comboLinkTime;
    this.emit('grind_end', { natural });
    if (natural) {
      this.state = 'air';
      this.grounded = false;
      this.vy = -30;
      this.airTime = 0;
    }
    this.grindRailId = '';
  }

  // ------------------------------------------------------------------ manual
  private enterManual(kind: 'manual' | 'nosemanual'): void {
    this.state = 'manual';
    this.manualTime = 0;
    this.manualTick = 0;
    this.balance.reset();
    this.balance.assist = this.assist;
    this.anim = kind;
    const def = selectTrick('manual', 0, kind === 'manual' ? 1 : -1)!;
    this.combo.add(def.id, def.name, 0, 'manual');
    this.linkTimer = PHYS.comboLinkTime;
    this.emit('manual_start', { id: def.id });
  }

  private stepManual(dt: number, input: InputFrame): void {
    this.manualTime += dt;
    const nudge = (input.held.brakeBack ? -1 : 0) + (input.held.pushForward ? 1 : 0);
    this.balance.step(dt, nudge, this.stats.balance, this.assist);
    this.manualTick += dt;
    if (this.manualTick >= PHYS.grindTickInterval) {
      this.manualTick -= PHYS.grindTickInterval;
      if (this.balance.inGreen) {
        const last = this.combo.entries[this.combo.entries.length - 1];
        if (last && last.category === 'manual') last.points += PHYS.manualTickPoints;
      }
    }
    const f = PHYS.rollFriction * 0.6 * dt;
    this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    this.x += this.vx * dt;
    const g = surfaceAt(this.terrain, this.x, this.y, false);
    this.y = g.y;
    if (this.balance.failed) { this.bail('balance'); return; }
    if (this.jumpBuffer > 0 || input.pressed.ollie) {
      this.state = 'ground';
      this.linkTimer = PHYS.comboLinkTime;
      this.startOllieCharge();
      this.releaseOllie();
      return;
    }
    if (Math.abs(this.vx) < 12 || Math.abs(g.slope) > 0.2) {
      this.state = 'ground';
      this.linkTimer = PHYS.comboLinkTime;
      this.emit('manual_end');
    }
    this.animTime += dt;
  }

  // ------------------------------------------------------------------ special
  private startSpecial(): void {
    this.state = 'special';
    this.specialTime = 0;
    this.specialActive = true;
    this.specialMeter = 0;
    this.anim = 'special';
    this.animTime = 0;
    this.emit('special', { character: this.characterId });
  }

  private stepSpecial(dt: number, input: InputFrame): void {
    this.specialTime += dt;
    if (this.state === 'special' && !this.grounded) {
      this.vy += PHYS.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const g = surfaceAt(this.terrain, this.x, this.y - 1, true);
      if (this.y >= g.y && this.vy > 0) { this.y = g.y; this.grounded = true; }
    } else {
      this.x += this.vx * dt;
      const g = surfaceAt(this.terrain, this.x, this.y, false);
      this.y = g.y;
    }
    if (this.specialTime >= 1.2) {
      this.specialActive = false;
      const names: Record<string, string> = {
        riff: 'PIXEL STORM', prism: 'SPECTRUM SPIN', brass: 'LONG HAULER', loop: 'REPEAT MODE',
      };
      this.combo.add('special_' + this.characterId, names[this.characterId] ?? 'SPECIAL', 1500, 'special');
      this.linkTimer = PHYS.comboLinkTime;
      this.emit('special_done');
      this.state = this.grounded ? 'ground' : 'air';
      this.specialTime = 0;
      this.tricksLanded++;
    }
    // Loop's Repeat Mode echoes the last flip once the special ends.
    if (this.characterId === 'loop' && this.specialTime > 1.1 && this.specialTime - dt <= 1.1) {
      const last = [...this.combo.entries].reverse().find((e) => e.category === 'flip');
      if (last) this.combo.add(last.id + '_echo', last.name + ' ECHO', last.points, 'flip');
    }
    void input;
  }

  // ------------------------------------------------------------------ landing / bail
  private land(slope: number, _type: string): void {
    const surfaceAngle = (Math.atan(slope) * 180) / Math.PI;
    // Shortest angular distance between the body angle and the surface, 0 = aligned.
    const raw = this.angle * this.facing - surfaceAngle;
    const diff = Math.abs(((raw % 360) + 540) % 360 - 180);
    const airAngle = Math.abs(this.rotationAccum);

    // unfinished flip check
    let sketchy = false;
    let bailNow = false;
    if (this.trick && this.trick.duration > 0 && this.trick.elapsed < this.trick.duration) {
      const remain = 1 - this.trick.elapsed / this.trick.duration;
      if (remain > 0.35) bailNow = true;
      else sketchy = true;
      this.trick = null;
    }
    // rotation award / penalty — only counts when the player actively spun
    const rot = this.spinning || Math.abs(this.rotationAccum) >= 300 ? rotationAward(this.rotationAccum) : null;
    if (rot && !bailNow) {
      this.combo.add(rot.name, rot.name, rot.points, 'rotation');
      this.specialMeter = Math.min(PHYS.specialMeterMax, this.specialMeter + rot.points * 0.06);
    }
    if (diff > PHYS.landingSketchyDeg || (this.spinning && airAngle > 200 && diff > PHYS.landingCleanDeg)) bailNow = true;
    else if (diff > PHYS.landingCleanDeg) sketchy = true;

    if (bailNow) { this.bail('angle'); return; }

    this.state = 'ground';
    this.grounded = true;
    this.angle = surfaceAngle;
    this.rotationAccum = 0;
    this.spinning = false;
    this.rotHoldLock = false;
    this.vy = 0;
    this.justLanded = 6;
    this.landedClean = !sketchy;
    if (sketchy) {
      this.vx *= 1 - PHYS.sketchySpeedLoss;
      if (this.combo.active) {
        const last = this.combo.entries[this.combo.entries.length - 1];
        if (last) last.points = Math.round(last.points * PHYS.sketchyPointFactor);
      }
      this.emit('land_sketchy');
    } else {
      this.vx += this.facing * PHYS.landingSpeedBonus;
      this.specialMeter = Math.min(PHYS.specialMeterMax, this.specialMeter + 4);
      this.emit('land_clean', { airTime: this.airTime });
    }
    this.anim = 'land';
    this.animTime = 0;
    if (this.combo.active) this.linkTimer = PHYS.comboLinkTime;
    this.checkGap();
  }

  bail(reason: string): void {
    if (this.state === 'bail') return;
    this.state = 'bail';
    this.ridingIndex = -1;
    this.bailTimer = PHYS.bailTime;
    this.combo.reset();
    this.specialMeter = 0;
    this.specialActive = false;
    this.trick = null;
    this.trickBuffer = null;
    this.ollieCharging = false;
    this.vx = 0;
    this.vy = 0;
    this.rotationAccum = 0;
    this.angle = 0;
    this.bails++;
    this.anim = 'bail_slam';
    this.animTime = 0;
    this.emit('bail', { reason });
  }

  private respawn(): void {
    this.x = this.lastSafeX;
    this.ridingIndex = -1;
    const g = surfaceAt(this.terrain, this.x, 400, false);
    this.y = g.y;
    this.vx = this.facing * PHYS.respawnSpeed;
    this.state = 'ground';
    this.grounded = true;
    this.anim = 'roll';
    this.emit('respawn');
  }

  // ------------------------------------------------------------------ combo / pickups / gaps
  private updateComboLink(dt: number): void {
    if (!this.combo.active) return;
    const linking = this.state === 'grind' || this.state === 'manual' || this.state === 'air' || this.state === 'special' || !!this.trick;
    if (linking) {
      this.linkTimer = PHYS.comboLinkTime;
      return;
    }
    this.linkTimer -= dt;
    if (this.linkTimer <= 0) this.bankCombo();
  }

  bankCombo(): number {
    const total = this.combo.bank();
    if (total > 0) {
      this.score += total;
      this.bestCombo = Math.max(this.bestCombo, total);
      this.emit('bank', { total });
    }
    this.linkTimer = 0;
    return total;
  }

  private collectPickups(): void {
    for (const c of this.collectibles) {
      if (this.collected.has(c.id)) continue;
      const dx = Math.abs(this.x - c.x);
      const dy = Math.abs(this.y - c.y);
      if (dx < 18 && dy < 30) {
        this.collected.add(c.id);
        if (c.type === 'letter' && c.char) this.letters.add(c.char);
        else if (c.type === 'secret') this.secrets.add(c.id);
        else if (c.type === 'spray') this.sprayCans++;
        this.combo.add('pickup_' + c.id, c.type === 'letter' ? `LETTER ${c.char}` : c.type.toUpperCase(), 250, 'gap');
        this.linkTimer = PHYS.comboLinkTime;
        this.emit('pickup', { type: c.type, char: c.char, id: c.id });
      }
    }
  }

  private checkGap(): void {
    if (!this.gapInFlight) return;
    const g = this.gapInFlight;
    if (this.x > g.to || (this.facing < 0 && this.x < g.from)) {
      if (!this.gapsHit.has(g.id)) {
        this.gapsHit.add(g.id);
        this.combo.add('gap_' + g.id, g.name.toUpperCase(), g.points, 'gap');
        this.linkTimer = PHYS.comboLinkTime;
        this.emit('gap', { name: g.name, points: g.points });
      }
      this.gapInFlight = null;
    }
  }

  private clampWorld(): void {
    if (this.x < 8) { this.x = 8; this.vx = Math.abs(this.vx); }
    if (this.x > this.terrain.width - 8) { this.x = this.terrain.width - 8; this.vx = -Math.abs(this.vx); }
    if (this.y > 400) this.bail('void');
    // gap detection: mark when leaving the ground inside a gap span
    if (this.state === 'air') {
      for (const g of this.gaps) {
        if (!this.gapsHit.has(g.id) && this.x > g.from && this.x < g.to && !this.gapInFlight) {
          this.gapInFlight = g;
        }
      }
    }
  }

  /** Snapshot used by the HUD and tests. */
  hud(): { score: number; combo: string; multiplier: number; pending: number; meter: number; balance: number; letters: number; state: SkaterState } {
    return {
      score: this.score,
      combo: this.comboLabel,
      multiplier: this.combo.multiplier,
      pending: this.combo.snapshot().pending,
      meter: this.specialMeter / PHYS.specialMeterMax,
      balance: this.balance.value,
      letters: this.letters.size,
      state: this.state,
    };
  }
}
