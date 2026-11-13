import { SIM_DT } from '../config';

/** Fixed 60 Hz stepper with render interpolation (brief section 3). */
export class FixedStep {
  private accumulator = 0;
  alpha = 0;

  /** Advance real time and run `tick` once per 1/60 s. Returns the number of ticks run. */
  advance(realDt: number, tick: (dt: number) => void, maxTicks = 5): number {
    this.accumulator += Math.min(realDt, 0.25);
    let n = 0;
    while (this.accumulator >= SIM_DT && n < maxTicks) {
      tick(SIM_DT);
      this.accumulator -= SIM_DT;
      n++;
    }
    this.alpha = this.accumulator / SIM_DT;
    return n;
  }

  reset(): void {
    this.accumulator = 0;
    this.alpha = 0;
  }
}
