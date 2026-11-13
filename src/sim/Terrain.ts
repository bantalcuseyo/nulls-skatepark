/** Polyline ground with slopes + grind rails + bail zones. Pure data, no Phaser. */

export interface GroundPoint { x: number; y: number; type?: 'flat' | 'kicker' | 'quarter' }
export interface RailDef { id: string; x: number; y: number; len: number; kind: 'rail' | 'ledge' | 'bench' }
export interface BailZone { x0: number; x1: number; y: number }

export interface TerrainData {
  width: number;
  ground: GroundPoint[];
  rails: RailDef[];
  bailZones: BailZone[];
}

export interface SurfaceHit {
  y: number;
  slope: number;
  type: string;
  segment: number;
}

/** Linear-interpolated ground height and slope at x. */
export function sampleGround(ground: GroundPoint[], x: number): SurfaceHit {
  if (ground.length === 0) return { y: 220, slope: 0, type: 'flat', segment: -1 };
  if (x <= ground[0].x) return { y: ground[0].y, slope: 0, type: ground[0].type ?? 'flat', segment: 0 };
  const last = ground.length - 1;
  if (x >= ground[last].x) return { y: ground[last].y, slope: 0, type: ground[last].type ?? 'flat', segment: last };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ground[mid].x <= x) lo = mid; else hi = mid;
  }
  const a = ground[lo];
  const b = ground[hi];
  const t = (x - a.x) / (b.x - a.x || 1);
  return {
    y: a.y + (b.y - a.y) * t,
    slope: (b.y - a.y) / (b.x - a.x || 1),
    type: b.type ?? a.type ?? 'flat',
    segment: lo,
  };
}

/** Rail surface at x, or null when x is outside the rail. */
export function railAt(rails: RailDef[], x: number): RailDef | null {
  for (const r of rails) {
    if (x >= r.x && x <= r.x + r.len) return r;
  }
  return null;
}

export function inBailZone(zones: BailZone[], x: number, y: number): boolean {
  for (const z of zones) {
    if (x >= z.x0 && x <= z.x1 && y >= z.y) return true;
  }
  return false;
}

/** Kicker/quarter-pipe: rises to the right (or mirrored); slope grows with the rise. */
export function makeKicker(x: number, baseY: number, run: number, rise: number, mirror = false): GroundPoint[] {
  const pts: GroundPoint[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = mirror ? x - t * run : x + t * run;
    const py = baseY - rise * t * t;
    pts.push({ x: px, y: py, type: 'kicker' });
  }
  return pts.sort((a, b) => a.x - b.x);
}

/** Quarter-pipe: smooth curve that gets near-vertical at the lip. */
export function makeQuarterPipe(x: number, baseY: number, run: number, rise: number, mirror = false): GroundPoint[] {
  const pts: GroundPoint[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = mirror ? x - t * run : x + t * run;
    const py = baseY - rise * (1 - Math.cos((t * Math.PI) / 2));
    pts.push({ x: px, y: py, type: 'quarter' });
  }
  return pts.sort((a, b) => a.x - b.x);
}

export function mergeGround(base: GroundPoint[], ...segments: GroundPoint[][]): GroundPoint[] {
  const all = [...base, ...segments.flat()].sort((a, b) => a.x - b.x);
  const out: GroundPoint[] = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.001) {
      // overlap: keep the higher (smaller y) surface
      if (p.y < last.y) out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}
