// ============================================================
// AudioManager — Zero-Latency Procedural Vietnamese Audio Engine
// Built with Web Audio API (no external MP3 files needed):
// - Cozy Vietnamese Pentatonic BGM (menu / kitchen / action)
// - 15 crisp tactile cooking, arcade, cat-meow & brawl SFX
// - Full iOS Safari / Android Chrome gesture unlock & tab pause
// ============================================================

export type SfxName =
  | 'click'
  | 'pop'
  | 'slice'
  | 'fire'
  | 'splash'
  | 'ice'
  | 'spice'
  | 'worm'
  | 'coin'
  | 'perfect'
  | 'error'
  | 'meow'
  | 'meow_boss'
  | 'meow_golden'
  | 'meow_gangster'
  | 'punch'
  | 'win'
  | 'lose';

export type BgmMood = 'none' | 'menu' | 'kitchen' | 'action';

// Vietnamese Pentatonic scale frequencies (C major / A minor pentatonic: C, D, E, G, A)
const N: Record<string, number> = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5,
};

interface BgmPattern {
  bpm: number;
  melody: Array<string | null>;
  bass: Array<string | null>;
  wave: OscillatorType;
}

const BGM_PATTERNS: Record<Exclude<BgmMood, 'none'>, BgmPattern> = {
  // Warm cozy Saigon lantern evening pentatonic pluck (Đàn Tranh vibe)
  menu: {
    bpm: 100,
    wave: 'triangle',
    melody: [
      'E5', null, 'G5', 'A5', 'G5', null, 'E5', 'D5',
      'C5', null, 'D5', 'E5', 'G5', null, 'E5', null,
      'A5', null, 'G5', 'E5', 'D5', null, 'E5', 'G5',
      'E5', null, 'D5', 'C5', 'D5', null, null, null,
    ],
    bass: [
      'C3', null, null, null, 'G3', null, null, null,
      'A2', null, null, null, 'E3', null, null, null,
      'A2', null, null, null, 'G3', null, null, null,
      'C3', null, 'G3', null, 'C3', null, null, null,
    ],
  },
  // Lively upbeat Vietnamese street kitchen groove!
  kitchen: {
    bpm: 126,
    wave: 'triangle',
    melody: [
      'G5', 'E5', 'G5', 'A5', 'C6', null, 'A5', 'G5',
      'E5', 'D5', 'E5', 'G5', 'E5', null, 'D5', null,
      'C5', 'D5', 'E5', 'G5', 'A5', null, 'G5', 'E5',
      'D5', 'E5', 'G5', 'E5', 'C5', null, null, null,
    ],
    bass: [
      'C3', null, 'G3', null, 'A2', null, 'E3', null,
      'D3', null, 'G3', null, 'C3', null, 'G3', null,
      'A2', null, 'E3', null, 'D3', null, 'G3', null,
      'C3', null, 'G3', null, 'C3', null, 'G3', null,
    ],
  },
  // High-energy arcade chase & gangster battle beat!
  action: {
    bpm: 158,
    wave: 'square',
    melody: [
      'A4', 'C5', 'E5', 'A5', 'G5', 'E5', 'D5', 'E5',
      'A4', 'C5', 'D5', 'E5', 'G5', null, 'E5', null,
      'A5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', 'G5',
      'A5', null, 'G5', 'E5', 'A4', null, null, null,
    ],
    bass: [
      'A2', 'A2', 'E3', 'A2', 'G3', 'G3', 'D3', 'G3',
      'A2', 'A2', 'E3', 'A2', 'E3', null, 'G3', null,
      'C3', 'C3', 'G3', 'C3', 'D3', 'D3', 'A3', 'D3',
      'E3', 'E3', 'G3', 'E3', 'A2', null, 'E3', null,
    ],
  },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private _musicVolume = 0.24;
  private _sfxVolume = 0.55;
  private _muted = false;

  // BGM sequencer state
  private currentMood: BgmMood = 'none';
  private desiredMood: BgmMood = 'none';
  private bgmTimer: number | null = null;
  private stepIdx = 0;
  private nextNoteTime = 0;

  // Light rate limiter so rapid particles/drags never overload mobile audio thread
  private lastPlayed = new Map<SfxName, number>();

  /** Initialize / unlock AudioContext cleanly on first user gesture (mobile & desktop) */
  unlock(): void {
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;

      this.ctx = new AudioCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Pre-build a 0.35s reusable white-noise buffer once (zero GC during gameplay!)
      const len = Math.floor(this.ctx.sampleRate * 0.35);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => { /* ignore until gesture */ });
    }

    if (this.desiredMood !== 'none' && this.currentMood !== this.desiredMood) {
      this.startBgmLoop(this.desiredMood);
    }
  }

  /** Backward-compatible alias */
  init(): void {
    this.unlock();
  }

  /** Switch adaptive Vietnamese background music mood */
  playBgm(mood: BgmMood): void {
    this.desiredMood = mood;
    if (mood === 'none') {
      this.stopMusic();
      return;
    }
    if (this.currentMood === mood && this.bgmTimer !== null) return;
    if (!this.ctx) return; // Will start automatically upon unlock()!
    this.startBgmLoop(mood);
  }

  private startBgmLoop(mood: Exclude<BgmMood, 'none'>): void {
    this.stopMusic();
    if (!this.ctx) return;
    this.currentMood = mood;
    this.stepIdx = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;

    const scheduleAhead = (): void => {
      if (!this.ctx || this.currentMood === 'none' || this._muted || this.ctx.state !== 'running') {
        if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.08;
        return;
      }
      const pat = BGM_PATTERNS[this.currentMood];
      const stepDur = 60 / pat.bpm / 2; // eighth-note steps

      while (this.nextNoteTime < this.ctx.currentTime + 0.22) {
        const i = this.stepIdx % pat.melody.length;
        const mNote = pat.melody[i];
        const bNote = pat.bass[i];

        if (mNote && N[mNote]) {
          this.schedulePluck(
            N[mNote],
            this.nextNoteTime,
            stepDur * 1.4,
            this.currentMood === 'action' ? 0.14 : 0.24,
            pat.wave,
          );
        }
        if (bNote && N[bNote]) {
          this.schedulePluck(
            N[bNote],
            this.nextNoteTime,
            stepDur * 1.6,
            0.22,
            'sine',
          );
        }
        // Soft wooden woodblock tick on off-beats in kitchen/action moods!
        if (this.currentMood !== 'menu' && i % 2 === 1) {
          this.scheduleTick(this.nextNoteTime, this.currentMood === 'action' ? 0.08 : 0.04);
        }

        this.nextNoteTime += stepDur;
        this.stepIdx++;
      }
    };

    this.bgmTimer = window.setInterval(scheduleAhead, 95);
  }

  private schedulePluck(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private scheduleTick(startTime: number, peakGain: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, startTime);
    osc.frequency.exponentialRampToValueAtTime(420, startTime + 0.028);
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + 0.035);
  }

  stopMusic(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.currentMood = 'none';
  }

  /** Pause audio cleanly when browser tab goes to background */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => {});
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && !this._muted) {
      void this.ctx.resume().catch(() => {});
    }
  }

  // ---- Crisp Procedural SFX Library (15 distinct game sounds!) ----

  playSfx(name: SfxName): void {
    if (this._muted) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    // Light throttle (45ms) so rapid touch drags never flood mobile audio hardware
    const nowMs = performance.now();
    const prev = this.lastPlayed.get(name) ?? 0;
    if (nowMs - prev < 45) return;
    this.lastPlayed.set(name, nowMs);

    const t = this.ctx.currentTime;

    switch (name) {
      case 'click':
        this.tone('triangle', 620, 860, t, 0.045, 0.28);
        break;

      case 'pop':
        this.tone('sine', 420, 780, t, 0.08, 0.34);
        break;

      case 'slice':
        this.noiseBurst(t, 0.085, 2400, 'highpass', 0.28);
        this.tone('triangle', 320, 140, t, 0.06, 0.24);
        break;

      case 'fire':
        this.noiseBurst(t, 0.16, 650, 'bandpass', 0.3);
        this.tone('sine', 160, 240, t, 0.12, 0.16);
        break;

      case 'splash':
        this.tone('sine', 340, 680, t, 0.09, 0.28);
        this.tone('sine', 520, 920, t + 0.045, 0.08, 0.2);
        break;

      case 'ice':
        this.noiseBurst(t, 0.07, 4200, 'highpass', 0.24);
        this.tone('triangle', 1650, 2350, t, 0.09, 0.25);
        this.tone('sine', 2100, 1400, t + 0.03, 0.08, 0.18);
        break;

      case 'spice':
        this.noiseBurst(t, 0.055, 3200, 'bandpass', 0.22);
        this.noiseBurst(t + 0.05, 0.05, 3800, 'bandpass', 0.16);
        break;

      case 'worm':
        this.tone('sine', 360, 1080, t, 0.12, 0.34);
        this.tone('triangle', 880, 1320, t + 0.06, 0.08, 0.22);
        break;

      case 'coin':
        this.tone('sine', 987.77, 987.77, t, 0.08, 0.3);
        this.tone('sine', 1318.51, 1318.51, t + 0.075, 0.22, 0.32);
        break;

      case 'perfect':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          this.tone('triangle', freq, freq, t + i * 0.055, 0.22, 0.28);
        });
        break;

      case 'error':
        this.tone('sawtooth', 190, 115, t, 0.16, 0.22);
        this.tone('triangle', 150, 95, t + 0.06, 0.14, 0.18);
        break;

      case 'meow':
        this.meowVoice(t, 580, 920, 520, 0.28, 'triangle', 0.30);
        break;

      case 'meow_boss':
        // Dignified deeper folded-ear tabby meow for Vằn Bếp Trưởng!
        this.meowVoice(t, 410, 620, 355, 0.27, 'triangle', 0.30);
        break;

      case 'meow_golden':
        // Bright chirpy adorable meow for Mèo Vàng Phụ Bếp!
        this.meowVoice(t, 740, 1180, 790, 0.22, 'sine', 0.28);
        break;

      case 'meow_gangster':
        // Low menacing street-cat growl-meow for Đại Ca Mèo Giang Hồ!
        this.meowVoice(t, 280, 390, 210, 0.32, 'sawtooth', 0.18);
        break;

      case 'punch':
        this.tone('sine', 190, 48, t, 0.14, 0.48);
        this.noiseBurst(t, 0.12, 1200, 'bandpass', 0.42);
        break;

      case 'win':
        [523.25, 659.25, 783.99, 880.0, 1046.5].forEach((freq, i) => {
          this.tone('triangle', freq, freq, t + i * 0.08, 0.28, 0.32);
        });
        break;

      case 'lose':
        [392.0, 349.23, 311.13, 261.63].forEach((freq, i) => {
          this.tone('sawtooth', freq, freq * 0.94, t + i * 0.14, 0.24, 0.2);
        });
        break;
    }
  }

  /** Backward-compatible alias */
  playSFX(key: string): void {
    this.playSfx(key as SfxName);
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private meowVoice(
    t: number,
    fStart: number,
    fPeak: number,
    fEnd: number,
    dur: number,
    wave: OscillatorType,
    vol: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = wave;
    // Subtle organic vibrato-like pitch bend mimicking real cat vowel "m-e-o-w"
    osc.frequency.setValueAtTime(fStart, t);
    osc.frequency.linearRampToValueAtTime(fPeak, t + dur * 0.38);
    osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(wave === 'sawtooth' ? 1100 : 2400, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  /** Helper: play matching cat character voice whenever a cat speaks! */
  playCatVoice(speaker: 'boss' | 'golden' | 'both' | 'gangster'): void {
    if (speaker === 'boss') this.playSfx('meow_boss');
    else if (speaker === 'golden') this.playSfx('meow_golden');
    else if (speaker === 'gangster') this.playSfx('meow_gangster');
    else {
      this.playSfx('meow_boss');
      window.setTimeout(() => this.playSfx('meow_golden'), 130);
    }
  }

  private noiseBurst(
    startTime: number,
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  // --- Volume & Mute Controls ---

  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(v: number) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVolume;
  }

  get sfxVolume(): number { return this._sfxVolume; }
  set sfxVolume(v: number) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfxVolume;
  }

  get muted(): boolean { return this._muted; }
  set muted(v: boolean) {
    this._muted = v;
    if (this.masterGain) {
      this.masterGain.gain.value = v ? 0 : 1;
    }
    if (!v) this.unlock();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (!this._muted) this.playSfx('click');
  }
}
