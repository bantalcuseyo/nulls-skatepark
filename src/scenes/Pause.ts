import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import type { Game } from './Game';
import strings from '../strings/en.json';

export class Pause extends Phaser.Scene {
  private g!: Game;
  private idx = 0;
  private items: PixelText[] = [];
  private actions: (() => void)[] = [];

  constructor() { super('Pause'); }
  init(d: { game: Game }): void { this.g = d.game; }

  create(): void {
    const W = this.scale.width;
    this.add.rectangle(0, 0, W, 270, 0x0c1226, 0.75).setOrigin(0, 0);
    const t = new PixelText(this, 0, 60, strings.pause, 2).setTint(0xe0245e);
    t.obj.setPosition(Math.round((W - t.width) / 2), 60);
    const opts: Array<[string, () => void]> = [
      [strings.resume, () => this.g.resumeGame()],
      [strings.restart, () => this.g.restart()],
      [strings.settings, () => { this.scene.start('Title'); }],
      [strings.quit, () => this.g.quitToMenu()],
    ];
    opts.forEach(([label, fn], i) => {
      const p = new PixelText(this, 0, 100 + i * 22, label, 1);
      p.obj.setPosition(Math.round((W - p.width) / 2), 100 + i * 22);
      p.obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => fn());
      this.items.push(p);
      this.actions.push(fn);
    });
    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.actions[this.idx]());
    this.input.keyboard?.on('keydown-SPACE', () => this.actions[this.idx]());
    this.input.keyboard?.on('keydown-ESC', () => this.g.resumeGame());
    this.refresh();
  }

  private move(d: number): void {
    this.idx = (this.idx + d + this.items.length) % this.items.length;
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      it.setText((i === this.idx ? '> ' : '  ') + it.obj.text.replace(/^[><] /, '').replace(/^  /, ''));
      it.obj.setPosition(Math.round((this.scale.width - it.width) / 2), it.obj.y);
    });
  }
}
