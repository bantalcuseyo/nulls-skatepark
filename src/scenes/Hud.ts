import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import { UI } from '../systems/Theme';
import type { Game } from './Game';

/**
 * In-game HUD, rebuilt to the brief's Figure 1.
 *
 * Layout (480x270 virtual, 6 px safe margin):
 *   top-left     portrait | NAME, HEALTH, STAMINA   and under it COMBO: n xM
 *   top-right    SPECIAL: bar, then the special's name + points, then the timer, then S-K-A-T-E
 *   bottom-left  balance arc (only while grinding / manualling)
 *
 * Every per-character value (portrait, name colour, special colour, special name) is read from
 * src/data/characters.json by characterId. Nothing about a specific skater is written here.
 */
export class Hud extends Phaser.Scene {
  private g!: Game;
  private frame!: Phaser.GameObjects.Graphics;
  private meters!: Phaser.GameObjects.Graphics;

  private portrait?: Phaser.GameObjects.Image;
  private comboValue!: PixelText;
  private comboMult!: PixelText;
  private scoreLine!: PixelText;
  private specialLabel!: PixelText;
  private specialName!: PixelText;
  private timer!: PixelText;
  private letters!: PixelText;
  private toast!: PixelText;
  private callout!: PixelText;
  private bankText!: PixelText;
  private balanceLabel!: PixelText;

  private toastT = 0;
  private calloutT = 0;
  private bankT = 0;
  private displayScore = 0;
  private healthShown = 100;
  private staminaShown = 100;

  // ---- layout constants (virtual px). One place to change, measured against the reference.
  private static readonly PAD = 6;
  private static readonly PORT = 32;
  private static readonly LEFT_X = 44;        // text column right of the portrait
  private static readonly BAR_X = 108;        // clear of the widest label ("STAMINA" = 7*8 = 56 px)
  private static readonly BAR_W = 66;
  private static readonly HEALTH_Y = 17;
  private static readonly STAMINA_Y = 26;
  private static readonly COMBO_Y = 40;
  private static readonly SPECIAL_BAR_W = 96;

  constructor() { super('Hud'); }

  init(data: { game: Game }): void { this.g = data.game; }

  create(): void {
    this.frame = this.add.graphics().setScrollFactor(0).setDepth(900);
    this.meters = this.add.graphics().setScrollFactor(0).setDepth(902);

    const char = this.g.characterDef;

    this.portrait = this.add.image(Hud.PAD, Hud.PAD, `head_${char.id}`)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(903).setDisplaySize(Hud.PORT, Hud.PORT);
    // Re-fit on resize: the virtual width flexes on phones, the portrait size must not.
    this.scale.on('resize', () => this.portrait?.setDisplaySize(Hud.PORT, Hud.PORT));

    new PixelText(this, Hud.LEFT_X, 4, char.name, UI.h2).setTint(char.hud.nameColour);
    new PixelText(this, Hud.LEFT_X, Hud.HEALTH_Y - 1, 'HEALTH', 1).setTint(UI.cream);
    new PixelText(this, Hud.LEFT_X, Hud.STAMINA_Y - 1, 'STAMINA', 1).setTint(UI.cream);
    new PixelText(this, Hud.PAD, Hud.COMBO_Y, 'COMBO:', 1).setTint(UI.amber);
    this.comboValue = new PixelText(this, Hud.PAD + 48, Hud.COMBO_Y - 5, '0', UI.h1).setTint(UI.cream);
    this.comboMult = new PixelText(this, Hud.PAD + 48, Hud.COMBO_Y + 12, '', 1).setTint(UI.amber);
    this.scoreLine = new PixelText(this, Hud.PAD, Hud.COMBO_Y + 13, '', 1).setTint(UI.grey);

    this.specialLabel = new PixelText(this, 0, 7, 'SPECIAL:', 1).setTint(UI.cream);
    this.specialName = new PixelText(this, 0, 26, '', 1).setTint(UI.cream);
    this.timer = new PixelText(this, 0, 38, '2:00', 1).setTint(UI.cream);
    this.letters = new PixelText(this, 0, 48, '', 1).setTint(UI.cyan);

    this.toast = new PixelText(this, 0, 92, '', 1).setTint(UI.green).setVisible(false);
    this.callout = new PixelText(this, 0, 80, '', 1).setTint(UI.cyan).setVisible(false);
    this.bankText = new PixelText(this, 0, 108, '', UI.h1).setTint(UI.amber).setVisible(false);
    this.balanceLabel = new PixelText(this, Hud.PAD, 238, 'BALANCE', 1).setTint(UI.grey).setVisible(false);

    this.displayScore = 0;
    this.healthShown = this.g.sim.health;
    this.staminaShown = this.g.sim.stamina;
    this.layout();
    this.scale.on('resize', () => this.layout());
  }

  /** Anchor the right-hand cluster to the current canvas width. */
  private layout(): void {
    const W = this.scale.width;
    const right = W - Hud.PAD;
    // Right-aligned items use a measured width from text length, not BitmapText.width: the cached
    // width is stale on the frame a string changes, which clipped labels against the screen edge.
    this.specialLabel.setPosition(right - Hud.SPECIAL_BAR_W - 62, 7);
    this.specialName.setPosition(right - textW(this.specialName.obj.text, 1), 26);
    this.timer.setPosition(right - textW(this.timer.obj.text, 1), 38);
    this.letters.setPosition(right - textW(this.letters.obj.text, 1), 48);
    this.drawFrames();
  }

  /** Right-align every variable-length string in the right cluster (called each frame). */
  private alignRight(): void {
    const right = this.scale.width - Hud.PAD;
    this.specialName.setPosition(right - textW(this.specialName.obj.text, 1), 26);
    this.timer.setPosition(right - textW(this.timer.obj.text, 1), 38);
    this.letters.setPosition(right - textW(this.letters.obj.text, 1), 48);
  }

  /** Portrait frame + cluster plates + bar tracks. Drawn once per layout, not per frame. */
  private drawFrames(): void {
    const W = this.scale.width;
    const g = this.frame;
    g.clear();

    // The scene is mid-value pixel art (lit train windows, graffiti), so bare HUD text and bars
    // vanish into it. Figure 1 puts the clusters in the same corners; a soft dark plate keeps them
    // readable there without turning the HUD into a solid panel.
    g.fillStyle(UI.bg, 0.62);
    g.fillRect(Hud.PAD - 3, Hud.PAD - 3, Hud.LEFT_X + 56 + Hud.BAR_W + 6, 46);
    g.lineStyle(1, UI.cyan, 0.35);
    g.strokeRect(Hud.PAD - 2.5, Hud.PAD - 2.5, Hud.LEFT_X + 56 + Hud.BAR_W + 5, 45);
    const rx = W - Hud.PAD - Hud.SPECIAL_BAR_W - 64;
    g.fillStyle(UI.bg, 0.62);
    g.fillRect(rx - 4, Hud.PAD - 3, Hud.SPECIAL_BAR_W + 68, 50);
    g.lineStyle(1, UI.cyan, 0.35);
    g.strokeRect(rx - 3.5, Hud.PAD - 2.5, Hud.SPECIAL_BAR_W + 67, 49);

    // portrait plate: 1 px cyan hairline, same language as the menus
    g.lineStyle(1, UI.cyan, 0.7);
    g.strokeRect(Hud.PAD - 1.5, Hud.PAD - 1.5, Hud.PORT + 3, Hud.PORT + 3);
    // HEALTH / STAMINA tracks
    g.fillStyle(UI.ink, 1);
    g.fillRect(Hud.BAR_X - 1, Hud.HEALTH_Y - 1, Hud.BAR_W + 2, 8);
    g.lineStyle(1, UI.dim, 1);
    g.strokeRect(Hud.BAR_X - 1.5, Hud.HEALTH_Y - 1.5, Hud.BAR_W + 3, 9);
    g.fillStyle(UI.ink, 1);
    g.fillRect(Hud.BAR_X - 1, Hud.STAMINA_Y - 1, Hud.BAR_W + 2, 5);
    g.lineStyle(1, UI.dim, 1);
    g.strokeRect(Hud.BAR_X - 1.5, Hud.STAMINA_Y - 1.5, Hud.BAR_W + 3, 6);
    // SPECIAL track, top-right
    const sx = W - Hud.PAD - Hud.SPECIAL_BAR_W;
    g.fillStyle(UI.ink, 1);
    g.fillRect(sx, 14, Hud.SPECIAL_BAR_W, 7);
    g.lineStyle(1, UI.cream, 0.85);
    g.strokeRect(sx - 0.5, 13.5, Hud.SPECIAL_BAR_W + 1, 8);
  }

  showGoal(label: string): void {
    const W = this.scale.width;
    this.toast.setText(label).setVisible(true);
    this.toast.setPosition(Math.round((W - this.toast.width) / 2), 92);
    this.toastT = 3;
  }

  showCallout(text: string): void {
    const W = this.scale.width;
    this.callout.setText(text).setVisible(true);
    this.callout.setPosition(Math.round((W - this.callout.width) / 2), 80);
    this.calloutT = 2;
  }

  showBank(total: number): void {
    const W = this.scale.width;
    this.bankText.setText(`+${total.toLocaleString('en-US')}`).setVisible(true);
    this.bankText.setPosition(Math.round((W - this.bankText.width) / 2), 104);
    this.bankT = 1.2;
  }

  /** Called when the sim refuses a trick because STAMINA is under the lockout. */
  showStaminaLocked(): void {
    this.showCallout('OUT OF STAMINA');
  }

  updateHUD(dt: number): void {
    const sim = this.g.sim;
    const char = this.g.characterDef;
    const snap = sim.hud();

    // --- score counts up so a big bank reads as an event, not a jump
    if (this.displayScore < snap.score) {
      this.displayScore = Math.min(snap.score, this.displayScore + Math.max(20, (snap.score - this.displayScore) * dt * 14));
    }
    this.scoreLine.setText(`SCORE ${Math.floor(this.displayScore).toLocaleString('en-US')}`);

    // --- COMBO: big pending number + multiplier, amber like Figure 1
    if (sim.combo.active && snap.pending > 0) {
      this.comboValue.setText(snap.pending.toLocaleString('en-US')).setVisible(true);
      this.comboMult.setText(`X${snap.multiplier}`).setVisible(true);
      // keep the multiplier clear of the number it follows
      this.comboMult.setPosition(Hud.PAD + 48 + this.comboValue.width + 4, Hud.COMBO_Y + 12);
      const hot = snap.multiplier >= 4;
      this.comboValue.setTint(hot ? UI.magenta : UI.cream);
      this.comboMult.setTint(hot ? UI.cream : UI.amber);
    } else {
      this.comboValue.setVisible(false);
      this.comboMult.setVisible(false);
    }

    // --- bars animate toward the real value instead of snapping
    this.healthShown = approach(this.healthShown, snap.health, 160 * dt);
    this.staminaShown = approach(this.staminaShown, snap.stamina, 200 * dt);
    this.drawMeters(snap.health, snap.stamina);

    // --- timer, small, under the SPECIAL cluster
    if (this.g.isFreeSkate) {
      this.timer.setText('FREE').setTint(UI.cyan);
    } else {
      const t = Math.max(0, this.g.runTimeLeft);
      this.timer.setText(`${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`);
      this.timer.setTint(t < 10 ? (Math.floor(t * 6) % 2 === 0 ? UI.magenta : UI.cream) : UI.cream);
    }

    // --- S-K-A-T-E tracker under the timer, right-aligned so it cannot collide
    const got = sim.letters;
    const lit = ['S', 'K', 'A', 'T', 'E'].filter((ch) => got.has(ch)).join(' ');
    this.letters.setText(lit.length ? `SKATE ${lit}` : '').setTint(got.size === 5 ? UI.amber : UI.cyan);

    // --- special name + points, in the character's own colour
    const pts = Math.round(snap.meter * 100);
    this.specialName
      .setText(`${char.special.toUpperCase()} ${pts}`)
      .setTint(snap.meter >= 1 ? char.hud.specialHighlight : char.hud.specialColour);
    // Re-align AFTER the strings change: measuring before setText is what clipped them.
    this.alignRight();

    // --- balance arc while grinding / manualling (bottom-left, clear of both clusters)
    if (sim.state === 'grind' || sim.state === 'manual') {
      this.balanceLabel.setVisible(true).setPosition(Hud.PAD, 238);
    } else {
      this.balanceLabel.setVisible(false);
    }

    // --- transient text
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.setVisible(false); }
    if (this.calloutT > 0) { this.calloutT -= dt; if (this.calloutT <= 0) this.callout.setVisible(false); }
    if (this.bankT > 0) {
      this.bankT -= dt;
      this.bankText.obj.y = 104 - (1.2 - this.bankT) * 14;
      this.bankText.setAlpha(Math.min(1, this.bankT * 1.5));
      if (this.bankT <= 0) this.bankText.setVisible(false);
    }
  }

  /** HEALTH segments + STAMINA bar + SPECIAL fill + balance needle. */
  private drawMeters(health: number, stamina: number): void {
    const m = this.meters;
    const W = this.scale.width;
    const char = this.g.characterDef;
    const sim = this.g.sim;
    m.clear();

    // HEALTH: 10 segments, each its own colour on a red -> orange -> yellow -> green ramp, so
    // losing health visibly eats the green end first. Blinks when under 30.
    const segs = 10;
    const segW = Math.floor((Hud.BAR_W - (segs - 1)) / segs);
    const blink = health < 30 && Math.floor(this.time.now / 160) % 2 === 0;
    const filled = (this.healthShown / 100) * segs;
    for (let i = 0; i < segs; i++) {
      const x = Hud.BAR_X + i * (segW + 1);
      const t = i / (segs - 1);
      const col = t < 0.25 ? 0xd42b2e : t < 0.5 ? 0xe8643a : t < 0.75 ? 0xe8a93a : 0x7fd14b;
      if (blink) {
        m.fillStyle(0xd42b2e, 0.45);
        m.fillRect(x, Hud.HEALTH_Y, segW, 6);
        continue;
      }
      m.fillStyle(UI.ink, 1);
      m.fillRect(x, Hud.HEALTH_Y, segW, 6);
      const partial = Math.max(0, Math.min(1, filled - i));
      if (partial > 0) {
        m.fillStyle(col, 1);
        m.fillRect(x, Hud.HEALTH_Y, Math.max(1, Math.round(segW * partial)), 6);
        m.fillStyle(0xffffff, 0.22);
        m.fillRect(x, Hud.HEALTH_Y, Math.max(1, Math.round(segW * partial)), 1);
      }
    }

    // STAMINA: one smooth green bar; flashes when the trick lockout is active.
    const sw = Math.round((Hud.BAR_W * this.staminaShown) / 100);
    const locked = stamina < 15 && Math.floor(this.time.now / 140) % 2 === 0;
    m.fillStyle(locked ? 0xd42b2e : 0x4fbf5a, 1);
    m.fillRect(Hud.BAR_X, Hud.STAMINA_Y, Math.max(0, sw), 3);
    m.fillStyle(0xffffff, 0.25);
    m.fillRect(Hud.BAR_X, Hud.STAMINA_Y, Math.max(0, sw), 1);

    // SPECIAL: character-coloured fill; PRISM gets the rainbow gradient from its own data row.
    const sx = W - Hud.PAD - Hud.SPECIAL_BAR_W;
    const pct = Math.min(1, sim.specialMeter / 100);
    const fillW = Math.max(pct > 0 ? 1 : 0, Math.round(Hud.SPECIAL_BAR_W * pct));
    if (char.hud.rainbow) {
      const bands = [0xd42b2e, 0xe8a93a, 0xe8e04a, 0x4fbf5a, 0x12d4e0, 0x5560e0, 0xa24fd1];
      const bw = Hud.SPECIAL_BAR_W / bands.length;
      for (let i = 0; i < bands.length; i++) {
        const x0 = sx + i * bw;
        const w = Math.max(0, Math.min(x0 + bw, sx + fillW) - x0);
        if (w > 0) { m.fillStyle(bands[i], 1); m.fillRect(Math.round(x0), 14, Math.ceil(w), 7); }
      }
    } else {
      m.fillStyle(char.hud.specialColour, 1);
      m.fillRect(sx, 14, fillW, 7);
    }
    if (pct >= 1) {
      // ready: stripe pattern so it reads without relying on colour
      m.fillStyle(UI.cream, 0.9);
      for (let x = 0; x < fillW; x += 6) m.fillRect(sx + x, 14, 2, 7);
    }

    // Balance needle, bottom-left
    if (sim.state === 'grind' || sim.state === 'manual') {
      const bx = Hud.PAD;
      const by = 246;
      const bw = 68;
      m.fillStyle(UI.ink, 1);
      m.fillRect(bx, by, bw, 6);
      m.fillStyle(0x1f3b2b, 1);
      m.fillRect(Math.round(bx + bw * 0.33), by, Math.round(bw * 0.34), 6);
      const bv = Math.max(-1, Math.min(1, sim.balance.value));
      const nx = bx + bw / 2 + (bw / 2) * bv;
      m.fillStyle(Math.abs(bv) > 0.7 ? UI.magenta : UI.cream, 1);
      m.fillRect(Math.round(nx) - 1, by - 3, 2, 12);
    }
  }
}

/** Move `from` toward `to` at `maxStep` units — the HUD's bar drain/refill easing. */
function approach(from: number, to: number, maxStep: number): number {
  if (Math.abs(to - from) <= maxStep) return to;
  return from + Math.sign(to - from) * maxStep;
}

/**
 * Width of a bitmap-font string, computed from its length instead of BitmapText.width.
 *
 * BitmapText caches its bounds and the cache is stale on the frame a string changes, so
 * `right - obj.width` clipped the last characters against the screen edge ("TRUN SPIN 0" was
 * "SPECTRUM SPIN 0" with its head cut off). The font is fixed-width 8 px at scale 1.
 */
function textW(s: string, scale: number): number {
  return s.length * 8 * scale;
}
