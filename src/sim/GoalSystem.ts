import type { SkaterSim } from '../sim/SkaterSim';
import type { LevelGoal } from '../systems/LevelLoader';

export interface GoalState { id: string; done: boolean; progress: number; target: number; label: string }

/** Evaluates the six per-level goals against sim state (brief section 7.7). */
export class GoalSystem {
  private state = new Map<string, boolean>();
  private railsComboMax = 0;

  constructor(private goals: LevelGoal[], private sim: SkaterSim) {}

  update(): GoalState[] {
    const s = this.sim;
    this.railsComboMax = Math.max(this.railsComboMax, s.combo.active ? this.countComboRails() : 0);
    return this.goals.map((g) => {
      let progress = 0;
      let done = this.state.get(g.id) ?? false;
      switch (g.type) {
        case 'score':
          progress = s.score;
          if (s.score >= g.target) done = true;
          break;
        case 'letters':
          progress = s.letters.size;
          if (s.letters.size >= g.target) done = true;
          break;
        case 'secret':
          progress = s.secrets.size;
          if (s.secrets.size >= g.target) done = true;
          break;
        case 'spray':
          progress = s.sprayCans;
          if (s.sprayCans >= g.target) done = true;
          break;
        case 'rails':
          progress = this.railsComboMax;
          if (this.railsComboMax >= g.target) done = true;
          break;
        case 'gaps':
          progress = s.gapsHit.size;
          if (s.gapsHit.size >= g.target) done = true;
          break;
        case 'bigair':
          progress = s.combo.entries.some((e) => e.name.includes('720')) ? g.target : 0;
          if (progress >= g.target) done = true;
          break;
        default:
          break;
      }
      if (done && !this.state.get(g.id)) this.state.set(g.id, true);
      return { id: g.id, done, progress: Math.min(progress, g.target), target: g.target, label: g.label };
    });
  }

  private countComboRails(): number {
    return this.sim.combo.entries.some((e) => e.category === 'grind') ? this.sim.railGrinds.size : 0;
  }

  /** Goals completed this run, for persistence at the results screen. */
  completed(): string[] {
    return [...this.state.entries()].filter(([, v]) => v).map(([k]) => k);
  }
}
