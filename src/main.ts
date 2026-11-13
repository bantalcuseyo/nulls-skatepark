import Phaser from 'phaser';
import { Preload } from './scenes/Preload';
import { Title } from './scenes/Title';
import { Game } from './scenes/Game';
import { Hud } from './scenes/Hud';
import { Pause } from './scenes/Pause';
import { Results } from './scenes/Results';
import { computeLayout } from './systems/Scaling';
import { detectProfile } from './systems/PlatformProfile';
import { InputManager } from './systems/InputManager';
import { AudioManager } from './systems/AudioManager';
import { SaveSystem } from './systems/SaveSystem';
import { VIRTUAL_HEIGHT } from './config';

(window as unknown as { __boot: number }).__boot = 1;
window.addEventListener('error', (e) => {
  (window as unknown as { __err: string }).__err = String(e.message || e.error || 'unknown');
});

const info = detectProfile();
const layout = computeLayout(info.viewportW, info.viewportH, info.profile);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: layout.virtualW,
  height: VIRTUAL_HEIGHT,
  backgroundColor: '#0c1226',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  fps: { target: 60, forceSetTimeOut: false },
  render: { powerPreference: 'high-performance' },
  scene: [Preload, Title, Game, Hud, Pause, Results],
});

// Shared singletons, reachable from every scene via this.game.
const audio = new AudioManager();
const save = new SaveSystem();
save.load();
const inputMgr = new InputManager(window);
inputMgr.attach();
Object.assign(game, { audio, save, inputMgr });
(window as unknown as { __phaserGame: Phaser.Game }).__phaserGame = game;

// Audio unlocks on the first user gesture; iOS resumes after visibility changes.
const unlock = (): void => audio.unlock();
window.addEventListener('keydown', unlock, { once: false });
window.addEventListener('pointerdown', unlock, { once: false });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.loop.sleep();
  } else {
    game.loop.wake();
    audio.resume();
  }
});

// Portrait on a phone: pause and ask for landscape.
const rotateEl = document.createElement('div');
rotateEl.style.cssText = `position:fixed;inset:0;background:#0c1226;color:#12d4e0;z-index:50;
  display:none;align-items:center;justify-content:center;font:16px monospace;letter-spacing:2px;text-align:center;`;
rotateEl.textContent = 'ROTATE YOUR DEVICE';
document.body.appendChild(rotateEl);

function applyScale(): void {
  const p = detectProfile();
  const l = computeLayout(p.viewportW, p.viewportH, p.profile);
  const canvas = game.canvas;
  if (!canvas) return;
  game.scale.resize(l.virtualW, VIRTUAL_HEIGHT);
  canvas.style.width = `${l.displayW}px`;
  canvas.style.height = `${l.displayH}px`;
  canvas.style.left = `${Math.floor((p.viewportW - l.displayW) / 2)}px`;
  canvas.style.top = `${Math.floor((p.viewportH - l.displayH) / 2)}px`;
  const portrait = p.profile === 'phone' && p.viewportH > p.viewportW;
  rotateEl.style.display = portrait ? 'flex' : 'none';
  if (portrait) game.loop.sleep();
  else if (!document.hidden) game.loop.wake();
}

applyScale();
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', () => setTimeout(applyScale, 100));

// Block pinch / double-tap zoom / pull-to-refresh / long-press menus (brief section 3.1).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault();
});

// Offline PWA: register the service worker only in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
