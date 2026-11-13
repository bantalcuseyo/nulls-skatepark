import type { TrickCategory } from './TrickSystem';

export interface ComboEntry {
  id: string;
  name: string;
  points: number;
  category: TrickCategory;
  repeat: boolean;
}

export interface ComboSnapshot {
  entries: ComboEntry[];
  multiplier: number;
  subtotal: number;
  specialActive: boolean;
  /** Total that banking now would pay (subtotal × multiplier, including special). */
  pending: number;
}

/**
 * One combo chain. Distinct tricks raise the multiplier by 1 each; repeats pay 50 % and do not
 * raise it. A special trick doubles the multiplier for the remainder of the chain.
 * Score = (sum of trick points) × multiplier.
 */
export class ComboScore {
  entries: ComboEntry[] = [];
  private seen = new Set<string>();
  private specialActive = false;

  get active(): boolean {
    return this.entries.length > 0;
  }

  get multiplier(): number {
    return Math.max(1, this.seen.size) * (this.specialActive ? 2 : 1);
  }

  get subtotal(): number {
    return this.entries.reduce((s, e) => s + e.points, 0);
  }

  add(id: string, name: string, points: number, category: TrickCategory): ComboEntry {
    const repeat = this.seen.has(id);
    const entry: ComboEntry = { id, name, points: repeat ? Math.round(points * 0.5) : points, category, repeat };
    if (category === 'special') this.specialActive = true;
    this.seen.add(id);
    this.entries.push(entry);
    return entry;
  }

  /** Points this entry contributes to the meter before banking. */
  meterPoints(): number {
    return this.subtotal * 0.06;
  }

  snapshot(): ComboSnapshot {
    return {
      entries: [...this.entries],
      multiplier: this.multiplier,
      subtotal: this.subtotal,
      specialActive: this.specialActive,
      pending: Math.round(this.subtotal * this.multiplier),
    };
  }

  /** Returns the banked score and resets the chain. */
  bank(): number {
    const total = Math.round(this.subtotal * this.multiplier);
    this.reset();
    return total;
  }

  reset(): void {
    this.entries = [];
    this.seen.clear();
    this.specialActive = false;
  }
}
