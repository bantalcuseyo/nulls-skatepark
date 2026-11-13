import Phaser from 'phaser';

export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.,!?+/-%><\'()=*_~ ';

/**
 * Colour-name -> tint value, and the baked font sheet that matches.
 *
 * Why this exists: `BitmapText.setTint()` is a WEBGL-only feature in Phaser 3 and silently does
 * nothing under the CANVAS renderer (which is what a device without WebGL falls back to). The
 * rebuild brief requires the HUD's portrait, name and special colour to change per character, so
 * the text colour cannot depend on a tint that may not be applied. Instead each colour has its own
 * pre-coloured font sheet (see tools/gen_font.py) and PixelText picks the sheet.
 *
 * `tint` is still set as well, so on WEBGL the result is identical, and a caller that passes an
 * arbitrary hex (not one of the named colours) still gets tinted text where tinting works.
 */
export const FONT_COLOURS: Record<string, { tint: number; sheet: string }> = {
  cream:   { tint: 0xf4f0e8, sheet: 'cream' },
  amber:   { tint: 0xe8a93a, sheet: 'amber' },
  cyan:    { tint: 0x12d4e0, sheet: 'cyan' },
  magenta: { tint: 0xe0245e, sheet: 'magenta' },
  green:   { tint: 0xc8f0a0, sheet: 'green' },
  grey:    { tint: 0x6b7280, sheet: 'grey' },
  red:     { tint: 0xd42b2e, sheet: 'red' },
  ink:     { tint: 0x1a1a22, sheet: 'ink' },
  teal:    { tint: 0x3f9e93, sheet: 'teal' },
  orange:  { tint: 0xed8445, sheet: 'orange' },
};

/** Closest named colour for an arbitrary hex, used for the per-character HUD colours. */
export function nearestColour(hex: number): string {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  let best = 'cream', bestD = Infinity;
  for (const [name, spec] of Object.entries(FONT_COLOURS)) {
    const tr = (spec.tint >> 16) & 0xff, tg = (spec.tint >> 8) & 0xff, tb = spec.tint & 0xff;
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

/** Registers one bitmap font per colour. Cheap: 10 small sheets, registered once. */
export function registerFont(scene: Phaser.Scene): void {
  for (const spec of Object.values(FONT_COLOURS)) {
    const key = `pixfont_${spec.sheet}`;
    if (scene.cache.bitmapFont.exists(key)) continue;
    const data = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: `font_${spec.sheet}`,
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
    scene.cache.bitmapFont.add(key, data);
  }
}

/**
 * Fixed-width bitmap text.
 *
 * Construct with a colour NAME (`'amber'`) to get text that is the right colour on every renderer,
 * or a hex number to get tinted text (WEBGL) / cream text (CANVAS). Prefer the names.
 */
export class PixelText {
  obj: Phaser.GameObjects.BitmapText;
  private colourName: string;

  constructor(scene: Phaser.Scene, x: number, y: number, text = '', scale = 1, colour: string = 'cream') {
    registerFont(scene);
    this.colourName = colour in FONT_COLOURS ? colour : nearestColour(Number(colour) || 0xf4f0e8);
    // Uppercase here too: the constructor path bypasses setText, and the bitmap font carries
    // only uppercase glyphs, so lowercase letters would be silently dropped.
    const key = `pixfont_${FONT_COLOURS[this.colourName].sheet}`;
    this.obj = scene.add.bitmapText(x, y, key, String(text).toUpperCase(), 8 * scale);
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

  /**
   * Change the colour. Swaps the font sheet, which is what actually changes the pixels under the
   * CANVAS renderer; also calls setTint so WEBGL output matches.
   */
  setColour(c: string | number): this {
    const name = typeof c === 'string' && c in FONT_COLOURS ? c : nearestColour(typeof c === 'number' ? c : Number(c) || 0xf4f0e8);
    if (name !== this.colourName) {
      this.colourName = name;
      this.obj.setFont(`pixfont_${FONT_COLOURS[name].sheet}`);
    }
    return this;
  }

  /** Kept for call sites that tint by hex; maps onto the nearest baked sheet. */
  setTint(c: number): this { return this.setColour(c); }
  setPosition(x: number, y: number): this { this.obj.setPosition(Math.round(x), Math.round(y)); return this; }
  setVisible(v: boolean): this { this.obj.setVisible(v); return this; }
  setDepth(d: number): this { this.obj.setDepth(d); return this; }
  setAlpha(a: number): this { this.obj.setAlpha(a); return this; }
  setScrollFactor(x: number, y = x): this { this.obj.setScrollFactor(x, y); return this; }
  get width(): number { return this.obj.width; }
  destroy(): void { this.obj.destroy(); }
}
