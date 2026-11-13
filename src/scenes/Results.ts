import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import type { Game } from './Game';
import type { GoalState } from '../sim/GoalSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import strings from '../strings/en.json';

export class Results extends Phaser.Scene {
  private g!: Game;
  private goals: GoalState[] = [];
  private idx = 0;
  private items: PixelText[] = [];
  private actions: (() => void)[] = [];

  constructor() { super('Results'); }

  init(d: { game: Game; goals: GoalState[] }): void {
    this.g = d.game;
    this.goals = d.goals;
  }

  create(): void {
    const save = (this.game as unknown as { save: SaveSystem }).save;
    const audio = (this.game as unknown as { audio: AudioManager }).audio;
    const sim = this.g.sim;
    const level = this.g.currentLevel;
    const W = this.scale.width;
    sim.bankCombo();

    // persist
    const newlyCompleted: string[] = [];
    for (const g of this.goals) {
      if (g.done && save.completeGoal(level.id, g.id)) newlyCompleted.push(g.label);
    }
    const isBest = save.recordScore(level.id, sim.score, sim.bestCombo);

    this.add.rectangle(0, 0, W, 270, 0x0c1226, 0.92).setOrigin(0, 0);
    const title = new PixelText(this, 0, 14, strings.results, 2).setTint(0x12d4e0);
    title.obj.setPosition(Math.round((W - title.width) / 2), 14);
    const score = new PixelText(this, 0, 40, `${strings.score} ${sim.score.toLocaleString('en-US')}`, 2).setTint(0xe8a93a);
    score.obj.setPosition(Math.round((W - score.width) / 2), 40);
    const sub = new PixelText(this, 0, 60,
      `${strings.bestCombo} ${sim.bestCombo.toLocaleString('en-US')}  ${isBest ? strings.newBest : `${strings.best} ${save.data.scores[level.id] ?? 0}`}`, 1).setTint(isBest ? 0xe0245e : 0xadb18c);
    sub.obj.setPosition(Math.round((W - sub.width) / 2), 60);

    // goal list
    this.goals.forEach((g, i) => {
      const mark = g.done ? '*' : '-';
      const line = new PixelText(this, 30, 80 + i * 12, `${mark} ${g.label}`, 1)
        .setTint(g.done ? 0xc8f0a0 : 0x53514a);
      line.obj.setPosition(40, 80 + i * 12);
    });

    if (newlyCompleted.length) {
      audio.play('goal');
      const u = new PixelText(this, 0, 160 + 6, strings.unlocked + ' ' + newlyCompleted.join(', '), 1).setTint(0xe8a93a);
      u.obj.setPosition(Math.round((W - Math.min(u.width, W - 20)) / 2), 164);
    }
    const total = new PixelText(this, 0, 180, `TOTAL GOALS: ${save.totalGoals()}`, 1).setTint(0x12d4e0);
    total.obj.setPosition(Math.round((W - total.width) / 2), 180);

    const opts: Array<[string, () => void]> = [
      [strings.retry, () => { this.g.scene.stop(); this.g.restart(); }],
      [strings.levelSelect, () => { this.g.scene.stop(); this.g.quitToMenu(); }],
    ];
    opts.forEach(([label, fn], i) => {
      const p = new PixelText(this, 0, 208 + i * 22, label, 1);
      p.obj.setPosition(Math.round((W - p.width) / 2), 208 + i * 22);
      p.obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => fn());
      this.items.push(p);
      this.actions.push(fn);
    });

    this.input.keyboard?.on('keydown-R', () => { this.g.scene.stop(); this.g.restart(); });
    this.input.keyboard?.on('keydown-ENTER', () => this.actions[this.idx]());
    this.input.keyboard?.on('keydown-SPACE', () => this.actions[this.idx]());
    this.input.keyboard?.on('keydown-ESC', () => { this.g.scene.stop(); this.g.quitToMenu(); });
    this.input.keyboard?.on('keydown-DOWN', () => { this.idx = (this.idx + 1) % this.items.length; this.refresh(); });
    this.input.keyboard?.on('keydown-UP', () => { this.idx = (this.idx + this.items.length - 1) % this.items.length; this.refresh(); });
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      it.setText((i === this.idx ? '> ' : '  ') + it.obj.text.replace(/^[><] /, '').replace(/^  /, ''));
      it.obj.setPosition(Math.round((this.scale.width - it.width) / 2), it.obj.y);
    });
  }
}
