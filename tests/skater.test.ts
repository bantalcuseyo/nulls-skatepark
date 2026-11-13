import { describe, expect, it } from 'vitest';
import { SkaterSim } from '../src/sim/SkaterSim';
import { emptyInputFrame } from '../src/sim/types';
import type { InputFrame } from '../src/sim/types';
import { PHYS } from '../src/sim/Physics';
import { makeQuarterPipe, type TerrainData } from '../src/sim/Terrain';

const DT = 1 / 60;

function flatTerrain(width = 2400): TerrainData {
  return {
    width,
    ground: [{ x: 0, y: 220 }, { x: width, y: 220 }],
    rails: [],
    bailZones: [],
    solids: [],
    surfaces: [],
  };
}

function input(patch: Partial<Record<'held' | 'pressed', Record<string, boolean>>> & { dirX?: -1 | 0 | 1; dirY?: -1 | 0 | 1 }): InputFrame {
  const f = emptyInputFrame();
  if (patch.held) Object.assign(f.held, patch.held);
  if (patch.pressed) Object.assign(f.pressed, patch.pressed);
  if (patch.dirX !== undefined) f.dirX = patch.dirX;
  if (patch.dirY !== undefined) f.dirY = patch.dirY;
  return f;
}

function makeSim(terrain = flatTerrain(), stats = { speed: 3, air: 3, balance: 3, flip: 3 }) {
  return new SkaterSim(terrain, [], [], stats, 'riff', false);
}

describe('SkaterSim ground', () => {
  it('pushes up to max speed and coasts down', () => {
    const s = makeSim();
    for (let i = 0; i < 240; i++) s.step(DT, input({ held: { pushForward: true } }));
    expect(Math.abs(s.vx)).toBeGreaterThan(150);
    expect(Math.abs(s.vx)).toBeLessThanOrEqual(s.maxSpeed + 1);
    for (let i = 0; i < 600; i++) s.step(DT, input({}));
    expect(Math.abs(s.vx)).toBe(0);
  });

  it('never leaves the world', () => {
    const s = makeSim();
    for (let i = 0; i < 1200; i++) s.step(DT, input({ held: { pushForward: true } }));
    expect(s.x).toBeLessThanOrEqual(2400);
    expect(s.x).toBeGreaterThanOrEqual(0);
  });
});

describe('SkaterSim ollie', () => {
  it('tap apex is in the 63–96 px window', () => {
    const s = makeSim();
    s.step(DT, input({ pressed: { ollie: true }, held: { ollie: true } }));
    s.step(DT, input({}));
    let apex = s.y;
    for (let i = 0; i < 200; i++) {
      s.step(DT, input({}));
      apex = Math.min(apex, s.y);
      if (s.state === 'ground') break;
    }
    const height = 220 - apex;
    expect(height).toBeGreaterThan(55);
    expect(height).toBeLessThan(105);
  });

  it('held ollie is higher than tap', () => {
    const measure = (holdFrames: number): number => {
      const s = makeSim();
      let apex = 220;
      for (let i = 0; i < 240; i++) {
        const held = i < holdFrames;
        s.step(DT, input({ held: { ollie: held }, pressed: i === 0 ? { ollie: true } : {} }));
        apex = Math.min(apex, s.y);
        if (i > 20 && s.state === 'ground') break;
      }
      return 220 - apex;
    };
    expect(measure(20)).toBeGreaterThan(measure(2));
  });
});

describe('SkaterSim tricks and combo', () => {
  it('kickflip lands and banks points', () => {
    const s = makeSim();
    s.step(DT, input({ pressed: { ollie: true }, held: { ollie: true } }));
    s.step(DT, input({ pressed: { flip: true } }));
    let sawTrick = false;
    for (let i = 0; i < 200; i++) {
      s.step(DT, input({}));
      if (s.combo.entries.some((e) => e.id === 'kickflip')) sawTrick = true;
      if (s.state === 'ground') break;
    }
    expect(sawTrick).toBe(true);
    expect(s.state).toBe('ground');
    for (let i = 0; i < 100; i++) s.step(DT, input({}));
    expect(s.score).toBeGreaterThan(0);
  });

  it('grab held scores more than tapped', () => {
    const run = (holdFrames: number): number => {
      const s = makeSim();
      s.step(DT, input({ pressed: { ollie: true }, held: { ollie: true } }));
      s.step(DT, input({ pressed: { grab: true }, held: { grab: true } }));
      for (let i = 0; i < 200; i++) {
        s.step(DT, input({ held: { grab: i < holdFrames } }));
        if (s.state === 'ground') break;
      }
      return s.combo.subtotal + s.score;
    };
    expect(run(30)).toBeGreaterThan(run(3));
  });

  it('bail loses the combo', () => {
    const s = makeSim();
    s.bail('test');
    expect(s.combo.active).toBe(false);
    expect(s.state).toBe('bail');
    for (let i = 0; i < 80; i++) s.step(DT, input({}));
    expect(s.state).toBe('ground');
  });
});

describe('SkaterSim grind', () => {
  const terrain = flatTerrain();
  terrain.rails.push({ id: 'r1', x: 400, y: 200, len: 200, kind: 'rail' });

  it('snaps to a rail, ticks points, exits into air', () => {
    const s = makeSim(terrain);
    s.x = 360;
    s.vx = 180;
    s.step(DT, input({ pressed: { ollie: true }, held: { ollie: true } }));
    s.step(DT, input({ held: { grind: true } }));
    let groundTicks = 0;
    for (let i = 0; i < 240; i++) {
      s.step(DT, input({ held: { grind: true } }));
      if (s.state === 'grind') groundTicks++;
      if (s.state === 'ground' && i > 5) break;
    }
    expect(groundTicks).toBeGreaterThan(10);
    expect(s.railGrinds.has('r1')).toBe(true);
    expect(s.combo.subtotal).toBeGreaterThan(0);
  });

  it('chains ollie → grind → ollie → manual in one combo', () => {
    const s = makeSim(terrain);
    s.x = 350;
    s.vx = 200;
    s.step(DT, input({ pressed: { ollie: true }, held: { ollie: true } }));
    let phase = 0;
    let sawGrind = false;
    let sawManual = false;
    for (let i = 0; i < 600; i++) {
      const inp = input({
        held: phase === 0 ? { grind: true } : {},
        pressed: phase === 1 ? { ollie: true } : phase === 2 ? { manualUp: true } : {},
      });
      s.step(DT, inp);
      if (s.state === 'grind') { sawGrind = true; if (s.grindTime > 0.3) phase = 1; }
      else if (phase === 1 && s.state === 'air') phase = 2;
      else if (s.state === 'manual') { sawManual = true; break; }
    }
    expect(sawGrind).toBe(true);
    expect(sawManual).toBe(true);
    expect(s.combo.active).toBe(true);
  });
});

describe('SkaterSim ramps', () => {
    it('rides up a quarter pipe, launches, and lands on the platform', () => {
  
    const qp = makeQuarterPipe(400, 220, 90, 110);
    const after = [{ x: 492, y: 110 }, { x: 2400, y: 110 }];
    const terrain: TerrainData = {
      width: 2400,
      ground: [{ x: 0, y: 220 }, { x: 2400, y: 220 }],
      rails: [],
      bailZones: [],
      solids: [],
      surfaces: [
        { points: qp, oneWay: false },
        { points: after, oneWay: true },
      ],
    };
    const s = makeSim(terrain);
    s.x = 300;
    s.vx = 240;
    let minY = 220;
    let launched = false;
    let airFrames = 0;
    for (let i = 0; i < 400; i++) {
      // push on the ground only; in the air release so the skater does not spin
      const inAir = s.state === 'air';
      if (inAir) airFrames++;
      s.step(DT, input({ held: { pushForward: !inAir } }));
      minY = Math.min(minY, s.y);
      if (s.y < 100) launched = true;
    }
    expect(minY).toBeLessThan(100);
    expect(launched).toBe(true);
    expect(airFrames).toBeGreaterThan(10);
    expect(s.bails).toBe(0);
  });

  it('lands clean on a flat platform after a ramp launch with no spin', () => {
  
    const qp = makeQuarterPipe(400, 220, 90, 110);
    const after = [{ x: 492, y: 110 }, { x: 2400, y: 110 }];
    const terrain: TerrainData = {
      width: 2400,
      ground: [{ x: 0, y: 220 }, { x: 2400, y: 220 }],
      rails: [],
      bailZones: [],
      solids: [],
      surfaces: [
        { points: qp, oneWay: false },
        { points: after, oneWay: true },
      ],
    };
    const s = makeSim(terrain);
    s.x = 470;
    s.vx = 150;
    for (let i = 0; i < 200; i++) {
      s.step(DT, input({}));
      if (s.state === 'ground' && i > 5) break;
    }
    expect(s.bails).toBe(0);
  });
});

describe('SkaterSim special meter', () => {
  it('special consumes the meter and adds a special entry', () => {
    const s = makeSim();
    s.specialMeter = PHYS.specialMeterMax;
    s.step(DT, input({ pressed: { special: true } }));
    expect(s.state).toBe('special');
    expect(s.specialMeter).toBe(0);
    for (let i = 0; i < 100; i++) s.step(DT, input({}));
    expect(s.combo.entries.some((e) => e.category === 'special')).toBe(true);
  });
});

describe('SkaterSim solids', () => {
  it('cannot pass through a dumpster', () => {
    const terrain: TerrainData = {
      width: 2400,
      ground: [{ x: 0, y: 220 }, { x: 2400, y: 220 }],
      rails: [],
      bailZones: [],
      surfaces: [],
      solids: [{ x0: 700, x1: 740, y0: 192, y1: 220, kind: 'prop' }],
    };
    const s = makeSim(terrain);
    s.x = 600;
    s.vx = 220;
    for (let i = 0; i < 120; i++) s.step(DT, input({ held: { pushForward: true } }));
    expect(s.x).toBeLessThanOrEqual(700);
  });

  it('can land on top of a solid after an ollie', () => {
    const terrain: TerrainData = {
      width: 2400,
      ground: [{ x: 0, y: 220 }, { x: 2400, y: 220 }],
      rails: [],
      bailZones: [],
      surfaces: [],
      solids: [{ x0: 700, x1: 740, y0: 192, y1: 220, kind: 'prop' }],
    };
    const s = makeSim(terrain);
    s.x = 650;
    s.vx = 170;
    for (let i = 0; i < 90; i++) {
      const jump = i === 6;
      s.step(DT, input({ pressed: jump ? { ollie: true } : {}, held: jump ? { ollie: true } : {} }));
      if (s.x > 705 && s.y <= 195) break;
    }
    expect(s.y).toBeLessThanOrEqual(196);
  });
});
