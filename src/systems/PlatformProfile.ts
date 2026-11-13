import type { DeviceProfile, PlatformProfileInfo } from '../sim/types';

const OVERRIDE_KEY = 'nulls.profileOverride';

/** Detects desktop vs phone at boot. A manual override (auto | desktop | phone) wins. */
export function detectProfile(win: Window = window): PlatformProfileInfo {
  // ?profile=phone|desktop forces a profile (dev + the human's real-device checks on desktop).
  const qp = new URLSearchParams(win.location?.search ?? '').get('profile');
  if (qp === 'phone' || qp === 'desktop') {
    writeOverride(qp);
  } else if (qp === 'auto') {
    writeOverride('auto');
  }
  const forced = qp === 'phone' || qp === 'desktop' ? qp : null;
  const touch = forced === 'phone' || 'ontouchstart' in win || (navigator.maxTouchPoints ?? 0) > 0;
  const w = win.innerWidth;
  const h = win.innerHeight;
  const landscape = w >= h;
  const override = forced ?? readOverride();
  let profile: DeviceProfile;
  if (override === 'desktop' || override === 'phone') {
    profile = override;
  } else {
    profile = touch && Math.min(w, h) < 900 && landscape ? 'phone' : 'desktop';
  }
  return { profile, touch, viewportW: w, viewportH: h };
}

export function readOverride(): 'auto' | 'desktop' | 'phone' {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v === 'desktop' || v === 'phone' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeOverride(v: 'auto' | 'desktop' | 'phone'): void {
  try {
    if (v === 'auto') localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, v);
  } catch {
    /* storage blocked: override stays in memory only */
  }
}
