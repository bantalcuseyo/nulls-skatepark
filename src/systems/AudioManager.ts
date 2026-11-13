/** Procedural audio: master/music/SFX buses, WebAudio synth SFX and a step-sequenced loop.
 *  No samples, no third-party audio. Unlocks on the first user gesture. */
export class AudioManager {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private rollSrc: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private grindSrc: AudioBufferSourceNode | null = null;
  private grindGain: GainNode | null = null;
  private grindFilter: BiquadFilterNode | null = null;
  private seqTimer: number | null = null;
  private seqStep = 0;
  private nextNoteTime = 0;
  private currentSong = '';
  private bpm = 96;
  private started = false;
  volume = { master: 0.8, music: 0.6, sfx: 0.9 };

  unlock(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume.master;
    this.master.connect(this.ctx.destination);
    // soft limiter so nothing clips
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 8;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    comp.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volume.music * 0.5;
    this.musicBus.connect(comp);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.volume.sfx;
    this.sfxBus.connect(comp);
    this.noiseBuf = this.makeNoise();
    this.started = true;
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolume(kind: 'master' | 'music' | 'sfx', v: number): void {
    this.volume[kind] = v;
    if (kind === 'master' && this.master) this.master.gain.value = v;
    if (kind === 'music' && this.musicBus) this.musicBus.gain.value = v * 0.5;
    if (kind === 'sfx' && this.sfxBus) this.sfxBus.gain.value = v;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.5 + last * 0.5;
    }
    return buf;
  }

  private env(g: GainNode, t: number, a: number, d: number, peak: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'square', peak = 0.25, slideTo?: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    this.env(g, t, 0.004, dur, peak);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, filterFreq: number, peak = 0.3, type: BiquadFilterType = 'bandpass', slideTo?: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    f.Q.value = 1.1;
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, dur, peak);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  play(name: string): void {
    if (!this.started) return;
    switch (name) {
      case 'push': this.noise(0.12, 900, 0.12); this.blip(70, 0.09, 'sine', 0.15); break;
      case 'ollie': this.noise(0.07, 1600, 0.2, 'highpass'); this.blip(220, 0.1, 'triangle', 0.2, 90); break;
      case 'land': this.blip(90, 0.12, 'sine', 0.4, 45); this.noise(0.08, 500, 0.2, 'lowpass'); break;
      case 'land_clean': this.blip(90, 0.1, 'sine', 0.4, 45); this.blip(440, 0.07, 'square', 0.1); break;
      case 'land_sketchy': this.noise(0.18, 700, 0.25); this.blip(120, 0.15, 'sawtooth', 0.15, 60); break;
      case 'flip': this.noise(0.16, 1200, 0.15, 'bandpass', 3200); break;
      case 'grab': this.blip(520, 0.06, 'square', 0.12); break;
      case 'grind_start': this.noise(0.1, 2600, 0.3, 'highpass'); this.blip(180, 0.06, 'sawtooth', 0.12); break;
      case 'grind_end': this.noise(0.06, 1500, 0.15); break;
      case 'manual': this.blip(300, 0.04, 'triangle', 0.12); break;
      case 'bail': this.blip(70, 0.25, 'sine', 0.5, 35); this.noise(0.3, 400, 0.35, 'lowpass'); break;
      case 'bank': this.blip(660, 0.07, 'square', 0.2); setTimeout(() => this.blip(990, 0.12, 'square', 0.2), 70); break;
      case 'letter': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.09, 'square', 0.16), i * 60)); break;
      case 'gap': this.blip(330, 0.08, 'square', 0.2); setTimeout(() => this.blip(660, 0.15, 'square', 0.22), 80); break;
      case 'special': [440, 554, 659, 880, 1108].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'sawtooth', 0.14), i * 55)); break;
      case 'menu_move': this.blip(700, 0.03, 'square', 0.08); break;
      case 'menu_confirm': this.blip(880, 0.06, 'square', 0.15); setTimeout(() => this.blip(1320, 0.07, 'square', 0.1), 60); break;
      case 'menu_back': this.blip(440, 0.06, 'square', 0.12); break;
      case 'goal': [659, 784, 988, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.18), i * 80)); break;
      case 'train': this.noise(2.2, 200, 0.25, 'lowpass', 600); break;
      case 'tick': this.blip(1200, 0.02, 'square', 0.05); break;
      case 'secret': [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.1, 'triangle', 0.2), i * 70)); break;
      default: break;
    }
  }

  /** Board roll loop, pitch by speed (0..1). */
  setRoll(active: boolean, speed: number, grinding: boolean): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return;
    if (active && !this.rollSrc) {
      this.rollSrc = this.ctx.createBufferSource();
      this.rollSrc.buffer = this.noiseBuf;
      this.rollSrc.loop = true;
      this.rollFilter = this.ctx.createBiquadFilter();
      this.rollFilter.type = 'lowpass';
      this.rollGain = this.ctx.createGain();
      this.rollGain.gain.value = 0;
      this.rollSrc.connect(this.rollFilter);
      this.rollFilter.connect(this.rollGain);
      this.rollGain.connect(this.sfxBus);
      this.rollSrc.start();
    }
    if (this.rollSrc && this.rollGain && this.rollFilter) {
      const target = active && !grinding ? 0.03 + speed * 0.09 : 0;
      this.rollGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      this.rollFilter.frequency.setTargetAtTime(300 + speed * 1400, this.ctx.currentTime, 0.05);
    }
    if (grinding && !this.grindSrc) {
      this.grindSrc = this.ctx.createBufferSource();
      this.grindSrc.buffer = this.noiseBuf;
      this.grindSrc.loop = true;
      this.grindFilter = this.ctx.createBiquadFilter();
      this.grindFilter.type = 'bandpass';
      this.grindFilter.frequency.value = 2200;
      this.grindFilter.Q.value = 2;
      this.grindGain = this.ctx.createGain();
      this.grindGain.gain.value = 0.1;
      this.grindSrc.connect(this.grindFilter);
      this.grindFilter.connect(this.grindGain);
      this.grindGain.connect(this.sfxBus);
      this.grindSrc.start();
    }
    if (this.grindGain) this.grindGain.gain.setTargetAtTime(grinding ? 0.05 + speed * 0.12 : 0, this.ctx.currentTime, 0.04);
    if (this.grindFilter && grinding) this.grindFilter.frequency.setTargetAtTime(1600 + speed * 2400, this.ctx.currentTime, 0.04);
  }

  // ------------------------------------------------------------- music
  startMusic(song: string): void {
    if (this.currentSong === song) return;
    this.currentSong = song;
    this.bpm = { menu: 80, alley: 96, subway: 110, warehouse: 124 }[song] ?? 96;
    this.seqStep = 0;
    if (!this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    if (this.seqTimer === null) {
      this.seqTimer = window.setInterval(() => this.schedule(), 40);
    }
  }

  stopMusic(): void {
    this.currentSong = '';
    if (this.seqTimer !== null) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }

  private schedule(): void {
    if (!this.ctx || !this.currentSong) return;
    const spb = 60 / this.bpm / 4; // 16th notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.seqStep, this.nextNoteTime);
      this.nextNoteTime += spb;
      this.seqStep = (this.seqStep + 1) % 64;
    }
  }

  private note(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private synthNote(t: number, midi: number, dur: number, type: OscillatorType, peak: number, filterHz = 3000): void {
    if (!this.ctx || !this.musicBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = type;
    o.frequency.value = this.note(midi);
    f.type = 'lowpass';
    f.frequency.value = filterHz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat'): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuf) return;
    if (kind === 'kick') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.25);
    } else {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      if (kind === 'snare') {
        f.type = 'bandpass';
        f.frequency.value = 1800;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      } else {
        f.type = 'highpass';
        f.frequency.value = 7000;
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      }
      s.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      s.start(t);
      s.stop(t + 0.2);
    }
  }

  private playStep(step: number, t: number): void {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const minor = [0, 2, 3, 5, 7, 8, 10];
    const roots = [45, 41, 48, 43]; // A2 F2 C3 G2 — Am F C G loop
    const root = roots[bar];
    // drums
    if (s16 % 4 === 0) this.drum(t, 'kick');
    if (s16 === 4 || s16 === 12) this.drum(t, 'snare');
    if (s16 % 2 === 0) this.drum(t, 'hat');
    // bass
    if (s16 === 0 || s16 === 7 || s16 === 10) {
      this.synthNote(t, root - 12, 0.32, 'triangle', 0.3, 500);
    }
    // arpeggio / pad
    if (this.currentSong === 'menu') {
      if (s16 === 0) {
        this.synthNote(t, root + 12, 1.6, 'sine', 0.1, 1800);
        this.synthNote(t, root + 19, 1.6, 'sine', 0.07, 1800);
      }
      if (s16 % 4 === 2) this.synthNote(t, root + 24 + minor[(step * 3) % 7], 0.3, 'sine', 0.08);
      return;
    }
    if (s16 % 2 === 1) {
      const idx = (step * 5 + bar * 2) % 7;
      this.synthNote(t, root + 12 + minor[idx], 0.18, 'square', 0.05, 2200);
    }
    if (this.currentSong === 'warehouse' && s16 % 8 === 6) {
      this.synthNote(t, root + 36, 0.1, 'sawtooth', 0.06, 4000);
    }
    if (this.currentSong === 'subway' && s16 === 14) {
      this.synthNote(t, root + 7, 0.5, 'sine', 0.08, 1200);
    }
  }
}
