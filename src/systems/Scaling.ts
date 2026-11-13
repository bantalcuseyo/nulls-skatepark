import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH_DESKTOP, VIRTUAL_WIDTH_PHONE_MAX, VIRTUAL_WIDTH_PHONE_MIN } from '../config';
import type { DeviceProfile } from '../sim/types';

export interface ViewLayout {
  virtualW: number;
  virtualH: number;
  /** Integer scale factor applied to the virtual canvas. */
  scale: number;
  /** Canvas display size in CSS px. */
  displayW: number;
  displayH: number;
}

/**
 * Largest integer scale that fits the viewport at a fixed virtual height of 270.
 * Desktop: width fixed at 480 (letterboxed). Phone: width flexes between 480 and 576 so the
 * canvas fills the viewport with no large black bars; gameplay stays in the central 480 px.
 */
export function computeLayout(viewW: number, viewH: number, profile: DeviceProfile): ViewLayout {
  const scaleH = Math.floor(viewH / VIRTUAL_HEIGHT);
  if (profile === 'desktop') {
    const scaleW = Math.floor(viewW / VIRTUAL_WIDTH_DESKTOP);
    const scale = Math.max(1, Math.min(scaleH, scaleW));
    return {
      virtualW: VIRTUAL_WIDTH_DESKTOP,
      virtualH: VIRTUAL_HEIGHT,
      scale,
      displayW: VIRTUAL_WIDTH_DESKTOP * scale,
      displayH: VIRTUAL_HEIGHT * scale,
    };
  }
  const scale = Math.max(1, scaleH);
  const naturalW = Math.floor(viewW / scale);
  const virtualW = Math.min(VIRTUAL_WIDTH_PHONE_MAX, Math.max(VIRTUAL_WIDTH_PHONE_MIN, naturalW));
  return {
    virtualW,
    virtualH: VIRTUAL_HEIGHT,
    scale,
    displayW: virtualW * scale,
    displayH: VIRTUAL_HEIGHT * scale,
  };
}
