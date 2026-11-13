import { PHYS } from './Physics';

/**
 * Balance meter for grinds and manuals. b ∈ [-1, 1]; drifts away from 0 at a rate that grows
 * with time, reduced by the Balance stat. Left/Right nudges it back. |b| < green pays points,
 * |b| ≥ 1 bails.
 */
export class Balance {
  value = 0;
  elapsed = 0;
  dir = 1;
  failed = false;

  reset(): void {
    this.value = 0;
    this.elapsed = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.failed = false;
  }

  step(dt: number, nudge: number, balanceStat: number, _assist: boolean): void {
    if (this.failed) return;
    this.elapsed += dt;
    const stat = 1 - (balanceStat - 1) * PHYS.balanceStatFactor;
    const drift = (PHYS.balanceDriftBase + this.elapsed * PHYS.balanceDriftGrowth) * stat;
    this.value += this.dir * drift * dt;
    this.value += nudge * PHYS.balanceNudge * dt;
    if (this.value >= 1 || this.value <= -1) {
      this.failed = true;
      this.value = Math.max(-1, Math.min(1, this.value));
    }
  }

  get inGreen(): boolean {
    return Math.abs(this.value) < (this.assist ? PHYS.balanceGreenZoneAssist : PHYS.balanceGreenZone);
  }

  assist = false;

  /** Nudge toward centre: -1 pushes b left (toward -1) so pass -sign(b) to correct. */
  nudgeFor(input: number): number {
    return input;
  }
}
