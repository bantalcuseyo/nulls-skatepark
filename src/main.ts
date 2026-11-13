import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { computeLayout } from './systems/Scaling';
import { detectProfile } from './systems/PlatformProfile';
import { VIRTUAL_HEIGHT } from './config';

// Layout is computed once at boot. Resize re-applies the scale and the phone width.
(window as unknown as { __boot: number }).__boot = 1;
window.addEventListener('error', (e) => {
  (window as unknown as { __err: string }).__err = String(e.message || e.error || 'unknown');
});
const info = detectProfile();
const layout = computeLayout(info.viewportW, info.viewportH, info.profile);

// AUTO picks WebGL when available and falls back to Canvas 2D (headless, old drivers).
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: layout.virtualW,
  height: VIRTUAL_HEIGHT,
  backgroundColor: '#0c1226',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [Boot],
});

function applyScale(): void {
  const p = detectProfile();
  const l = computeLayout(p.viewportW, p.viewportH, p.profile);
  const canvas = game.canvas;
  game.scale.resize(l.virtualW, VIRTUAL_HEIGHT);
  canvas.style.width = `${l.displayW}px`;
  canvas.style.height = `${l.displayH}px`;
  canvas.style.left = `${Math.floor((p.viewportW - l.displayW) / 2)}px`;
  canvas.style.top = `${Math.floor((p.viewportH - l.displayH) / 2)}px`;
}

applyScale();
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', applyScale);

// Block pinch/double-tap zoom and long-press menus on touch devices (brief section 3.1).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
