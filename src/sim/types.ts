// Tier H owns this file: public interfaces and the input contract (brief section 12, M0).
// Other tiers must not change these shapes without a note in DECISIONS.md.

/** Every discrete action the game reads. Keyboard, gamepad and touch all map to these. */
export type InputAction =
  | 'pushForward'
  | 'brakeBack'
  | 'crouch'
  | 'manualUp'
  | 'ollie'
  | 'flip'
  | 'grab'
  | 'grind'
  | 'special'
  | 'pause'
  | 'restart';

/** Per-frame snapshot consumed by the simulation. Pure data, no Phaser types. */
export interface InputFrame {
  /** Held state for each action this sim tick. */
  held: Readonly<Record<InputAction, boolean>>;
  /** Pressed-this-tick (edge) state for each action. */
  pressed: Readonly<Record<InputAction, boolean>>;
  /** Direction for tricks: -1 back, 0 neutral, 1 forward (horizontal). */
  dirX: -1 | 0 | 1;
  /** Direction for tricks: -1 down, 0 neutral, 1 up (vertical). */
  dirY: -1 | 0 | 1;
}

export type DeviceProfile = 'desktop' | 'phone';

export interface PlatformProfileInfo {
  profile: DeviceProfile;
  touch: boolean;
  viewportW: number;
  viewportH: number;
}

export function emptyInputFrame(): InputFrame {
  const none = (): Record<InputAction, boolean> => ({
    pushForward: false,
    brakeBack: false,
    crouch: false,
    manualUp: false,
    ollie: false,
    flip: false,
    grab: false,
    grind: false,
    special: false,
    pause: false,
    restart: false,
  });
  return { held: none(), pressed: none(), dirX: 0, dirY: 0 };
}

/** Fixed-step timing used by the sim. */
export interface SimTiming {
  tick: number;
  dt: number;
}
