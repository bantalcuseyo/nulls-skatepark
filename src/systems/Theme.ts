/**
 * UI theme copied from the reference sheets' own visual language, so the game reads as part of the
 * same design system:
 *   - deep navy background
 *   - magenta section headers with a thin magenta rule underneath
 *   - cyan micro-labels (all-caps, small)
 *   - cream body text
 *   - yellow block meters
 *   - hairline cyan panel borders
 * Every colour here is sampled from the owner's reference sheets.
 */
export const UI = {
  bg: 0x0c1226,
  bgPanel: 0x0e1730,
  ink: 0x131629,

  magenta: 0xe0245e,
  cyan: 0x12d4e0,
  amber: 0xe8a93a,
  cream: 0xf4f0e8,
  grey: 0x6b7280,
  dim: 0x312e3d,
  green: 0xc8f0a0,

  // type scale, in virtual px (8 px cell * scale)
  h1: 2,
  h2: 1,
  body: 1,
  micro: 1,

  pad: 6,
} as const;

export const CSS = {
  bg: '#0c1226',
  panel: '#0e1730',
  magenta: '#e0245e',
  cyan: '#12d4e0',
  amber: '#e8a93a',
  cream: '#f4f0e8',
  grey: '#6b7280',
  dim: '#312e3d',
  green: '#c8f0a0',
};

/** Standard inner margin so nothing touches the screen edge. */
export const SAFE = 6;
