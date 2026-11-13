import Phaser from 'phaser';

export const FONT_KEY = 'pixfont';
export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.,!?+/-%><\'()=*_~ ';

/** Registers the generated 8x8 retro font once per game. */
export function registerFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY,
    width: 8,
    height: 8,
    chars: FONT_CHARS,
    charsPerRow: 16,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(FONT_KEY, data);
}

/** Fixed-width bitmap text. `scale` multiplies the 8px cell height. */
export class PixelText {
  readonly obj: Phaser.GameObjects.BitmapText;
  constructor(scene: Phaser.Scene, x: number, y: number, text = '', scale = 1) {
    registerFont(scene);
    // Uppercase here too: the constructor path bypasses setText, and the bitmap font carries
    // only uppercase glyphs, so lowercase letters would be silently dropped.
    this.obj = scene.add.bitmapText(x, y, FONT_KEY, String(text).toUpperCase(), 8 * scale);
    this.obj.setLetterSpacing(0);
    this.obj.setOrigin(0, 0);
    this.obj.setScrollFactor(0);
    this.obj.setDepth(1000);
  }
  setText(t: string): this {
    // The bitmap font only carries uppercase glyphs; without this, lowercase letters are
    // silently dropped from the string ("Score 15,000" rendered as "S 15,000").
    this.obj.setText(String(t).toUpperCase());
    return this;
  }
  setTint(c: number): this { this.obj.setTint(c); return this; }
  setPosition(x: number, y: number): this { this.obj.setPosition(Math.round(x), Math.round(y)); return this; }
  setVisible(v: boolean): this { this.obj.setVisible(v); return this; }
  setDepth(d: number): this { this.obj.setDepth(d); return this; }
  setAlpha(a: number): this { this.obj.setAlpha(a); return this; }
  setScrollFactor(x: number, y = x): this { this.obj.setScrollFactor(x, y); return this; }
  get width(): number { return this.obj.width; }
  destroy(): void { this.obj.destroy(); }
}
