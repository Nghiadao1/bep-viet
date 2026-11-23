// ============================================================
// AudioManager — Web Audio API wrapper for SFX and music
// ============================================================

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentMusic: AudioBufferSourceNode | null = null;
  private audioBuffers = new Map<string, AudioBuffer>();

  private _musicVolume = 0.5;
  private _sfxVolume = 0.7;
  private _muted = false;

  /** Must call after user gesture to initialize AudioContext */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVolume;
    this.sfxGain.connect(this.masterGain);
  }

  /** Register an audio buffer for later playback */
  register(key: string, buffer: AudioBuffer): void {
    this.audioBuffers.set(key, buffer);
  }

  /** Play a one-shot sound effect */
  playSFX(key: string): void {
    if (!this.ctx || this._muted) return;
    const buffer = this.audioBuffers.get(key);
    if (!buffer) return;

    // Resume context if suspended (browser auto-pause policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain!);
    source.start();
  }

  /** Play background music (loops by default) */
  playMusic(key: string, loop = true): void {
    if (!this.ctx) return;
    this.stopMusic();

    const buffer = this.audioBuffers.get(key);
    if (!buffer) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this.musicGain!);
    source.start();
    this.currentMusic = source;
  }

  /** Stop current music */
  stopMusic(): void {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
      } catch { /* already stopped */ }
      this.currentMusic = null;
    }
  }

  // --- Volume controls ---

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
    if (this.masterGain) this.masterGain.gain.value = v ? 0 : 1;
  }

  toggleMute(): void {
    this.muted = !this.muted;
  }
}
