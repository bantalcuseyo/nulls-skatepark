import type { InputFrame } from '../sim/types';

/** Collects physical inputs and produces a per-tick InputFrame with edge + held states. */
export class InputManager {
  private held = new Set<string>();
  private pressedQueue = new Set<string>();
  private heldFrame: InputFrame['held'];
  private prevPressed = new Set<string>();
  private padPrev = new Map<string, boolean>();
  private touchHeld = new Set<string>();
  private touchPressed = new Set<string>();
  public lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';

  constructor(private target: Window | HTMLElement = window) {
    this.heldFrame = this.emptyHeld();
  }

  private emptyHeld(): InputFrame['held'] {
    return {
      pushForward: false, brakeBack: false, crouch: false, manualUp: false,
      ollie: false, flip: false, grab: false, grind: false, special: false,
      pause: false, restart: false,
    };
  }

  attach(): void {
    const t = this.target as Window;
    t.addEventListener('keydown', this.onKeyDown);
    t.addEventListener('keyup', this.onKeyUp);
    t.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    const t = this.target as Window;
    t.removeEventListener('keydown', this.onKeyDown);
    t.removeEventListener('keyup', this.onKeyUp);
    t.removeEventListener('blur', this.onBlur);
  }

  private onBlur = (): void => {
    this.held.clear();
    this.touchHeld.clear();
  };

  private keyToActions(code: string): string[] {
    switch (code) {
      case 'ArrowRight': case 'KeyD': return ['pushForward'];
      case 'ArrowLeft': case 'KeyA': return ['brakeBack'];
      case 'ArrowDown': case 'KeyS': return ['crouch'];
      case 'ArrowUp': case 'KeyW': return ['manualUp'];
      case 'Space': case 'KeyZ': return ['ollie'];
      case 'KeyX': return ['flip'];
      case 'KeyC': return ['grab'];
      case 'KeyV': return ['grind'];
      case 'Escape': case 'KeyP': return ['pause'];
      case 'KeyR': return ['restart'];
      default: return [];
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) { e.preventDefault(); return; }
    const acts = this.keyToActions(e.code);
    if (acts.length) {
      e.preventDefault();
      this.lastDevice = 'keyboard';
      for (const a of acts) { this.held.add(a); this.pressedQueue.add(a); }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    for (const a of this.keyToActions(e.code)) this.held.delete(a);
  };

  /** Called by the touch overlay; actions use the same names as InputAction. */
  setTouch(action: string, down: boolean): void {
    this.lastDevice = 'touch';
    if (down) {
      if (!this.touchHeld.has(action)) this.touchPressed.add(action);
      this.touchHeld.add(action);
    } else {
      this.touchHeld.delete(action);
    }
  }

  private padButtons: Record<number, string[]> = {
    0: ['ollie'], 1: ['grab'], 2: ['flip'], 3: ['grind'],
    8: ['restart'], 9: ['pause'],
    12: ['manualUp'], 13: ['crouch'], 14: ['brakeBack'], 15: ['pushForward'],
  };

  pollGamepad(): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const seen = new Set<string>();
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (ax > 0.45) seen.add('pushForward');
      if (ax < -0.45) seen.add('brakeBack');
      if (ay > 0.45) seen.add('crouch');
      if (ay < -0.45) seen.add('manualUp');
      for (const [idxStr, acts] of Object.entries(this.padButtons)) {
        const b = pad.buttons[Number(idxStr)];
        if (b?.pressed) for (const a of acts) seen.add(a);
      }
      for (const a of seen) {
        this.lastDevice = 'gamepad';
        if (!this.padPrev.get(a)) this.pressedQueue.add(a);
        this.held.add(a);
      }
      for (const a of this.padPrev.keys()) {
        if (this.padPrev.get(a) && !seen.has(a)) this.held.delete(a);
      }
      this.padPrev = new Map([...seen].map((a) => [a, true]));
      break;
    }
  }

  /** Produce one frame. Consumes the pressed queue. */
  sample(): InputFrame {
    this.pollGamepad();
    const held = this.emptyHeld();
    const pressed = this.emptyHeld();
    const src = new Set([...this.held, ...this.touchHeld]);
    for (const a of src) (held as Record<string, boolean>)[a] = true;
    const edges = new Set([...this.pressedQueue, ...this.touchPressed]);
    for (const a of edges) (pressed as Record<string, boolean>)[a] = true;
    this.pressedQueue.clear();
    this.touchPressed.clear();
    this.prevPressed = edges;

    // special = flip + grab chord
    const h = held as Record<string, boolean>;
    const p = pressed as Record<string, boolean>;
    if (h.flip && h.grab) {
      h.special = true;
      if ((p.flip || p.grab) && !p.special) p.special = true;
    }

    const dirX = held.pushForward && !held.brakeBack ? 1 : held.brakeBack && !held.pushForward ? -1 : 0;
    const dirY = held.manualUp && !held.crouch ? 1 : held.crouch && !held.manualUp ? -1 : 0;
    this.heldFrame = held;
    return { held, pressed, dirX: dirX as -1 | 0 | 1, dirY: dirY as -1 | 0 | 1 };
  }

  currentHeld(): InputFrame['held'] {
    return this.heldFrame;
  }

  clearBuffers(): void {
    this.pressedQueue.clear();
    this.touchPressed.clear();
    this.prevPressed.clear();
  }
}
