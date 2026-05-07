import { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { WaveSystem } from '../systems/WaveSystem';
import { CombatSystem, DEFAULT_COMBAT_UPGRADES, type CombatUpgrades } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TOWER_DEFS } from '../data/towers';
import { BALANCE } from '../balance';
import type { GamePhase, Vec2 } from '../entities/types';

const EARLY_WAVE_BONUS = 50;

export interface GameState {
  phase: GamePhase;
  wave: number; // 1-based display (highest committed wave)
  baseHp: number;
  baseMaxHp: number;
  gold: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Readonly<Projectile[]>;
  buildTimeLeft: number;
  upgrades: CombatUpgrades;
  surviveOnce: boolean;
  airStrikeCharges: number;
  empCharges: number;
  canSendNextWave: boolean;
  earlyWaveBonus: number;
  speed: number;
}

type StateListener = (state: GameState) => void;

export class GameEngine {
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private waveSystems: WaveSystem[] = [];
  private combatSystem = new CombatSystem();
  private economySystem: EconomySystem;
  private phase: GamePhase = 'build';
  private baseHp: number;
  private baseMaxHp: number;
  // Highest 0-based wave index that has been committed (started or in build for)
  private committedWaveIdx: number = 0;
  private earlyWaveSentThisRound: boolean = false;
  private buildTimer: number = BALANCE.BUILD_PHASE_DURATION;
  private upgrades: CombatUpgrades = { ...DEFAULT_COMBAT_UPGRADES };
  private surviveOnce = false;
  private airStrikeCharges = 0;
  private empCharges = 0;
  private goldMult = 1.0;
  private speedMult = 1;
  private regenTimer = 0;
  private regenHPPerThirty = 0;
  private lastTs: number | null = null;
  private rafId: number | null = null;
  private listeners: StateListener[] = [];

  constructor(baseHp: number, startingGold: number) {
    this.baseHp = baseHp;
    this.baseMaxHp = baseHp;
    this.economySystem = new EconomySystem(startingGold);
  }

  onStateChange(fn: StateListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  private emit() {
    const state = this.getState();
    for (const fn of this.listeners) fn(state);
  }

  getState(): GameState {
    const canSend = this.phase === 'wave' && !this.earlyWaveSentThisRound;
    return {
      phase: this.phase,
      wave: this.committedWaveIdx + 1,
      baseHp: this.baseHp,
      baseMaxHp: this.baseMaxHp,
      gold: this.economySystem.gold,
      enemies: this.enemies,
      towers: this.towers,
      projectiles: this.combatSystem.getProjectiles(),
      buildTimeLeft: this.buildTimer,
      upgrades: { ...this.upgrades },
      surviveOnce: this.surviveOnce,
      airStrikeCharges: this.airStrikeCharges,
      empCharges: this.empCharges,
      canSendNextWave: canSend,
      earlyWaveBonus: EARLY_WAVE_BONUS,
      speed: this.speedMult,
    };
  }

  start() {
    this.phase = 'build';
    this.buildTimer = BALANCE.BUILD_PHASE_DURATION;
    this.emit();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastTs = null;
  }

  private loop = (ts: number) => {
    if (this.lastTs === null) this.lastTs = ts;
    const dt = Math.min((ts - this.lastTs) / 1000, 0.1);
    this.lastTs = ts;
    this.tick(dt);
    if (this.phase !== 'gameover' && this.phase !== 'win') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private tick(dt: number) {
    const adt = dt * this.speedMult;
    switch (this.phase) {
      case 'build': this.tickBuild(adt); break;
      case 'wave':  this.tickWave(adt);  break;
    }
    this.emit();
  }

  setSpeed(mult: number) { this.speedMult = mult; this.emit(); }

  private tickBuild(_dt: number) {
    // Build phase: player presses Ready to start
  }

  private beginWave() {
    this.phase = 'wave';
    this.earlyWaveSentThisRound = false;
    const ws = new WaveSystem();
    ws.startWave(this.committedWaveIdx);
    this.waveSystems = [ws];
  }

  private tickWave(dt: number) {
    if (this.regenHPPerThirty > 0) {
      this.regenTimer += dt;
      while (this.regenTimer >= 30) {
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + this.regenHPPerThirty);
        this.regenTimer -= 30;
      }
    }

    // Spawn from all active wave systems
    for (const ws of this.waveSystems) {
      ws.update(dt, (enemy) => this.enemies.push(enemy));
    }

    for (const e of this.enemies) e.update(dt);

    const reachedEnd = this.enemies.filter((e) => e.reachedEnd && !e.isDead);
    for (const e of reachedEnd) {
      e.isDead = true;
      const dmg = e.damageToBase;
      if (this.surviveOnce && this.baseHp - dmg <= 0) {
        this.baseHp = 1;
        this.surviveOnce = false;
      } else {
        this.baseHp -= dmg;
      }
      if (this.baseHp <= 0) {
        this.baseHp = 0;
        this.phase = 'gameover';
        return;
      }
    }

    this.combatSystem.update(
      dt, this.towers, this.enemies, this.upgrades,
      this.baseHp, this.baseMaxHp,
      (life) => { this.baseHp = Math.min(this.baseMaxHp, this.baseHp + life); },
      (gold) => { this.economySystem.earn(gold, this.goldMult); },
    );

    this.economySystem.update(dt);
    this.enemies = this.enemies.filter((e) => !e.isDead || e.reachedEnd);

    // All wave systems done + all enemies cleared = wave over
    const allSpawned = this.waveSystems.every(ws => ws.isFinished);
    const allDead = this.enemies.every((e) => e.isDead || e.reachedEnd);
    if (allSpawned && allDead) this.endWave();
  }

  private endWave() {
    this.committedWaveIdx++;
    this.buildTimer = BALANCE.BUILD_PHASE_DURATION;
    this.phase = 'build';
  }

  // --- Player actions ---

  placeTower(type: string, pos: Vec2): boolean {
    const def = TOWER_DEFS[type];
    if (!def) return false;
    if (!this.economySystem.spend(def.cost)) return false;
    this.towers.push(new Tower(def, pos));
    this.emit();
    return true;
  }

  upgradeTower(towerId: number): boolean {
    const tower = this.towers.find(t => t.id === towerId);
    if (!tower) return false;
    const cost = tower.upgradeCost;
    if (!this.economySystem.spend(cost)) return false;
    tower.totalSpent += cost;
    tower.upgrades++;
    tower.damageMultiplier   = 1 + tower.upgrades * 0.5;
    tower.rangeMultiplier    = 1 + tower.upgrades * 0.1;
    tower.fireRateMultiplier = 1 + tower.upgrades * 0.2;
    this.emit();
    return true;
  }

  sellTower(towerId: number): boolean {
    const idx = this.towers.findIndex(t => t.id === towerId);
    if (idx === -1) return false;
    const refund = Math.round(this.towers[idx].totalSpent * 0.6);
    this.towers.splice(idx, 1);
    this.economySystem.earn(refund, 1.0);
    this.emit();
    return true;
  }

  skipBuild() {
    if (this.phase !== 'build') return;
    this.beginWave();
    this.emit();
  }

  sendNextWave() {
    if (this.phase !== 'wave') return;
    if (this.earlyWaveSentThisRound) return;
    this.earlyWaveSentThisRound = true;
    this.committedWaveIdx++;
    this.economySystem.earn(EARLY_WAVE_BONUS, this.goldMult);
    const ws = new WaveSystem();
    ws.startWave(this.committedWaveIdx);
    this.waveSystems.push(ws);
    this.emit();
  }

  airStrike() {
    if (this.airStrikeCharges <= 0) return;
    this.airStrikeCharges--;
    for (const e of this.enemies) if (!e.isDead && !e.reachedEnd) {
      e.isDead = true;
      this.economySystem.earn(e.goldReward, this.goldMult);
    }
    this.emit();
  }

  empBlast() {
    if (this.empCharges <= 0) return;
    this.empCharges--;
    for (const e of this.enemies) e.isFrozen = true;
    setTimeout(() => {
      for (const e of this.enemies) e.isFrozen = false;
      this.emit();
    }, 3000);
    this.emit();
  }

  applyUpgrade(id: string) {
    console.log('upgrade applied:', id);
    this.phase = 'build';
    this.buildTimer = BALANCE.BUILD_PHASE_DURATION;
    this.committedWaveIdx++;
    this.emit();
  }
}
