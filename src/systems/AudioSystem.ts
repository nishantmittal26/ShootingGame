import { tuning } from '../config/tuning';

/**
 * All sound is synthesized at runtime, so the game ships with no audio files and works
 * with no network. Each effect is a short envelope over an oscillator or a noise burst.
 *
 * The context is created lazily because browsers refuse to start audio before a user
 * gesture; `resume` is called from the same input that starts the run.
 */
export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  /** Last play time per effect, used to stop rapid events from stacking into clipping. */
  private readonly lastPlayed = new Map<string, number>();

  resume(): void {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : tuning.audio.masterGain;
      this.master.connect(this.context.destination);
      this.noise = this.createNoiseBuffer(this.context);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : tuning.audio.masterGain,
        this.context.currentTime,
        0.02,
      );
    }
    return this.muted;
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 1.2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Rate limit so a wall of simultaneous hits does not turn into a clipped roar. */
  private allow(key: string, minGap: number): boolean {
    if (!this.context) {
      return false;
    }
    const now = this.context.currentTime;
    const last = this.lastPlayed.get(key);
    if (last !== undefined && now - last < minGap) {
      return false;
    }
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    peak: number,
    detune = 0,
  ): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) {
      return;
    }

    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.012, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private burst(duration: number, peak: number, filterStart: number, filterEnd: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.noise) {
      return;
    }

    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.7 + Math.random() * 0.5;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterEnd), now + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  cannon(): void {
    if (!this.allow('cannon', 0.045)) {
      return;
    }
    this.tone('square', 900, 260, 0.08, 0.16);
    this.tone('sawtooth', 420, 150, 0.06, 0.06);
  }

  missileLaunch(): void {
    if (!this.allow('missile', 0.1)) {
      return;
    }
    this.tone('sawtooth', 180, 900, 0.28, 0.13);
    this.burst(0.3, 0.09, 1800, 300);
  }

  enemyShot(): void {
    if (!this.allow('enemyShot', 0.06)) {
      return;
    }
    this.tone('triangle', 520, 190, 0.11, 0.09);
  }

  impact(): void {
    if (!this.allow('impact', 0.03)) {
      return;
    }
    this.burst(0.07, 0.12, 5200, 900);
  }

  explosion(): void {
    if (!this.allow('explosion', 0.05)) {
      return;
    }
    this.burst(0.55, 0.4, 2600, 90);
    this.tone('sine', 150, 42, 0.4, 0.2);
  }

  bigExplosion(): void {
    this.burst(1.5, 0.6, 2000, 50);
    this.tone('sine', 110, 28, 1.2, 0.34);
    this.tone('sawtooth', 80, 30, 0.8, 0.12);
  }

  pickup(): void {
    if (!this.allow('pickup', 0.05)) {
      return;
    }
    this.tone('sine', 660, 990, 0.1, 0.16);
    this.tone('sine', 990, 1480, 0.14, 0.12, 6);
  }

  playerHit(): void {
    if (!this.allow('playerHit', 0.08)) {
      return;
    }
    this.burst(0.3, 0.34, 1400, 120);
    this.tone('square', 220, 70, 0.22, 0.16);
  }

  shieldAbsorb(): void {
    if (!this.allow('shield', 0.06)) {
      return;
    }
    this.tone('sine', 1400, 620, 0.16, 0.15);
    this.tone('triangle', 700, 340, 0.2, 0.09);
  }

  alarm(): void {
    if (!this.allow('alarm', 0.9)) {
      return;
    }
    this.tone('square', 880, 880, 0.14, 0.12);
    window.setTimeout(() => this.tone('square', 660, 660, 0.14, 0.12), 170);
  }

  victory(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, index) => {
      window.setTimeout(() => this.tone('triangle', freq, freq, 0.34, 0.17), index * 130);
    });
  }

  defeat(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, index) => {
      window.setTimeout(() => this.tone('sawtooth', freq, freq * 0.96, 0.4, 0.14), index * 170);
    });
  }
}
