import tricksData from '../data/tricks.json';

export type TrickCategory = 'flip' | 'grab' | 'grind' | 'manual' | 'rotation' | 'gap' | 'special';
export type TrickDef = (typeof tricksData)['flip'][number] & { holdBonus?: number };

export const TRICKS = tricksData;

export interface ActiveTrick {
  id: string;
  name: string;
  category: TrickCategory;
  elapsed: number;
  duration: number;
  basePoints: number;
  anim: string;
  holdBonus: number;
  dir: string;
}

/** Maps a direction (from the input frame) to the trick variant in a category. */
export function dirKey(dirX: number, dirY: number): string {
  if (dirY > 0) return 'up';
  if (dirY < 0) return 'down';
  if (dirX > 0) return 'forward';
  if (dirX < 0) return 'back';
  return 'neutral';
}

export function selectTrick(category: 'flip' | 'grab' | 'grind' | 'manual', dirX: number, dirY: number): TrickDef | null {
  const list = TRICKS[category] as TrickDef[];
  const key = dirKey(dirX, dirY);
  for (const t of list) if (t.dir === key) return t;
  // manual: neutral press means nothing (Up = manual, Down = nose manual).
  return null;
}

export function makeActive(t: TrickDef, category: TrickCategory): ActiveTrick {
  return {
    id: t.id, name: t.name, category,
    elapsed: 0, duration: t.duration,
    basePoints: t.points, anim: t.anim,
    holdBonus: t.holdBonus ?? 0, dir: t.dir,
  };
}

/** Flip speed multiplier from the Flip stat (1..5): higher = shorter animation. */
export function flipDuration(duration: number, flipStat: number): number {
  return duration / (0.85 + (flipStat - 1) * 0.12);
}

/** Rotation award based on accumulated angle (degrees). 360/720 variants score separately. */
export function rotationAward(angleDeg: number): { name: string; points: number } | null {
  const a = Math.abs(angleDeg);
  if (a >= 650) return { name: angleDeg > 0 ? 'FRONTFLIP 720' : 'BACKFLIP 720', points: 2000 };
  if (a >= 300) return { name: angleDeg > 0 ? 'FRONTFLIP' : 'BACKFLIP', points: 500 };
  return null;
}
