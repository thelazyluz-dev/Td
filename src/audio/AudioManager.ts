/** Procedural sound engine using Web Audio API — no files required. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastShoot = new Map<string, number>(); // throttle per tower type

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private get t() { return this.ctx!.currentTime; }

  // ── Primitives ─────────────────────────────────────────────────────────

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, freqEnd?: number) {
    if (!this.ctx || !this.master) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.t);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, this.t + dur);
    gain.gain.setValueAtTime(vol, this.t);
    gain.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(this.t); osc.stop(this.t + dur);
  }

  private noise(dur: number, vol: number, loFreq = 100, hiFreq = 4000) {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src  = this.ctx.createBufferSource();
    src.buffer = buf;
    const bpf  = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = (loFreq + hiFreq) / 2;
    bpf.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.t);
    gain.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    src.connect(bpf); bpf.connect(gain); gain.connect(this.master);
    src.start(this.t); src.stop(this.t + dur);
  }

  private chord(notes: number[], dur: number, type: OscillatorType, vol: number, delayMs = 0) {
    notes.forEach((f, i) => setTimeout(() => {
      this.ensureCtx();
      this.tone(f, dur, type, vol);
    }, i * delayMs));
  }

  // ── Public API ──────────────────────────────────────────────────────────

  shoot(towerType: string) {
    this.ensureCtx();
    const now = Date.now();
    const minGap = towerType === 'MachineGun' ? 100 : 60;
    if (now - (this.lastShoot.get(towerType) ?? 0) < minGap) return;
    this.lastShoot.set(towerType, now);

    switch (towerType) {
      case 'Rifleman':     this.tone(900,  0.07, 'square',   0.18); break;
      case 'Shotgunner':   this.noise(0.14, 0.22, 80,  800);         break;
      case 'Sniper':       this.tone(1400, 0.10, 'sawtooth', 0.22); this.tone(600, 0.08, 'sine', 0.1); break;
      case 'MachineGun':   this.tone(700,  0.04, 'square',   0.12); break;
      case 'Flamethrower': this.noise(0.12, 0.12, 300, 5000);        break;
      case 'Mortar':       this.tone(60,   0.28, 'sine',     0.30, 30); this.noise(0.08, 0.15, 60, 200); break;
    }
  }

  enemyDeath(type: string) {
    this.ensureCtx();
    if (type === 'PatientZero' || type === 'Alpha') {
      this.tone(120, 0.6, 'sawtooth', 0.35, 40);
      this.noise(0.3, 0.25, 40, 400);
    } else if (type === 'Bloater') {
      this.tone(80, 0.4, 'sine', 0.4, 30);
      this.noise(0.2, 0.2, 60, 500);
    } else {
      this.tone(350 + Math.random() * 200, 0.18, 'sawtooth', 0.14, 80);
    }
  }

  waveStart(waveNum: number) {
    this.ensureCtx();
    if (waveNum === 10) {
      // Final wave — ominous descending chord
      this.chord([220, 165, 110, 82], 0.6, 'sawtooth', 0.2, 180);
    } else if (waveNum === 5) {
      // Mid-boss — dramatic
      this.chord([330, 440, 550], 0.5, 'square', 0.18, 100);
      setTimeout(() => { this.ensureCtx(); this.tone(180, 0.8, 'sine', 0.3, 90); }, 350);
    } else {
      // Normal wave — ascending alert
      this.chord([440, 550, 660], 0.25, 'sine', 0.18, 120);
    }
  }

  bossSpawn() {
    this.ensureCtx();
    this.tone(55,  1.0, 'sawtooth', 0.4, 40);
    this.tone(110, 0.8, 'sine',     0.3, 80);
    this.noise(0.5, 0.25, 30, 300);
  }

  baseHit() {
    this.ensureCtx();
    this.tone(200, 0.25, 'sawtooth', 0.3, 100);
    this.noise(0.15, 0.2, 100, 600);
  }

  towerPlaced() {
    this.ensureCtx();
    this.tone(660, 0.08, 'sine', 0.15);
    this.tone(880, 0.06, 'sine', 0.10);
  }

  gameOver() {
    this.ensureCtx();
    this.chord([440, 370, 294, 220], 0.55, 'sine', 0.22, 220);
  }

  win() {
    this.ensureCtx();
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => { this.ensureCtx(); this.tone(f, 0.4, 'sine', 0.25); }, i * 130));
  }
}

export const audioManager = new AudioManager();
