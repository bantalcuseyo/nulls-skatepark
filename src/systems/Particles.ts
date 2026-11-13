import Phaser from 'phaser';

/** Pooled particle effects: dust puffs, grind sparks, landing rings, speed streaks. */
export class Particles {
  private pool: Phaser.GameObjects.Image[] = [];
  private live: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; max: number; kind: string }[] = [];
  quality = 1;

  constructor(private scene: Phaser.Scene) {}

  private obtain(kind: number, x: number, y: number): Phaser.GameObjects.Image {
    let img = this.pool.pop();
    if (!img) img = this.scene.add.image(x, y, 'fx', kind);
    img.setTexture('fx', kind);
    img.setPosition(x, y);
    img.setActive(true).setVisible(true).setAlpha(1).setScale(1);
    img.setDepth(30);
    return img;
  }

  private spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, tag: string): void {
    if (this.live.length > 90 * this.quality) return;
    const img = this.obtain(kind, x, y);
    this.live.push({ img, vx, vy, life, max: life, kind: tag });
  }

  dust(x: number, y: number, n = 4): void {
    n = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < n; i++) {
      this.spawn(i % 3, x + (Math.random() - 0.5) * 8, y, (Math.random() - 0.5) * 30, -20 - Math.random() * 20, 0.4 + Math.random() * 0.2, 'dust');
    }
  }

  sparks(x: number, y: number, dir = 1): void {
    for (let i = 0; i < Math.max(1, 2 * this.quality); i++) {
      this.spawn(3 + (i % 3), x, y, -dir * (30 + Math.random() * 50), -30 - Math.random() * 40, 0.25 + Math.random() * 0.15, 'spark');
    }
  }

  ring(x: number, y: number): void {
    this.spawn(6, x, y, 0, 0, 0.25, 'ring');
  }

  streak(x: number, y: number): void {
    this.spawn(9 + Math.floor(Math.random() * 2), x, y, 0, 0, 0.18, 'streak');
  }

  burst(x: number, y: number, colors?: number[]): void {
    void colors;
    for (let i = 0; i < 8; i++) {
      this.spawn(3 + (i % 3), x, y, (Math.random() - 0.5) * 160, -Math.random() * 120, 0.5, 'burst');
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false).setActive(false);
        this.pool.push(p.img);
        this.live.splice(i, 1);
        continue;
      }
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.vy += 140 * dt;
      const t = p.life / p.max;
      p.img.setAlpha(Math.min(1, t * 2));
      if (p.kind === 'ring') {
        p.img.setScale(1 + (1 - t) * 2.2);
        p.img.setAlpha(t * 0.9);
      }
      if (p.kind === 'burst') p.img.setScale(0.6 + t);
      p.img.x = Math.round(p.img.x);
      p.img.y = Math.round(p.img.y);
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.img.setVisible(false).setActive(false);
      this.pool.push(p.img);
    }
    this.live.length = 0;
  }
}
