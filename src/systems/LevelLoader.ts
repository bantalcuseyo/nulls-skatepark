import type { TerrainData, GroundPoint, RailDef, SurfaceSeg, Solid } from '../sim/Terrain';
import { makeKicker, makeQuarterPipe } from '../sim/Terrain';
import type { GapDef, CollectibleDef } from '../sim/SkaterSim';

export interface LevelProp {
  type: string; id: string; x: number; y: number; len?: number;
}
export interface LevelLayer { key: string; scroll: number }
export interface LevelGoal { id: string; type: string; target: number; label: string }
export interface LevelHazard { type: string; x?: number; interval?: number; range?: number; len?: number; speed?: number }
export interface LevelDef {
  id: string; name: string; width: number; timeLimit: number;
  spawn: { x: number }; music: string;
  ground: GroundPoint[];
  kickers: { x: number; baseY: number; run: number; rise: number; mirror: boolean }[];
  quarters: { x: number; baseY: number; run: number; rise: number; mirror: boolean }[];
  platforms: { x: number; y: number; to: number }[];
  props: LevelProp[];
  gaps: GapDef[];
  collectibles: CollectibleDef[];
  hazards: LevelHazard[];
  layers: LevelLayer[];
  bailZones: { x0: number; x1: number; y: number }[];
  goals: LevelGoal[];
}

export interface LoadedLevel {
  def: LevelDef;
  terrain: TerrainData;
}

/** Turns level JSON into sim terrain: a base polyline plus floating ramp/platform surfaces. */
export function buildTerrain(def: LevelDef): TerrainData {
  // Trim the base ground to its declared span so kickers/quarters can extend beyond it.
  const base = [...def.ground].sort((a, b) => a.x - b.x);
  const baseMax = base[base.length - 1].x;

  const surfaces: SurfaceSeg[] = [];
  for (const k of def.kickers ?? []) {
    surfaces.push({ points: makeKicker(k.x, k.baseY, k.run, k.rise, k.mirror), oneWay: false });
  }
  for (const q of def.quarters ?? []) {
    surfaces.push({ points: makeQuarterPipe(q.x, q.baseY, q.run, q.rise, q.mirror), oneWay: false });
  }
  for (const p of def.platforms ?? []) {
    surfaces.push({
      points: [{ x: p.x, y: p.y, type: 'flat' }, { x: p.to, y: p.y, type: 'flat' }],
      oneWay: true,
    });
  }

  // For x beyond the highest base point, extend the base flat at the last y.
  void baseMax;

  // Solids: everything the skater must not pass through. Bench seats and rails are grindable, so
  // they are NOT solid; bodies (dumpster, barrier, funbox, machine, crates) are.
  const solids: Solid[] = [];
  for (const p of def.props ?? []) {
    if (p.type === 'dumpster') solids.push({ x0: p.x, x1: p.x + 40, y0: p.y - 28, y1: p.y, kind: 'prop' });
    else if (p.type === 'barrier') solids.push({ x0: p.x, x1: p.x + 24, y0: p.y - 20, y1: p.y, kind: 'prop' });
    else if (p.type === 'funbox') solids.push({ x0: p.x, x1: p.x + (p.len ?? 80), y0: p.y - 26, y1: p.y + 6, kind: 'prop' });
    else if (p.type === 'manualpad') solids.push({ x0: p.x, x1: p.x + 48, y0: p.y - 8, y1: p.y, kind: 'prop' });
  }
  for (const h of def.hazards ?? []) {
    if (h.type === 'conveyor') solids.push({ x0: h.x ?? 0, x1: (h.x ?? 0) + (h.len ?? 100), y0: 208, y1: 214, kind: 'prop' });
  }

  const rails: RailDef[] = [];
  for (const p of def.props ?? []) {
    if (p.type === 'rail' || p.type === 'flatrail') rails.push({ id: p.id, x: p.x, y: p.y, len: p.len ?? 96, kind: 'rail' });
    else if (p.type === 'bench') rails.push({ id: p.id, x: p.x, y: p.y, len: p.len ?? 48, kind: 'bench' });
    else if (p.type === 'funbox') rails.push({ id: p.id, x: p.x, y: p.y + 6, len: p.len ?? 80, kind: 'ledge' });
    else if (p.type === 'dumpster') rails.push({ id: p.id, x: p.x, y: p.y, len: 40, kind: 'ledge' });
  }
  return { width: def.width, ground: base, surfaces, solids, rails, bailZones: def.bailZones ?? [] };
}

export function loadLevel(def: LevelDef): LoadedLevel {
  return { def, terrain: buildTerrain(def) };
}
