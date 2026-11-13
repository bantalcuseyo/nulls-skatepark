import Phaser from 'phaser';

/** Loads every generated asset once. */
export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload(): void {
    this.load.image('pixfont', 'assets/ui/font.png');
    const chars = ['riff', 'prism', 'brass', 'loop'];
    for (const c of chars) {
      this.load.spritesheet(`skater_${c}`, `assets/sprites/skater_${c}.png`, { frameWidth: 64, frameHeight: 64 });
      this.load.json(`skater_${c}_atlas`, `assets/sprites/skater_${c}.json`);
    }
    this.load.spritesheet('fx', 'assets/sprites/fx.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('board', 'assets/sprites/board.png');
    for (const lvl of ['alley', 'subway', 'warehouse']) {
      this.load.image(`${lvl}_far`, `assets/backgrounds/${lvl}_far.png`);
      this.load.image(`${lvl}_mid`, `assets/backgrounds/${lvl}_mid.png`);
    }
    this.load.image('alley_near', 'assets/backgrounds/alley_near.png');
    const props = ['kicker', 'rail', 'dumpster', 'quarter', 'funbox', 'bench', 'letter_S', 'letter_K',
      'letter_A', 'letter_T', 'letter_E', 'token_arcade', 'token_metro', 'spray', 'wrench',
      'trashcan', 'drum', 'barrier', 'manualpad'];
    for (const p of props) this.load.image(p, `assets/props/${p}.png`);
    // Owner-supplied reference portraits: the brief's "style target for the menu portrait".
    for (const c of ['riff', 'prism', 'brass', 'loop']) {
      this.load.image(`portrait_${c}`, `assets/portraits/${c}_128.png`);
    }
    this.load.image('ref_env_subway', 'assets/ref_scaled/ref_env_subway.png');
    this.load.image('ref_env_alley', 'assets/ref_scaled/ref_env_alley.png');
  }

  create(): void {
    this.scene.start('Title');
  }
}
