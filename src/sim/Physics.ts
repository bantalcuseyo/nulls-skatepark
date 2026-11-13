import physicsData from '../data/physics.json';

export type PhysicsConfig = typeof physicsData;
export const PHYS: PhysicsConfig = { ...physicsData };

/** Hot-reload physics values in dev (F2 in the Game scene). */
export function updatePhysics(patch: Partial<PhysicsConfig>): void {
  Object.assign(PHYS, patch);
}

export function statFactor(stat: number, base = 0.9, span = 0.25): number {
  // stat 1..5 → base .. base+span (0.9..1.15 by default).
  return base + ((Math.max(1, Math.min(5, stat)) - 1) / 4) * span;
}
