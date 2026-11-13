/** Ground geometry: one continuous base polyline plus floating surface segments
 *  (platforms, ramps) that the skater only collides with when approaching from above.
 *  Pure data, no Phaser. */

export interface GroundPoint { x: number; y: number; type?: 'flat' | 'kicker' | 'quarter' }
export interface RailDef { id: string; x: number; y: number; len: number; kind: 'rail' | 'ledge' | 'bench' }
export interface BailZone { x0: number; x1: number; y: number }
export interface SurfaceSeg {
  points: GroundPoint[];
  /** One-way platforms: only land on top when falling. */
  oneWay: boolean;
}

/** An axis-aligned solid the skater cannot pass through (dumpsters, barriers, machine blocks). */
export interface Solid {
  x0: number; x1: number; y0: number; y1: number;
  /** Low obstacles can be ollied over; tall ones cannot be cleared by jumping. */
  kind: 'prop' | 'wall';
}

export interface TerrainData {
  width: number;
  solids: Solid[];
  /** Base ground, x-sorted, continuous (walkable everywhere). */
  ground: GroundPoint[];
  /** Floating surfaces: ramps, platforms, bowl lips. */
  surfaces: SurfaceSeg[];
  rails: RailDef[];
  bailZones: BailZone[];
}

export interface SurfaceHit {
  y: number;
  slope: number;
  type: string;
  segment: number;
}

function samplePolyline(pts: GroundPoint[], x: number): SurfaceHit {
  if (pts.length === 0) return { y: 220, slope: 0, type: 'flat', segment: -1 };
  if (x <= pts[0].x) return { y: pts[0].y, slope: 0, type: pts[0].type ?? 'flat', segment: 0 };
  const last = pts.length - 1;
  if (x >= pts[last].x) return { y: pts[last].y, slope: 0, type: pts[last].type ?? 'flat', segment: last };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].x <= x) lo = mid; else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const t = (x - a.x) / (b.x - a.x || 1);
  return { y: a.y + (b.y - a.y) * t, slope: (b.y - a.y) / (b.x - a.x || 1), type: b.type ?? a.type ?? 'flat', segment: lo };
}

/** Base ground at x (always defined). */
export function sampleGround(ground: GroundPoint[], x: number): SurfaceHit {
  return samplePolyline(ground, x);
}

export interface FullHit extends SurfaceHit {
  surf: SurfaceSeg | null;
  index: number;
}

/**
 * The surface the skater is on or should land on at x.
 * - airborne: the highest surface below currentY (the first thing we'd fall onto).
 * - grounded: if riding a known surface (ridingIndex) and x is still inside its span, stay on it —
 *   that is what makes a ramp climbable instead of snapping back to the base ground.
 */
export function surfaceAt(terrain: TerrainData, x: number, currentY: number, airborne: boolean, ridingIndex = -1): FullHit {
  const base = samplePolyline(terrain.ground, x);
  const inSpan = (s: SurfaceSeg): boolean =>
    x >= s.points[0].x - 0.01 && x <= s.points[s.points.length - 1].x + 0.01;

  if (!airborne && ridingIndex >= 0) {
    const cur = terrain.surfaces[ridingIndex];
    if (cur && inSpan(cur)) {
      return { ...samplePolyline(cur.points, x), surf: cur, index: ridingIndex };
    }
  }

  let best: FullHit = { ...base, surf: null, index: -1 };
  for (let i = 0; i < terrain.surfaces.length; i++) {
    const s = terrain.surfaces[i];
    if (!inSpan(s)) continue;
    const h = samplePolyline(s.points, x);
    if (airborne) {
      if (currentY <= h.y + 1 && h.y < best.y) best = { ...h, surf: s, index: i };
    } else if (Math.abs(currentY - h.y) < 6 && !best.surf) {
      // entry: the foot of a ramp/platform meets the base ground here
      best = { ...h, surf: s, index: i };
    }
  }
  return best;
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

/** Kicker: rises toward the lip. Mirror flips the travel direction. */
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

/** Quarter-pipe: near-vertical at the lip. */
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
