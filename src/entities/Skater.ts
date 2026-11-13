import Phaser from 'phaser';

export interface AnimSpec { row: number; frames: number; fps: number; loop: boolean }
export interface SkaterAtlas { cell: number; anims: Record<string, AnimSpec> }

/** Renders one skater from its generated 64x64 sheet and mirrors by facing. */
export class Skater {
  sprite: Phaser.GameObjects.Sprite;
  private current = '';
  private t = 0;
  private frame = 0;
  squash = 0;

  constructor(scene: Phaser.Scene, public characterId: string, private atlas: SkaterAtlas) {
    this.sprite = scene.add.sprite(0, 0, `skater_${characterId}`, 0).setOrigin(0.5, 1).setDepth(12);
  }

  play(anim: string): void {
    if (anim === this.current) return;
    this.current = anim;
    this.t = 0;
    this.frame = 0;
    if (!(anim in this.atlas.anims)) this.current = 'idle';
  }

  update(dt: number, x: number, y: number, facing: number, angleDeg: number, anim: string): void {
    this.play(anim);
    const spec = this.atlas.anims[this.current] ?? this.atlas.anims.idle;
    this.t += dt;
    const frameDur = 1 / spec.fps;
    while (this.t >= frameDur) {
      this.t -= frameDur;
      this.frame = spec.loop ? (this.frame + 1) % spec.frames : Math.min(spec.frames - 1, this.frame + 1);
    }
    const cell = this.atlas.cell;
    const idx = spec.row * 8 + this.frame;
    this.sprite.setFrame(idx);
    void cell;
    // feet anchored, whole-pixel snap
    this.sprite.setPosition(Math.round(x), Math.round(y + 3));
    this.sprite.setFlipX(facing < 0);
    this.sprite.setAngle(angleDeg * facing * 0.4);
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 6);
      this.sprite.setScale(1 + this.squash * 0.2, 1 - this.squash * 0.25);
    } else {
      this.sprite.setScale(1, 1);
    }
  }

  setVisible(v: boolean): void { this.sprite.setVisible(v); }
  destroy(): void { this.sprite.destroy(); }
}
