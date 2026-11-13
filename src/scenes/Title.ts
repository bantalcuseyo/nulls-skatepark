import Phaser from 'phaser';
import { PixelText } from '../systems/PixelText';
import { AudioManager } from '../systems/AudioManager';
import type { SaveSystem } from '../systems/SaveSystem';
import charactersData from '../data/characters.json';
import strings from '../strings/en.json';
import { GAME_TITLE } from '../config';
import { UI } from '../systems/Theme';
import { LEVEL_ORDER, LEVELS } from './Game';

type Screen = 'main' | 'chars' | 'levels' | 'settings' | 'credits';

/** Title + main menu + character select + level select + settings, all keyboard/gamepad/touch. */
export class Title extends Phaser.Scene {
  private bg!: Phaser.GameObjects.TileSprite;
  private titleText!: PixelText;
  private items: { label: PixelText; id: string; action: () => void }[] = [];
  private hint!: PixelText;
  private idx = 0;
  private screen: Screen = 'main';
  private audio!: AudioManager;
  private save!: SaveSystem;
  private selectedChar = 'riff';
  private freeSkate = false;
  private t = 0;
  private statText!: PixelText;
  private portrait!: Phaser.GameObjects.Image;
  private flickerT = 0;

  constructor() { super('Title'); }

  create(): void {
    this.audio = (this.game as unknown as { audio: AudioManager }).audio;
    this.save = (this.game as unknown as { save: SaveSystem }).save;
    this.selectedChar = this.save.data.selectedCharacter ?? 'riff';
    this.cameras.main.setScroll(0, 0);

    this.bg = this.add.tileSprite(0, 0, this.scale.width, 270, 'alley_near').setOrigin(0, 0).setAlpha(0.9);
    this.add.rectangle(0, 0, this.scale.width, 270, 0x0c1226, 0.35).setOrigin(0, 0);
    this.titleText = new PixelText(this, 0, 26, GAME_TITLE, 2).setTint(0x12d4e0);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 26);
    this.hint = new PixelText(this, 8, 254, strings.pressStart, 1).setTint(0xadb18c);
    this.statText = new PixelText(this, 0, 0, '', 1).setTint(0xadb18c);
    this.showMain();

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.choose());
    this.input.keyboard?.on('keydown-SPACE', () => this.choose());
    this.input.keyboard?.on('keydown-Z', () => this.choose());
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-LEFT', () => this.adjust(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.adjust(1));
    this.audio.startMusic('menu');
  }

  private clearItems(): void {
    this.statGfx?.destroy();
    this.statGfx = undefined;
    for (const l of this.statLabels ?? []) l.destroy();
    this.statLabels = [];
    for (const i of this.items) i.label.destroy();
    this.items = [];
    this.portrait?.destroy();
  }

  private addItem(id: string, text: string, y: number, action: () => void, tint = 0xf4f0e8): void {
    const label = new PixelText(this, 0, y, text, 1).setTint(tint);
    label.obj.setPosition(Math.round((this.scale.width - label.width) / 2), y);
    const hit = label.obj.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.audio.unlock();
      const i = this.items.findIndex((it) => it.id === id);
      if (i >= 0) { this.idx = i; this.refresh(); action(); }
    });
    this.items.push({ label, id, action });
  }

  private showMain(): void {
    this.screen = 'main';
    this.clearItems();
    this.titleText.setText(GAME_TITLE).setVisible(true);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 26);
    this.hint.setText('ARROWS + ENTER / TAP').setVisible(true);
    const startY = 92;
    this.addItem('career', strings.career, startY, () => { this.freeSkate = false; this.showChars(); });
    this.addItem('free', strings.freeskate, startY + 22, () => { this.freeSkate = true; this.showChars(); });
    this.addItem('settings', strings.settings, startY + 44, () => this.showSettings());
    this.addItem('credits', strings.credits, startY + 66, () => this.showCredits());
    this.addItem('goals', `GOALS COMPLETE: ${this.save.totalGoals()}`, startY + 100, () => undefined, 0xadb18c);
    // First impression must be the skater, not just text: show the selected character's portrait
    // on the title menu, to the left of the menu column.
    this.portrait?.destroy();
    const pid = this.save.data.selectedCharacter ?? 'riff';
    this.portrait = this.add.image(Math.round(this.scale.width * 0.24), 150, `portrait_${pid}`)
      .setOrigin(0.5, 0.5).setDisplaySize(104, 104).setDepth(1001);
    this.idx = 0;
    this.refresh();
  }

  private showChars(): void {
    this.screen = 'chars';
    this.clearItems();
    this.titleText.setText(strings.charSelect).setVisible(true);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 12);
    this.hint.setText('UP/DOWN SKATER   ENTER   ESC BACK');
    this.hint.obj.setPosition(8, 256);

    // Two explicit columns that cannot collide:
    //   left  x=16..190  -> the skater list
    //   right x=210..W-16 -> portrait, name, description, stats
    const LIST_X = 16;
    const LIST_Y = 48;
    const ROW_H = 20;
    charactersData.forEach((c, i) => {
      const unlocked = this.save.isCharacterUnlocked(c.id, c.unlockGoals);
      const label = unlocked ? c.name : `${c.name} ${c.unlockGoals}`;
      const y = LIST_Y + i * ROW_H;
      const item = new PixelText(this, LIST_X, y, `  ${label}`, UI.micro)
        .setTint(unlocked ? UI.cream : UI.dim).setDepth(1002);
      item.obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.idx = i;
        this.refresh();
        this.showCharStats();
        if (unlocked) this.choose();
      });
      this.items.push({ label: item, id: c.id, action: () => {
        if (!unlocked) return;
        this.selectedChar = c.id;
        this.save.data.selectedCharacter = c.id;
        this.save.save();
        this.audio.play('menu_confirm');
        this.showLevels();
      } });
    });
    // BACK lives in the list column under the skaters, not in the info column.
    this.addItem('back', strings.back, 48 + charactersData.length * 20 + 8, () => this.showMain(), UI.grey);

    this.idx = Math.max(0, charactersData.findIndex((c) => c.id === this.selectedChar));
    this.refresh();
    this.showCharStats();
  }

  private statGfx?: Phaser.GameObjects.Graphics;

  /** Right-hand info column: portrait, name, description, stat rows. Rebuilt from scratch each time. */
  private showCharStats(): void {
    const c = charactersData[this.idx] ?? charactersData[0];
    if (this.screen !== 'chars') return;

    // Destroy everything this panel owns first — leftover text from the previous skater is exactly
    // the "ghost text" that made the screen look broken.
    this.statGfx?.destroy();
    this.statGfx = undefined;
    for (const l of this.statLabels ?? []) l.destroy();
    this.statLabels = [];
    this.portrait?.destroy();

    const W = this.scale.width;
    const colX = Math.round(W * 0.63);          // right column centre
    const colW = W - colX - 12;                 // usable width to the right edge

    this.portrait = this.add.image(colX, 104, `portrait_${c.id}`)
      .setOrigin(0.5, 0.5).setDisplaySize(78, 78).setDepth(1001);

    const name = new PixelText(this, 0, 148, c.name, UI.h2).setTint(UI.cream).setDepth(1002);
    name.obj.setPosition(Math.round(colX - name.width / 2), 148);
    (this.statLabels ??= []).push(name);

    const desc = new PixelText(this, 0, 162, c.desc, UI.micro).setTint(UI.grey).setDepth(1002);
    // wrap the description to the column so it never runs under the list column
    desc.setText(this.wrap(c.desc, Math.floor(colW / 6)));
    desc.obj.setPosition(Math.round(colX - desc.width / 2), 162);
    (this.statLabels ??= []).push(desc);

    const g = this.add.graphics().setDepth(1001);
    this.statGfx = g;
    const rows: Array<[string, number]> = [['SPD', c.stats.speed], ['AIR', c.stats.air], ['BAL', c.stats.balance], ['FLP', c.stats.flip]];
    const rowY = 182;
    const rowH = 10;
    const labelX = colX - 42;
    const barX = colX - 18;
    rows.forEach(([, v], i) => {
      const y = rowY + i * rowH;
      for (let k = 0; k < 5; k++) {
        const x = barX + k * 8;
        g.fillStyle(k < v ? UI.amber : UI.dim, 1);
        g.fillRect(x, y, 6, 5);
      }
      const t = new PixelText(this, labelX, y - 1, rows[i][0], UI.micro).setTint(UI.cyan).setDepth(1002);
      (this.statLabels ??= []).push(t);
    });

    const sp = new PixelText(this, 0, rowY + rows.length * rowH + 6, `SPECIAL: ${c.special}`, UI.micro)
      .setTint(UI.green).setDepth(1002);
    sp.setText(this.wrap(`SPECIAL: ${c.special}`, Math.floor(colW / 6)));
    sp.obj.setPosition(Math.round(colX - sp.width / 2), rowY + rows.length * rowH + 6);
    (this.statLabels ??= []).push(sp);

    this.auditOverlaps();
  }

  /** Greedy word wrap for the bitmap font (no built-in wrapping). */
  private wrap(text: string, maxChars: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
  }

  /**
   * Runtime readability audit: fails loudly if any two text blocks in the character panel overlap.
   * This is the check that was missing — the character list used to run straight through the name
   * line and nothing detected it.
   */
  private auditOverlaps(): void {
    // Scan EVERY visible text object in the scene, so a stray hint or button that lands on another
    // block is caught here instead of by the player.
    const sceneTexts = this.children.list
      .filter((o) => o.type === 'BitmapText' && (o as PixelText['obj']).visible && (o as PixelText['obj']).text)
      .map((o) => {
        const b = o as PixelText['obj'];
        return { label: b.text, x: b.x, y: b.y, w: b.width, h: b.height };
      });
    const boxes = sceneTexts.length ? sceneTexts : (this.statLabels ?? []).map((t) => ({
      label: t.obj.text,
      x: t.obj.x, y: t.obj.y, w: t.obj.width, h: t.obj.height,
    }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        if (overlap) {
          console.warn('[UI OVERLAP]', a.label, 'vs', b.label);
          (window as unknown as { __uiOverlaps?: string[] }).__uiOverlaps ??= [];
          (window as unknown as { __uiOverlaps: string[] }).__uiOverlaps.push(`${a.label}|${b.label}`);
        }
      }
    }
  }

  private statLabels?: PixelText[];

  private showLevels(): void {
    this.screen = 'levels';
    this.clearItems();
    this.titleText.setText(strings.levelSelect);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 20);
    LEVEL_ORDER.forEach((id, i) => {
      const def = LEVELS[id];
      const unlocked = this.save.isLevelUnlocked(id, i);
      const best = this.save.data.scores[id] ?? 0;
      const done = this.save.levelGoals(id);
      const label = unlocked
        ? `${def.name}  ${done}/6  BEST ${best}`
        : `${def.name} (${strings.locked}: ${i === 1 ? 3 : 8})`;
      this.addItem(id, label, 80 + i * 34, () => {
        if (!unlocked) return;
        this.audio.play('menu_confirm');
        this.scene.start('Game', { levelId: id, characterId: this.selectedChar, freeSkate: this.freeSkate });
      }, unlocked ? 0xf4f0e8 : 0x53514a);
    });
    this.idx = 0;
    this.refresh();
  }

  private showSettings(): void {
    this.screen = 'settings';
    this.clearItems();
    this.titleText.setText(strings.settings);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 20);
    const s = this.save.data.settings;
    const opts: Array<{ id: string; label: () => string; change: (d: number) => void }> = [
      { id: 'master', label: () => `${strings.master} ${Math.round(s.master * 10)}`, change: (d) => { s.master = clamp01(s.master + d * 0.1); this.audio.setVolume('master', s.master); } },
      { id: 'music', label: () => `${strings.music} ${Math.round(s.music * 10)}`, change: (d) => { s.music = clamp01(s.music + d * 0.1); this.audio.setVolume('music', s.music); } },
      { id: 'sfx', label: () => `${strings.sfx} ${Math.round(s.sfx * 10)}`, change: (d) => { s.sfx = clamp01(s.sfx + d * 0.1); this.audio.setVolume('sfx', s.sfx); } },
      { id: 'shake', label: () => `${strings.shake} ${Math.round(s.shake * 10)}`, change: (d) => { s.shake = clamp01(s.shake + d * 0.1); } },
      { id: 'flash', label: () => `${strings.reduceFlash} ${s.reduceFlash ? strings.on : strings.off}`, change: () => { s.reduceFlash = !s.reduceFlash; } },
      { id: 'crt', label: () => `${strings.crt} ${s.crt ? strings.on : strings.off}`, change: () => { s.crt = !s.crt; } },
      { id: 'assist', label: () => `${strings.assist} ${s.assist ? strings.on : strings.off}`, change: () => { s.assist = !s.assist; } },
      { id: 'left', label: () => `${strings.leftHanded} ${s.leftHanded ? strings.on : strings.off}`, change: () => { s.leftHanded = !s.leftHanded; } },
    ];
    opts.forEach((o, i) => {
      this.addItem(o.id, o.label(), 56 + i * 18, () => { o.change(1); this.save.save(); this.showSettings(); });
    });
    this.addItem('reset', strings.resetSave, 56 + opts.length * 18 + 10, () => { this.save.reset(); this.showSettings(); }, 0xe0245e);
    this.idx = 0;
    this.refresh();
  }

  private showCredits(): void {
    this.screen = 'credits';
    this.clearItems();
    this.titleText.setText(strings.credits);
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 20);
    this.statText.setText('NULLS SKATEPARK\n\nCODE, ART, MUSIC: PROCEDURAL\nENGINE: PHASER 3 (MIT)\nFONT: ORIGINAL 5X7 BITMAP\n\nNO COPYRIGHTED ASSETS.\nALL FOUR SKATERS ARE ORIGINAL.');
    this.statText.obj.setPosition(Math.round((this.scale.width - this.statText.width) / 2), 70);
    this.addItem('back', strings.back, 220, () => this.showMain());
    this.idx = 0;
    this.refresh();
  }

  private back(): void {
    this.audio.play('menu_back');
    if (this.screen === 'main') return;
    if (this.screen === 'levels') this.showChars();
    else this.showMain();
  }

  private move(d: number): void {
    this.audio.unlock();
    if (!this.items.length) return;
    this.idx = (this.idx + d + this.items.length) % this.items.length;
    this.audio.play('menu_move');
    this.refresh();
    this.showCharStats();
  }

  private adjust(d: number): void {
    if (this.screen === 'settings') this.choose();
    else if (this.screen === 'chars') this.move(d);
  }

  private choose(): void {
    this.audio.unlock();
    const it = this.items[this.idx];
    if (it) { this.audio.play('menu_confirm'); it.action(); }
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      const focused = i === this.idx;
      const text = it.label.obj.text.replace(/^[><] /, '').replace(/^  /, '');
      it.label.setText(focused ? `> ${text}` : `  ${text}`);
      it.label.obj.setPosition(Math.round((this.scale.width - it.label.width) / 2), it.label.obj.y);
      it.label.setAlpha(focused ? 1 : 0.7);
    });
  }

  update(_t: number, dtMs: number): void {
    this.t += dtMs / 1000;
    this.flickerT += dtMs / 1000;
    this.bg.tilePositionX += dtMs * 0.006;
    // neon flicker on the title
    const flicker = Math.sin(this.t * 2.3) > 0.96 ? 0.6 : 1;
    this.titleText.setAlpha(flicker);
    this.hint.setAlpha(Math.sin(this.t * 3) > 0 ? 1 : 0.4);
  }
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
