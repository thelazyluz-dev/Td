class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { this.enabled = false; return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, type: OscillatorType, duration: number, vol = 0.18, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  shoot() {
    this.tone(900, 'square', 0.06, 0.06);
  }

  enemyDie() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  baseHit() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  waveClear() {
    // Ascending arpeggio: C4 E4 G4 C5
    [262, 330, 392, 523].forEach((f, i) => this.tone(f, 'sine', 0.22, 0.14, i * 0.14));
  }

  perfectBonus() {
    // Bright fanfare
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.28, 0.16, i * 0.12));
    setTimeout(() => this.tone(1047, 'sine', 0.5, 0.1), 500);
  }

  buildCountdown() {
    this.tone(660, 'square', 0.07, 0.1);
  }

  waveStart() {
    this.tone(220, 'sawtooth', 0.18, 0.12);
    setTimeout(() => this.tone(330, 'sawtooth', 0.18, 0.12), 100);
  }
}

export const soundManager = new SoundManager();
