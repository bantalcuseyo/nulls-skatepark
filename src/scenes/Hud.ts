import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import type { Game } from './Game';
import strings from '../strings/en.json';

const MAGENTA = 0xe0245e;
const CYAN = 0x12d4e0;
const AMBER = 0xe8a93a;
const CREAM = 0xf4f0e8;
const GREY = 0x53514a;

export class Hud extends Phaser.Scene {
  private g!: Game;
  private score!: PixelText;
  private bestCombo!: PixelText;
  private comboTotal!: PixelText;
  private timer!: PixelText;
  private letters!: PixelText;
  private meterGfx!: Phaser.GameObjects.Graphics;
  private balanceGfx!: Phaser.GameObjects.Graphics;
  private toast!: PixelText;
  private callout!: PixelText;
  private bankText!: PixelText;
  private toastT = 0;
  private calloutT = 0;
  private bankT = 0;
  private displayScore = 0;
  private meterLabel!: PixelText;

  constructor() { super('Hud'); }

  init(data: { game: Game }): void { this.g = data.game; }

  create(): void {
    const W = this.scale.width;
    this.score = new PixelText(this, 8, 6, '0', 2).setTint(CREAM);
    this.bestCombo = new PixelText(this, 8, 22, '', 1).setTint(GREY);
    this.comboTotal = new PixelText(this, W / 2, 6, '', 1).setTint(AMBER);
    this.timer = new PixelText(this, W - 8, 6, '2:00', 2).setTint(CREAM);
    this.timer.obj.setOrigin(1, 0);
    this.letters = new PixelText(this, W - 8, 26, 'S K A T E', 1).setTint(GREY);
    this.letters.obj.setOrigin(1, 0);
    this.meterGfx = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.balanceGfx = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.meterLabel = new PixelText(this, 8, 238, strings.special, 1).setTint(GREY);
    this.toast = new PixelText(this, 0, 40, '', 1).setTint(AMBER).setVisible(false);
    this.callout = new PixelText(this, 0, 54, '', 1).setTint(CYAN).setVisible(false);
    this.bankText = new PixelText(this, 0, 100, '', 2).setTint(AMBER).setVisible(false);
    this.displayScore = 0;
  }

  showGoal(label: string): void {
    this.toast.setText(`${strings.goals}: ${label}`).setVisible(true);
    this.toast.obj.setPosition(Math.round((this.scale.width - this.toast.width) / 2), 40);
    this.toastT = 3;
  }

  showCallout(text: string): void {
    this.callout.setText(text).setVisible(true);
    this.callout.obj.setPosition(Math.round((this.scale.width - this.callout.width) / 2), 54);
    this.calloutT = 2;
  }

  showBank(total: number): void {
    this.bankText.setText(`+${total.toLocaleString('en-US').replace(/,/g, ',')}`).setVisible(true);
    this.bankText.obj.setPosition(Math.round((this.scale.width - this.bankText.width) / 2), 90);
    this.bankT = 1.2;
  }

  updateHUD(dt: number): void {
    const sim = this.g.sim;
    const snap = sim.hud();

    // score count-up
    if (this.displayScore < snap.score) {
      this.displayScore = Math.min(snap.score, this.displayScore + Math.max(10, (snap.score - this.displayScore) * dt * 12));
    }
    this.score.setText(Math.floor(this.displayScore).toLocaleString('en-US'));
    this.bestCombo.setText(sim.bestCombo > 0 ? `${strings.bestCombo} ${sim.bestCombo.toLocaleString('en-US')}` : '').setVisible(sim.bestCombo > 0);

    // timer
    if (this.g.isFreeSkate) {
      this.timer.setText('FREE').setTint(CYAN);
    } else {
      const t = Math.max(0, this.g.runTimeLeft);
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      this.timer.setText(`${m}:${s.toString().padStart(2, '0')}`);
      this.timer.setTint(t < 10 ? (Math.floor(t * 6) % 2 === 0 ? MAGENTA : CREAM) : CREAM);
    }

    // combo line (top centre, up to 4 recent tricks)
    const entries = sim.combo.entries;
    const recent = entries.slice(-4);
    const label = recent.map((e) => e.name).join('+');
    const mult = snap.multiplier;
    const pend = snap.pending;
    this.comboTotal.setText(sim.combo.active ? `${label}  ${pend}x${mult}` : '').setVisible(sim.combo.active);
    if (sim.combo.active) {
      this.comboTotal.obj.setPosition(Math.max(80, Math.round((this.scale.width - this.comboTotal.width) / 2)), 6);
      this.comboTotal.setTint(mult >= 6 ? MAGENTA : mult >= 3 ? AMBER : CREAM);
    }

    // S-K-A-T-E letters (lit when collected)
    const all = ['S', 'K', 'A', 'T', 'E'];
    const got = sim.letters;
    const text = all.map((c) => (got.has(c) ? c : '-')).join(' ');
    this.letters.setText(text).setTint(got.size === 5 ? AMBER : GREY);

    // special meter (bottom-left, under the score on phone)
    const mg = this.meterGfx;
    mg.clear();
    const mx = 8;
    const my = 246;
    const mw = 90;
    mg.fillStyle(0x0c1226, 0.8);
    mg.fillRect(mx - 2, my - 2, mw + 4, 10);
    mg.lineStyle(1, snap.meter >= 1 ? AMBER : GREY, 1);
    mg.strokeRect(mx - 2, my - 2, mw + 4, 10);
    const fullW = Math.round(mw * Math.min(1, snap.meter));
    mg.fillStyle(snap.meter >= 1 ? AMBER : MAGENTA, 1);
    mg.fillRect(mx, my, fullW, 6);
    if (snap.meter >= 1) {
      // full: striped pattern so it reads without colour alone
      mg.lineStyle(1, 0xffffff, 0.8);
      for (let x = 0; x < fullW; x += 6) mg.lineBetween(mx + x, my, mx + x + 2, my + 6);
      this.meterLabel.setText('SPECIAL READY (X+C)').setTint(AMBER);
    } else {
      this.meterLabel.setText(strings.special).setTint(GREY);
    }

    // balance arc during grind/manual
    const bg = this.balanceGfx;
    bg.clear();
    if (sim.state === 'grind' || sim.state === 'manual') {
      const bx = 120;
      const by = 246;
      const bw = 70;
      bg.fillStyle(0x0c1226, 0.8);
      bg.fillRect(bx - 2, by - 2, bw + 4, 10);
      // green zone
      const zone = 0.35;
      const zx = bx + bw / 2 - (bw / 2) * zone;
      bg.fillStyle(0x1f3b2b, 1);
      bg.fillRect(zx, by, bw * zone, 6);
      bg.lineStyle(1, GREY, 1);
      bg.strokeRect(bx - 2, by - 2, bw + 4, 10);
      const b = sim.balance.value;
      const nx = bx + bw / 2 + (bw / 2) * b;
      bg.lineStyle(2, Math.abs(b) > 0.7 ? MAGENTA : AMBER, 1);
      bg.lineBetween(nx, by - 3, nx, by + 9);
    }

    // toasts
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toast.setVisible(false); }
    if (this.calloutT > 0) { this.calloutT -= dt; if (this.calloutT <= 0) this.callout.setVisible(false); }
    if (this.bankT > 0) {
      this.bankT -= dt;
      this.bankText.obj.y = 90 - (1.2 - this.bankT) * 16;
      this.bankText.setAlpha(Math.min(1, this.bankT));
      if (this.bankT <= 0) this.bankText.setVisible(false);
    }
  }
}
