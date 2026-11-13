import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import { UI, SAFE } from '../systems/Theme';
import type { Game } from './Game';

/**
 * HUD layout. Everything is anchored to the screen corners with a fixed 6 px safe margin, and each
 * block sits on its own opaque plate so text never fights the environment art behind it. Layout is
 * recomputed on resize so it also holds on the phone profile's wider virtual canvas.
 */
export class Hud extends Phaser.Scene {
  private g!: Game;
  private plates!: Phaser.GameObjects.Graphics;
  private meters!: Phaser.GameObjects.Graphics;

  private score!: PixelText;
  private bestCombo!: PixelText;
  private comboLine!: PixelText;
  private timer!: PixelText;
  private letters!: PixelText;
  private meterLabel!: PixelText;
  private toast!: PixelText;
  private callout!: PixelText;
  private bankText!: PixelText;
  private balanceLabel!: PixelText;

  private toastT = 0;
  private calloutT = 0;
  private bankT = 0;
  private displayScore = 0;

  constructor() { super('Hud'); }

  init(data: { game: Game }): void { this.g = data.game; }

  create(): void {
    this.plates = this.add.graphics().setScrollFactor(0).setDepth(900);
    this.meters = this.add.graphics().setScrollFactor(0).setDepth(902);

    this.score = new PixelText(this, 0, 0, '0', UI.h1).setTint(UI.cream);
    this.bestCombo = new PixelText(this, 0, 0, '', UI.micro).setTint(UI.grey);
    this.comboLine = new PixelText(this, 0, 0, '', UI.micro).setTint(UI.amber);
    this.timer = new PixelText(this, 0, 0, '2:00', UI.h1).setTint(UI.cream);
    this.letters = new PixelText(this, 0, 0, '', UI.micro).setTint(UI.grey);
    this.meterLabel = new PixelText(this, 0, 0, 'SPECIAL', UI.micro).setTint(UI.grey);
    this.toast = new PixelText(this, 0, 0, '', UI.micro).setTint(UI.green).setVisible(false);
    this.callout = new PixelText(this, 0, 0, '', UI.micro).setTint(UI.cyan).setVisible(false);
    this.bankText = new PixelText(this, 0, 0, '', UI.h1).setTint(UI.amber).setVisible(false);
    this.balanceLabel = new PixelText(this, 0, 0, 'BALANCE', UI.micro).setTint(UI.grey).setVisible(false);

    this.displayScore = 0;
    this.layout();
    this.scale.on('resize', () => this.layout());
  }

  /** Recompute all anchored positions. Called on create and on resize. */
  private layout(): void {
    const W = this.scale.width;
    const right = W - SAFE;
    this.score.setPosition(SAFE + 4, SAFE + 4);
    this.bestCombo.setPosition(SAFE + 4, SAFE + 22);
    this.timer.setPosition(right - this.timer.width - 4, SAFE + 4);
    this.letters.setPosition(right - 4 - this.letters.width, SAFE + 22);
    this.meterLabel.setPosition(SAFE + 4, 240);
    this.drawPlates();
  }

  /** Opaque plates; widths follow the measured text so nothing overflows. */
  private drawPlates(): void {
    const W = this.scale.width;
    const g = this.plates;
    g.clear();
    const plate = (x: number, y: number, w: number, h: number, border: number = UI.cyan): void => {
      g.fillStyle(UI.bg, 0.9);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, border, 0.55);
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };
    // score block (top-left): width follows the score AND the best-combo line
    const sw = Math.max(96, this.score.width + 16, this.bestCombo.width + 16);
    plate(SAFE, SAFE, sw, 40);
    // timer block (top-right): width follows whichever of timer / letters is wider RIGHT NOW,
    // plus 6 px padding on each side so the glyphs never touch the border
    const tw = Math.max(64, this.timer.width + 20, this.letters.width + 20);
    plate(W - SAFE - tw, SAFE, tw, 40);
    // re-anchor the text inside the final plate so nothing is clipped
    this.timer.setPosition(W - SAFE - tw + 10, SAFE + 4);
    this.letters.setPosition(W - SAFE - tw + 10, SAFE + 22);
    // special meter (bottom-left)
    plate(SAFE, 236, 104, 20, this.g.sim.specialMeter >= 100 ? UI.amber : UI.dim);
  }

  showGoal(label: string): void {
    const W = this.scale.width;
    this.toast.setText(label).setVisible(true);
    this.toast.setPosition(Math.round((W - this.toast.width) / 2), 46);
    this.toastT = 3;
  }

  showCallout(text: string): void {
    const W = this.scale.width;
    this.callout.setText(text).setVisible(true);
    this.callout.setPosition(Math.round((W - this.callout.width) / 2), 58);
    this.calloutT = 2;
  }

  showBank(total: number): void {
    const W = this.scale.width;
    this.bankText.setText(`+${total.toLocaleString('en-US')}`).setVisible(true);
    this.bankText.setPosition(Math.round((W - this.bankText.width) / 2), 96);
    this.bankT = 1.2;
  }

  updateHUD(dt: number): void {
    const sim = this.g.sim;
    const W = this.scale.width;
    const snap = sim.hud();

    // score counts up so a big bank reads as an event, not a jump
    if (this.displayScore < snap.score) {
      this.displayScore = Math.min(snap.score, this.displayScore + Math.max(20, (snap.score - this.displayScore) * dt * 14));
    }
    this.score.setText(Math.floor(this.displayScore).toLocaleString('en-US'));
    this.bestCombo.setText(sim.bestCombo > 0 ? `BEST ${sim.bestCombo.toLocaleString('en-US')}` : '')
      .setVisible(sim.bestCombo > 0);

    // timer
    if (this.g.isFreeSkate) {
      this.timer.setText('FREE').setTint(UI.cyan);
    } else {
      const t = Math.max(0, this.g.runTimeLeft);
      this.timer.setText(`${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`);
      this.timer.setTint(t < 10 ? (Math.floor(t * 6) % 2 === 0 ? UI.magenta : UI.cream) : UI.cream);
    }

    // combo line: one row, sanitised to the ASCII the bitmap font carries
    if (sim.combo.active) {
      const names = sim.combo.entries.slice(-3).map((e) => e.name).join('+');
      const mult = snap.multiplier;
      this.comboLine
        .setText(`${names}  ${snap.pending} X${mult}`)
        .setVisible(true)
        .setTint(mult >= 6 ? UI.magenta : mult >= 3 ? UI.amber : UI.cream);
      // keep it centred and inside the safe width
      const maxW = W - SAFE * 2 - 8;
      const x = Math.max(SAFE + 4, Math.round((W - Math.min(this.comboLine.width, maxW)) / 2));
      this.comboLine.setPosition(x, 46);
    } else {
      this.comboLine.setVisible(false);
    }

    // S-K-A-T-E tracker
    const got = sim.letters;
    this.letters.setText(['S', 'K', 'A', 'T', 'E'].map((c) => (got.has(c) ? c : '.')).join(' '))
      .setTint(got.size === 5 ? UI.amber : UI.grey);
    this.letters.setPosition(W - SAFE - 4 - this.letters.width, SAFE + 22);

    // meters
    const m = this.meters;
    m.clear();
    // special (bottom-left)
    const mx = SAFE + 4;
    const my = 242;
    const mw = 92;
    const pct = Math.min(1, snap.meter);
    m.fillStyle(UI.dim, 1);
    m.fillRect(mx, my, mw, 6);
    m.fillStyle(pct >= 1 ? UI.amber : UI.magenta, 1);
    m.fillRect(mx, my, Math.round(mw * pct), 6);
    if (pct >= 1) {
      m.fillStyle(UI.cream, 0.85);
      for (let x = 0; x < mw * pct; x += 6) m.fillRect(mx + x, my, 2, 6);
      this.meterLabel.setText('SPECIAL READY').setTint(UI.amber);
    } else {
      this.meterLabel.setText('SPECIAL').setTint(UI.grey);
    }

    // balance (only while grinding/manualling) — drawn next to the special bar
    if (sim.state === 'grind' || sim.state === 'manual') {
      const bx = SAFE + 112;
      const by = 242;
      const bw = 60;
      m.fillStyle(UI.dim, 1);
      m.fillRect(bx, by, bw, 6);
      m.fillStyle(0x1f3b2b, 1);
      m.fillRect(bx + bw * 0.33, by, bw * 0.34, 6);
      const nx = bx + bw / 2 + (bw / 2) * Math.max(-1, Math.min(1, sim.balance.value));
      m.fillStyle(Math.abs(sim.balance.value) > 0.7 ? UI.magenta : UI.cream, 1);
      m.fillRect(Math.round(nx) - 1, by - 3, 2, 12);
      this.balanceLabel.setVisible(true).setPosition(bx, 232);
    } else {
      this.balanceLabel.setVisible(false);
    }

    // transient text
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.setVisible(false); }
    if (this.calloutT > 0) { this.calloutT -= dt; if (this.calloutT <= 0) this.callout.setVisible(false); }
    if (this.bankT > 0) {
      this.bankT -= dt;
      this.bankText.obj.y = 96 - (1.2 - this.bankT) * 14;
      this.bankText.setAlpha(Math.min(1, this.bankT * 1.5));
      if (this.bankT <= 0) this.bankText.setVisible(false);
    }
    this.drawPlates();
  }

}
