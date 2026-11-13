import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/systems/Scaling';

describe('computeLayout desktop', () => {
  it('uses integer scale and fixed 480 width', () => {
    const l = computeLayout(1920, 1080, 'desktop');
    expect(l.virtualW).toBe(480);
    expect(l.scale).toBe(4);
    expect(l.displayW).toBe(1920);
    expect(l.displayH).toBe(1080);
  });

  it('never drops below 1x', () => {
    expect(computeLayout(200, 100, 'desktop').scale).toBe(1);
  });

  it('letterboxes a tall narrow window instead of stretching', () => {
    const l = computeLayout(1000, 1200, 'desktop');
    expect(l.scale).toBe(2);
    expect(l.displayW).toBe(960);
    expect(l.displayH).toBe(540);
  });
});

describe('computeLayout phone', () => {
  it('clamps virtual width between 480 and 576', () => {
    const wide = computeLayout(2400, 1080, 'phone');
    expect(wide.virtualW).toBeLessThanOrEqual(576);
    expect(wide.virtualW).toBeGreaterThanOrEqual(480);
  });

  it('keeps height fixed at 270', () => {
    expect(computeLayout(2400, 1080, 'phone').virtualH).toBe(270);
  });

  it('integer scale only', () => {
    const l = computeLayout(2340, 1080, 'phone');
    expect(Number.isInteger(l.scale)).toBe(true);
    expect(l.displayH).toBe(270 * l.scale);
  });
});
