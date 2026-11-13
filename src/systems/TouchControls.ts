import type { InputManager } from './InputManager';
import type { InputAction } from '../sim/types';

export interface TouchOptions {
  leftHanded: boolean;
  opacity: number;
  size: number;      // multiplier, 1 = default
  haptics: boolean;
}

const DPAD: Array<{ a: InputAction; dx: number; dy: number; t: string }> = [
  { a: 'manualUp', dx: 0, dy: -1, t: 'U' },
  { a: 'brakeBack', dx: -1, dy: 0, t: 'L' },
  { a: 'crouch', dx: 0, dy: 1, t: 'D' },
  { a: 'pushForward', dx: 1, dy: 0, t: 'R' },
];
const DIAMOND: Array<{ a: InputAction; dx: number; dy: number; t: string; big?: boolean }> = [
  { a: 'grind', dx: 0, dy: -1, t: 'GRND' },
  { a: 'flip', dx: -1, dy: 0, t: 'FLIP' },
  { a: 'grab', dx: 1, dy: 0, t: 'GRAB' },
  { a: 'ollie', dx: 0, dy: 1, t: 'OLLIE', big: true },
];

/**
 * Dom-based multi-touch overlay. Each button is a DOM element positioned over the canvas in
 * CSS pixels, so it scales with the integer scale and respects safe-area insets.
 * Buttons have pointer capture per pointer id so several can be held at once.
 */
export class TouchControls {
  private container: HTMLDivElement;
  private specialBtn!: HTMLDivElement;
  private pauseBtn!: HTMLDivElement;
  private active = new Map<number, { actions: InputAction[]; el: HTMLDivElement }>();

  constructor(private input: InputManager, private opts: TouchOptions, onPause: () => void) {
    this.container = document.createElement('div');
    this.container.id = 'touch';
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:20;font-family:monospace;';
    document.body.appendChild(this.container);
    this.build(onPause);
  }

  private build(onPause: () => void): void {
    const s = Math.min(window.innerWidth, window.innerHeight) / 270;
    const btn = Math.max(48, 26 * s * this.opts.size);
    const gap = Math.max(8, 4 * s);
    const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-right') || '0');
    void inset;
    const leftSide = !this.opts.leftHanded;

    const mkBtn = (label: string, x: number, y: number, w: number, h: number, actions: InputAction[], color: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${Math.round(x)}px;top:${Math.round(y)}px;width:${w}px;height:${h}px;
        border:1px solid ${color};border-radius:6px;background:rgba(12,18,38,${this.opts.opacity});
        color:${color};display:flex;align-items:center;justify-content:center;font-size:${Math.max(10, w * 0.16)}px;
        pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 0 8px ${color}33;`;
      el.textContent = label;
      el.dataset.down = '0';
      this.container.appendChild(el);
      const press = (e: PointerEvent, down: boolean): void => {
        e.preventDefault();
        if (down) {
          // Record the input FIRST: setPointerCapture throws for pointers that are not active
          // (synthetic events, or a pointer already released), and must never lose the press.
          this.active.set(e.pointerId, { actions, el });
          for (const a of actions) this.input.setTouch(a, true);
          try { el.setPointerCapture(e.pointerId); } catch { /* capture is an optimisation */ }
          el.dataset.down = '1';
          el.style.background = `rgba(224,36,94,${Math.min(1, this.opts.opacity + 0.25)})`;
          if (this.opts.haptics && navigator.vibrate) navigator.vibrate(8);
        } else if (this.active.has(e.pointerId)) {
          const entry = this.active.get(e.pointerId)!;
          for (const a of entry.actions) this.input.setTouch(a, false);
          this.active.delete(e.pointerId);
          entry.el.dataset.down = '0';
          entry.el.style.background = `rgba(12,18,38,${this.opts.opacity})`;
        }
      };
      el.addEventListener('pointerdown', (e) => press(e, true));
      el.addEventListener('pointerup', (e) => press(e, false));
      el.addEventListener('pointercancel', (e) => press(e, false));
      el.addEventListener('lostpointercapture', (e) => press(e, false));
      el.addEventListener('pointerleave', (e) => { if (el.dataset.down === '1') press(e, false); });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      return el;
    };

    const W = window.innerWidth;
    const H = window.innerHeight;
    const padC = btn * 1.5;
    const baseY = H - padC - btn * 0.6 - gap;
    let diamy = H - padC - gap;
    if (leftSide) {
      // D-pad on the left
      const cx = padC + gap;
      const cy = H - padC - gap;
      diamy = cy;
      for (const d of DPAD) {
        mkBtn(d.t, cx + d.dx * (padC / 1.7) - btn / 2, cy + d.dy * (padC / 1.7) - btn / 2, btn, btn, [d.a], '#12d4e0');
      }
      // action diamond on the right
      const dx = W - padC - gap - btn * 0.4;
      const dy = cy;
      diamy = dy;
      for (const d of DIAMOND) {
        const b = d.big ? btn * 1.35 : btn;
        mkBtn(d.t, dx + d.dx * padC * 0.62 - b / 2, dy + d.dy * padC * 0.62 - b / 2, b, b, [d.a], d.big ? '#e0245e' : '#e8a93a');
      }
    } else {
      const cx = W - padC - gap;
      const cy = H - padC - gap;
      for (const d of DPAD) mkBtn(d.t, cx + d.dx * (padC / 1.7) - btn / 2, cy + d.dy * (padC / 1.7) - btn / 2, btn, btn, [d.a], '#12d4e0');
      const dx = padC + gap + btn * 0.4;
      const dy = cy;
      diamy = dy;
      for (const d of DIAMOND) {
        const b = d.big ? btn * 1.35 : btn;
        mkBtn(d.t, dx + d.dx * padC * 0.62 - b / 2, dy + d.dy * padC * 0.62 - b / 2, b, b, [d.a], d.big ? '#e0245e' : '#e8a93a');
      }
    }
    void baseY;

    // SPECIAL sits above the action diamond (never over the D-pad) so a thumb can reach both.
    const diamondX = leftSide ? W - padC - gap - btn * 0.4 : padC + gap + btn * 0.4;
    this.specialBtn = mkBtn('SPECIAL', diamondX - btn, diamy - padC * 1.15 - btn, btn * 2, btn, ['special'], '#e8a93a');
    this.specialBtn.style.display = 'none';
    this.pauseBtn = mkBtn('II', W / 2 - 14, 8, 28, 24, [], '#adb18c');
    this.pauseBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); onPause(); });
  }

  setSpecialVisible(v: boolean): void {
    if (this.specialBtn) this.specialBtn.style.display = v ? 'flex' : 'none';
  }

  setVisible(v: boolean): void {
    this.container.style.display = v ? 'block' : 'none';
  }

  destroy(): void {
    this.container.remove();
    this.active.clear();
  }
}
