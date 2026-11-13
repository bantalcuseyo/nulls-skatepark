import type { TerrainData, GroundPoint, RailDef, SurfaceSeg } from '../sim/Terrain';
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

  const rails: RailDef[] = [];
  for (const p of def.props ?? []) {
    if (p.type === 'rail' || p.type === 'flatrail') rails.push({ id: p.id, x: p.x, y: p.y, len: p.len ?? 96, kind: 'rail' });
    else if (p.type === 'bench') rails.push({ id: p.id, x: p.x, y: p.y, len: p.len ?? 48, kind: 'bench' });
    else if (p.type === 'funbox') rails.push({ id: p.id, x: p.x, y: p.y + 6, len: p.len ?? 80, kind: 'ledge' });
    else if (p.type === 'dumpster') rails.push({ id: p.id, x: p.x, y: p.y, len: 40, kind: 'ledge' });
  }
  return { width: def.width, ground: base, surfaces, rails, bailZones: def.bailZones ?? [] };
}

export function loadLevel(def: LevelDef): LoadedLevel {
  return { def, terrain: buildTerrain(def) };
}
