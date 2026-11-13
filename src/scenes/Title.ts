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
  private items: { label: PixelText; id: string; action: () => void; left?: number }[] = [];
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

  private addItem(id: string, text: string, y: number, action: () => void, tint = 0xf4f0e8, left?: number): void {
    const label = new PixelText(this, left ?? 0, y, text, 1).setTint(tint);
    if (left === undefined) label.obj.setPosition(Math.round((this.scale.width - label.width) / 2), y);
    const hit = label.obj.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.audio.unlock();
      const i = this.items.findIndex((it) => it.id === id);
      if (i >= 0) { this.idx = i; this.refresh(); action(); }
    });
    this.items.push({ label, id, action, left });
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
    this.titleText.obj.setPosition(Math.round((this.scale.width - this.titleText.width) / 2), 10);
    this.hint.setText('UP/DOWN SKATER   ENTER   ESC BACK');
    this.hint.obj.setPosition(8, 256);

    // Two explicit columns that cannot collide:
    //   left  x=14..176   -> the skater list
    //   right x=196..W-14 -> portrait panel, name, description, stats, special
    const LIST_X = 14;
    const LIST_Y = 44;
    const ROW_H = 18;
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
        this.audio.unlock();
        this.audio.play('menu_confirm');
        this.confirmChar(i);
      });
      this.items.push({ label: item, id: c.id, action: () => this.confirmChar(i), left: LIST_X });
    });
    // BACK lives in the list column under the skaters, not in the info column.
    this.addItem('back', strings.back, LIST_Y + charactersData.length * ROW_H + 8, () => this.showMain(), UI.grey, LIST_X);

    this.idx = Math.max(0, charactersData.findIndex((c) => c.id === this.selectedChar));
    this.refresh();
    this.showCharStats();
  }

  /**
   * Confirm the skater at `i`, which is whatever the cursor is on — not a hardcoded default.
   * Previously ENTER only ever launched RIFF because the action closures all captured index 0.
   */
  private confirmChar(i: number): void {
    const c = charactersData[i];
    if (!c) return;
    if (!this.save.isCharacterUnlocked(c.id, c.unlockGoals)) {
      this.audio.play('menu_back');
      this.showLocked(c.name, c.unlockGoals);
      return;
    }
    this.selectedChar = c.id;
    this.save.data.selectedCharacter = c.id;
    this.save.save();
    this.audio.play('menu_confirm');
    this.showLevels();
  }

  /** A locked skater must say what it needs, not silently do nothing. */
  private showLocked(name: string, need: number): void {
    this.hint.setText(`${name} NEEDS ${need} GOALS - YOU HAVE ${this.save.totalGoals()}`);
    this.hint.obj.setPosition(8, 256);
    this.time.delayedCall(1400, () => {
      if (this.screen === 'chars') {
        this.hint.setText('UP/DOWN SKATER   ENTER   ESC BACK').setVisible(true);
        this.hint.obj.setPosition(8, 256);
      }
    });
  }

  private statGfx?: Phaser.GameObjects.Graphics;

  /** Right-hand info column: portrait, name, description, stat rows. Rebuilt from scratch each time. */
  private showCharStats(): void {
    // BACK sits in the list after the four skaters, so the cursor can point past the roster.
    const c = charactersData[this.idx] ?? charactersData.find((x) => x.id === this.selectedChar) ?? charactersData[0];
    if (this.screen !== 'chars') return;

    // Destroy everything this panel owns first — leftover text from the previous skater is exactly
    // the "ghost text" that made the screen look broken.
    this.statGfx?.destroy();
    this.statGfx = undefined;
    for (const l of this.statLabels ?? []) l.destroy();
    this.statLabels = [];
    this.portrait?.destroy();

    const W = this.scale.width;
    // Two explicit columns, and BOTH sit on opaque plates. Without a plate on the list column the
    // alley's maroon ARCADE neon showed through the rows and read as a fake selection highlight —
    // the "ARCADE PRISM" ghost. Column 2 is the right edge of the list plate.
    const plateX = 196;

    // Opaque plates: the environment art must never fight the text.
    const g = this.add.graphics().setDepth(1000);
    this.statGfx = g;
    g.fillStyle(UI.bgPanel, 0.94);
    g.fillRect(10, 40, plateX - 20, 168);                    // list column
    g.lineStyle(1, UI.cyan, 0.45);
    g.strokeRect(10.5, 40.5, plateX - 21, 167);
    g.fillStyle(UI.bgPanel, 0.94);
    g.fillRect(plateX, 40, W - 12 - plateX, 196);            // info column
    g.lineStyle(1, UI.cyan, 0.45);
    g.strokeRect(plateX + 0.5, 40.5, W - 13 - plateX, 195);

    // Portrait: the owner's own head crop, 2x, on a framed plate. No redraw.
    const portSize = 64;
    const portCX = plateX + 42;
    g.fillStyle(UI.ink, 1);
    g.fillRect(portCX - portSize / 2 - 2, 46, portSize + 4, portSize + 4);
    g.lineStyle(1, c.hud.nameColour, 0.9);
    g.strokeRect(portCX - portSize / 2 - 1.5, 46.5, portSize + 3, portSize + 3);
    this.portrait = this.add.image(portCX, 46 + portSize / 2 + 1, `head_${c.id}_2x`)
      .setOrigin(0.5, 0.5).setDisplaySize(portSize, portSize).setDepth(1001);

    // Text column: everything to the RIGHT of the portrait, all left-aligned on one x so nothing
    // can spill outside the plate.
    const tx = portCX + portSize / 2 + 10;
    const name = new PixelText(this, tx, 50, c.name, UI.h2, 'cyan');
    (this.statLabels ??= []).push(name);

    const desc = new PixelText(this, tx, 68, c.desc, UI.micro, 'grey');
    desc.setText(this.wrap(c.desc, Math.floor((W - 12 - tx) / 6)));
    (this.statLabels ??= []).push(desc);

    const rows: Array<[string, number]> = [['SPD', c.stats.speed], ['AIR', c.stats.air], ['BAL', c.stats.balance], ['FLP', c.stats.flip]];
    const rowY = 100;
    const rowH = 13;
    rows.forEach(([label, v], i) => {
      const y = rowY + i * rowH;
      const t = new PixelText(this, tx, y, label, UI.micro, 'cyan');
      (this.statLabels ??= []).push(t);
      for (let k = 0; k < 5; k++) {
        const x = tx + 30 + k * 9;
        g.fillStyle(k < v ? UI.amber : UI.dim, 1);
        g.fillRect(x, y, 7, 6);
      }
      const val = new PixelText(this, tx + 30 + 5 * 9 + 6, y, String(v), UI.micro, 'cream');
      (this.statLabels ??= []).push(val);
    });

    // SPECIAL in the character's own colour, wrapped inside the plate.
    const sp = new PixelText(this, tx, rowY + rows.length * rowH + 8, `SPECIAL: ${c.special}`, UI.micro, 'cream');
    sp.setText(this.wrap(`SPECIAL: ${c.special}`, Math.floor((W - 12 - tx) / 6)));
    (this.statLabels ??= []).push(sp);

    // Unlock requirement, always visible so a locked skater explains itself before it is tried.
    const unlocked = this.save.isCharacterUnlocked(c.id, c.unlockGoals);
    const lock = new PixelText(this, tx, rowY + rows.length * rowH + 24,
      unlocked ? 'UNLOCKED' : `NEEDS ${c.unlockGoals} GOALS`, UI.micro, unlocked ? 'green' : 'magenta');
    (this.statLabels ??= []).push(lock);

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
    if (it) it.action();
  }

  private refresh(): void {
    this.items.forEach((it, i) => {
      const focused = i === this.idx;
      const text = it.label.obj.text.replace(/^[><] /, '').replace(/^  /, '');
      it.label.setText(focused ? `> ${text}` : `  ${text}`);
      // Left-column items stay pinned to their column; centred menus re-centre every refresh.
      const x = it.left !== undefined ? it.left : Math.round((this.scale.width - it.label.width) / 2);
      it.label.obj.setPosition(x, it.label.obj.y);
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
