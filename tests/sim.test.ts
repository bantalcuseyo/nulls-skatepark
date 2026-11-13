import { describe, expect, it } from 'vitest';
import { ComboScore } from '../src/sim/ComboScore';
import { Balance } from '../src/sim/Balance';
import { rotationAward, selectTrick, dirKey } from '../src/sim/TrickSystem';
import { sampleGround, makeQuarterPipe } from '../src/sim/Terrain';

describe('ComboScore', () => {
  it('scores distinct tricks × multiplier', () => {
    const c = new ComboScore();
    c.add('kickflip', 'KICKFLIP', 100, 'flip');
    c.add('indy', 'INDY', 200, 'grab');
    expect(c.multiplier).toBe(2);
    expect(c.bank()).toBe(600);
    expect(c.active).toBe(false);
  });

  it('repeated trick pays 50% and does not raise multiplier', () => {
    const c = new ComboScore();
    c.add('kickflip', 'KICKFLIP', 100, 'flip');
    c.add('kickflip', 'KICKFLIP', 100, 'flip');
    expect(c.multiplier).toBe(1);
    expect(c.bank()).toBe(150);
  });

  it('special doubles the multiplier', () => {
    const c = new ComboScore();
    c.add('kickflip', 'KICKFLIP', 100, 'flip');
    c.add('indy', 'INDY', 100, 'grab');
    c.add('special_riff', 'PIXEL STORM', 1500, 'special');
    expect(c.multiplier).toBe(6);
    expect(c.bank()).toBe((100 + 100 + 1500) * 6);
  });

  it('bank resets the chain', () => {
    const c = new ComboScore();
    c.add('a', 'A', 100, 'flip');
    c.bank();
    expect(c.multiplier).toBe(1);
    expect(c.subtotal).toBe(0);
  });
});

describe('Balance', () => {
  it('drifts and eventually fails without correction', () => {
    const b = new Balance();
    b.reset();
    b.dir = 1;
    for (let i = 0; i < 600 && !b.failed; i++) b.step(1 / 60, 0, 3, false);
    expect(b.failed).toBe(true);
  });

  it('higher balance stat survives longer', () => {
    const run = (stat: number): number => {
      const b = new Balance();
      b.reset();
      b.dir = 1;
      let t = 0;
      for (let i = 0; i < 1200 && !b.failed; i++) { b.step(1 / 60, 0, stat, false); t += 1 / 60; }
      return t;
    };
    expect(run(5)).toBeGreaterThan(run(1));
  });

  it('corrective nudge holds the centre', () => {
    const b = new Balance();
    b.reset();
    b.dir = 1;
    for (let i = 0; i < 240; i++) b.step(1 / 60, b.value > 0.1 ? -1 : 0, 4, false);
    expect(b.failed).toBe(false);
  });
});

describe('TrickSystem', () => {
  it('maps directions to tricks', () => {
    expect(selectTrick('flip', 0, 0)?.id).toBe('kickflip');
    expect(selectTrick('flip', 0, -1)?.id).toBe('heelflip');
    expect(selectTrick('flip', 1, 0)?.id).toBe('hardflip');
    expect(selectTrick('grab', 0, 0)?.id).toBe('indy');
    expect(dirKey(0, 1)).toBe('up');
  });

  it('rotation awards at 360 and 720 only', () => {
    expect(rotationAward(100)).toBeNull();
    expect(rotationAward(360)?.points).toBe(500);
    expect(rotationAward(-720)?.points).toBe(2000);
  });
});

describe('Terrain', () => {
  it('interpolates a slope', () => {
    const g = sampleGround([{ x: 0, y: 200 }, { x: 100, y: 100 }], 50);
    expect(g.y).toBe(150);
    expect(g.slope).toBe(-1);
  });

  it('clamps outside the polyline', () => {
    const g = [{ x: 10, y: 200 }, { x: 100, y: 200 }];
    expect(sampleGround(g, -50).y).toBe(200);
    expect(sampleGround(g, 500).y).toBe(200);
  });

  it('quarter pipe rises monotonically', () => {
    const q = makeQuarterPipe(0, 220, 80, 100);
    for (let i = 1; i < q.length; i++) expect(q[i].y).toBeLessThanOrEqual(q[i - 1].y);
  });

});
