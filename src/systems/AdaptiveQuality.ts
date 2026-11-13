import type Phaser from 'phaser';

/**
 * Measures average frame time over a 2 s window and steps quality down when the device cannot
 * hold 60 FPS (brief section 3.1, phone profile). Steps are one-way down during a run; the level
 * resets the step on restart.
 */
export class AdaptiveQuality {
  quality = 1;
  private samples: number[] = [];
  private window = 0;

  constructor(private scene: Phaser.Scene, private enabled: boolean, private onStep?: (q: number) => void) {}

  step(deltaMs: number): void {
    if (!this.enabled || this.quality <= 0.4) return;
    this.samples.push(deltaMs);
    this.window += deltaMs;
    if (this.window < 2000) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples.length = 0;
    this.window = 0;
    if (avg > 20 && this.quality > 0.4) {
      this.quality = this.quality >= 1 ? 0.6 : 0.4;
      this.scene.registry.set('quality', this.quality);
      this.onStep?.(this.quality);
    }
  }
}
