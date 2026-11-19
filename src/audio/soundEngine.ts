class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sfxVolume = 0.65;
  private musicVolume = 0.35;
  private muted = false;
  private musicInterval: number | null = null;
  private musicStep = 0;
  private ambientGain: GainNode | null = null;
  private lastWashSoundAt = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.startAmbientCity();
      this.startMusicLoop();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setSettings(sfxVolume: number, musicVolume: number, muted: boolean): void {
    this.sfxVolume = sfxVolume;
    this.musicVolume = musicVolume;
    this.muted = muted;
    if (this.ambientGain && this.ctx) {
      const target = muted ? 0 : Math.max(0.0001, sfxVolume * 0.045);
      this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    }
  }

  private getEffectiveSfx(scale = 1): number {
    if (this.muted || this.sfxVolume <= 0.01) return 0;
    return this.sfxVolume * scale;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink-ish noise
      data[i] = (lastOut + 0.06 * white) / 1.06;
      lastOut = data[i];
      data[i] *= 2.8;
    }
    return buffer;
  }

  private startAmbientCity(): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;

    const gain = this.ctx.createGain();
    gain.gain.value = this.muted ? 0 : this.sfxVolume * 0.04;
    this.ambientGain = gain;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  private startMusicLoop(): void {
    if (this.musicInterval !== null) return;
    // Stylish Spider-Verse lo-fi hip-hop / synth-funk groove at ~94 BPM (16th = ~160ms)
    const bassNotes = [55, 0, 55, 65.4, 0, 73.4, 0, 82.4, 55, 0, 61.7, 0, 73.4, 65.4, 0, 49];
    const chordPad = [220, 261.63, 329.63, 392.0];

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (this.muted || this.musicVolume <= 0.01) return;

      const now = this.ctx.currentTime;
      const step = this.musicStep % 16;
      const vol = this.musicVolume * 0.16;

      // Soft kick on 0, 6, 10
      if (step === 0 || step === 6 || step === 10) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);
        g.gain.setValueAtTime(vol * 0.9, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      }

      // Crisp hi-hat on odd steps
      if (step % 2 === 1 && this.noiseBuffer) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol * 0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        n.connect(hp);
        hp.connect(g);
        g.connect(this.ctx.destination);
        n.start(now, Math.random() * 0.5, 0.05);
      }

      // Snare on 4 & 12
      if ((step === 4 || step === 12) && this.noiseBuffer) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol * 0.42, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        n.connect(bp);
        bp.connect(g);
        g.connect(this.ctx.destination);
        n.start(now, Math.random() * 0.5, 0.12);
      }

      // Funky bassline
      const freq = bassNotes[step];
      if (freq > 0) {
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 2, now);
        lp.type = 'lowpass';
        lp.frequency.value = 460;
        g.gain.setValueAtTime(vol * 0.55, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      }

      // Warm electric piano chord on bar start
      if (step === 0 || step === 8) {
        const shift = step === 8 ? 0.9438 : 1;
        chordPad.forEach((note) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note * shift, now);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(vol * 0.18, now + 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 1.0);
        });
      }

      this.musicStep += 1;
    }, 165);
  }

  public playClick(): void {
    const v = this.getEffectiveSfx(0.24);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.045);
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playCash(): void {
    const v = this.getEffectiveSfx(0.28);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(v * 0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playUpgrade(): void {
    const v = this.getEffectiveSfx(0.32);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playError(): void {
    const v = this.getEffectiveSfx(0.22);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.14);
    g.gain.setValueAtTime(v * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playCarArrival(): void {
    const v = this.getEffectiveSfx(0.14);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(84, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.35);
    lp.type = 'lowpass';
    lp.frequency.value = 210;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(v, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playWashStageSound(stage: 'rinse' | 'foam' | 'scrub' | 'dry'): void {
    const nowMs = performance.now();
    if (nowMs - this.lastWashSoundAt < 950) return;
    this.lastWashSoundAt = nowMs;

    const v = this.getEffectiveSfx(0.15);
    if (!this.ctx || !this.noiseBuffer || v <= 0) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    if (stage === 'rinse') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.value = 1.2;
    } else if (stage === 'foam') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.Q.value = 2.0;
    } else if (stage === 'scrub') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, now);
      filter.Q.value = 3.0;
    } else {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200, now);
    }

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(v, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.8, 0.5);
  }

  public playFanfare(): void {
    const v = this.getEffectiveSfx(0.32);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(v * 0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  public playTurboSplash(): void {
    const v = this.getEffectiveSfx(0.28);
    if (!this.ctx || v <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1240, now + 0.14);
    g.gain.setValueAtTime(v * 0.7, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2800, now);
      bp.Q.value = 1.0;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(v * 0.6, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now, Math.random() * 0.4, 0.24);
    }
  }
}

export const soundEngine = new SoundEngine();
