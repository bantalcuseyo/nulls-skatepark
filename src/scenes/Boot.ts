import Phaser from 'phaser';
import { GAME_TITLE } from '../config';
import { computeLayout, type ViewLayout } from '../systems/Scaling';
import { detectProfile } from '../systems/PlatformProfile';
import type { PlatformProfileInfo } from '../sim/types';

export interface BootData {
  profile: PlatformProfileInfo;
  layout: ViewLayout;
}

/** M0 scene: shows the downscaled REF-ENV-2 as a static background plus the title and FPS overlay. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('ref_env_subway', 'assets/ref_scaled/ref_env_subway.png');
  }

  create(): void {
    const info = detectProfile();
    const layout = computeLayout(info.viewportW, info.viewportH, info.profile);
    this.registry.set('boot', { profile: info, layout } satisfies BootData);

    const cx = layout.virtualW / 2;
    this.add.image(cx, 135, 'ref_env_subway').setDisplaySize(480, 270).setOrigin(0.5);
    this.add
      .text(cx, 110, GAME_TITLE, { fontFamily: 'monospace', fontSize: '24px', color: '#12d4e0' })
      .setOrigin(0.5);
    this.add
      .text(cx, 140, `profile: ${info.profile}  scale: ${layout.scale}x`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#e0245e',
      })
      .setOrigin(0.5);

    this.events.emit('boot-ready', layout);
  }
}
