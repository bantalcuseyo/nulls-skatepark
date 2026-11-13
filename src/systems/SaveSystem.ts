export interface GoalProgress { [goalId: string]: boolean }
export interface SaveData {
  version: number;
  scores: Record<string, number>;
  bestCombo: Record<string, number>;
  goals: Record<string, GoalProgress>;
  characters: string[];
  settings: {
    master: number; music: number; sfx: number;
    shake: number; reduceFlash: boolean; crt: boolean;
    assist: boolean; haptics: boolean;
    leftHanded: boolean; touchSize: number; touchOpacity: number;
    profile: 'auto' | 'desktop' | 'phone';
  };
  selectedCharacter: string;
  totalRuns: number;
}

export const SAVE_KEY = 'nulls.save.v1';
export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    scores: {},
    bestCombo: {},
    goals: {},
    characters: ['riff'],
    settings: {
      master: 0.8, music: 0.6, sfx: 0.9,
      shake: 1, reduceFlash: false, crt: false,
      assist: false, haptics: true,
      leftHanded: false, touchSize: 1, touchOpacity: 0.55,
      profile: 'auto',
    },
    selectedCharacter: 'riff',
    totalRuns: 0,
  };
}

/** Versioned localStorage save with in-memory fallback and migration. */
export class SaveSystem {
  data: SaveData = defaultSave();
  private memoryOnly = false;

  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return this.data;
      const parsed = JSON.parse(raw) as Partial<SaveData> & { version?: number };
      this.data = this.migrate(parsed);
    } catch {
      this.memoryOnly = true;
    }
    return this.data;
  }

  private migrate(old: Partial<SaveData> & { version?: number }): SaveData {
    const base = defaultSave();
    if (!old.version || old.version < 1) {
      // pre-versioned blob: keep whatever looks valid
      return { ...base, scores: old.scores ?? {}, characters: old.characters ?? ['riff'] };
    }
    return {
      ...base,
      ...old,
      settings: { ...base.settings, ...(old.settings ?? {}) },
      version: SAVE_VERSION,
    } as SaveData;
  }

  save(): void {
    if (this.memoryOnly) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      this.memoryOnly = true;
    }
  }

  totalGoals(): number {
    return Object.values(this.data.goals).reduce((n, g) => n + Object.values(g).filter(Boolean).length, 0);
  }

  levelGoals(levelId: string): number {
    return Object.values(this.data.goals[levelId] ?? {}).filter(Boolean).length;
  }

  isLevelUnlocked(_levelId: string, index: number): boolean {
    if (index === 0) return true;
    const need = index === 1 ? 3 : 8;
    return this.totalGoals() >= need;
  }

  isCharacterUnlocked(_id: string, unlockGoals: number): boolean {
    return this.totalGoals() >= unlockGoals;
  }

  completeGoal(levelId: string, goalId: string): boolean {
    const g = (this.data.goals[levelId] ??= {});
    if (g[goalId]) return false;
    g[goalId] = true;
    this.save();
    return true;
  }

  recordScore(levelId: string, score: number, combo: number): boolean {
    let best = false;
    if (score > (this.data.scores[levelId] ?? 0)) { this.data.scores[levelId] = score; best = true; }
    this.data.bestCombo[levelId] = Math.max(this.data.bestCombo[levelId] ?? 0, combo);
    this.data.totalRuns++;
    this.save();
    return best;
  }

  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}
