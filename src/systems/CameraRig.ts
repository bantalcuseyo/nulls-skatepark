import Phaser from 'phaser';

/** Smooth camera follow with speed-scaled look-ahead, vertical dead zone, whole-pixel snap. */
export class CameraRig {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private lookX = 0;
  private shakeTrauma = 0;
  private t = 0;
  reduceShake = false;

  constructor(scene: Phaser.Scene, private worldW: number) {
    this.cam = scene.cameras.main;
    this.cam.setBounds(0, -80, worldW, 400);
  }

  follow(x: number, y: number, vx: number, facing: number, dt: number): void {
    this.t += dt;
    const targetLook = facing * (30 + Math.min(60, Math.abs(vx) * 0.25));
    this.lookX += (targetLook - this.lookX) * Math.min(1, 4 * dt);
    const vw = this.cam.width;
    let tx = x + this.lookX - vw / 2;
    tx = Math.max(0, Math.min(this.worldW - vw, tx));

    // vertical dead zone: only move when the skater leaves a 60 px band
    const centerY = this.cam.scrollY + this.cam.height / 2;
    const dy = y - 30 - centerY;
    let ty = this.cam.scrollY;
    if (Math.abs(dy) > 30) ty += dy - Math.sign(dy) * 30;
    ty = Math.max(-80, Math.min(30, ty));

    this.cam.scrollX += (tx - this.cam.scrollX) * Math.min(1, 9 * dt);
    this.cam.scrollY += (ty - this.cam.scrollY) * Math.min(1, 7 * dt);

    if (this.shakeTrauma > 0) this.shakeTrauma = Math.max(0, this.shakeTrauma - 1.6 * dt);
    const s = this.reduceShake ? 0 : this.shakeTrauma * this.shakeTrauma;
    const sx = Math.round(this.cam.scrollX + 5 * s * Math.sin(this.t * 37));
    const sy = Math.round(this.cam.scrollY + 4 * s * Math.sin(this.t * 53));
    this.cam.setScroll(sx, sy);
  }

  shake(amount: number): void {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  snap(x: number): void {
    this.cam.scrollX = Math.max(0, Math.min(this.worldW - this.cam.width, x - this.cam.width / 2));
  }
}
