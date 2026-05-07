import { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { WaveSystem } from '../systems/WaveSystem';
import { CombatSystem, DEFAULT_COMBAT_UPGRADES, type CombatUpgrades } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TOWER_DEFS } from '../data/towers';
import { WAVE_DEFS } from '../data/waves';
import { BALANCE } from '../balance';
import type { GamePhase, Vec2 } from '../entities/types';

export interface GameState {
  phase: GamePhase;
  wave: number; // 1-based
  baseHp: number;
  baseMaxHp: number;
  gold: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Readonly<Projectile[]>;
  buildTimeLeft: number;
  upgrades: CombatUpgrades;
  surviveOnce: boolean; // adrenaline shot
  airStrikeCharges: number;
  empCharges: number;
}

type StateListener = (state: GameState) => void;

export class GameEngine {
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private waveSystem = new WaveSystem();
  private combatSystem = new CombatSystem();
  private economySystem: EconomySystem;
  private phase: GamePhase = 'build';
  private baseHp: number;
  private baseMaxHp: number;
  private waveIndex: number = 0;
  private buildTimer: number = BALANCE.BUILD_PHASE_DURATION;
  private upgrades: CombatUpgrades = { ...DEFAULT_COMBAT_UPGRADES };
  private surviveOnce = false;
  private airStrikeCharges = 0;
  private empCharges = 0;
  private goldMult = 1.0;
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
    return {
      phase: this.phase,
      wave: this.waveIndex + 1,
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
    const dt = Math.min((ts - this.lastTs) / 1000, 0.1); // cap at 100ms
    this.lastTs = ts;
    this.tick(dt);
    if (this.phase !== 'gameover' && this.phase !== 'win') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private tick(dt: number) {
    switch (this.phase) {
      case 'build': this.tickBuild(dt); break;
      case 'wave': this.tickWave(dt); break;
    }
    this.emit();
  }

  private tickBuild(dt: number) {
    this.buildTimer -= dt;
    if (this.buildTimer <= 0) this.beginWave();
  }

  private beginWave() {
    this.phase = 'wave';
    this.waveSystem.startWave(this.waveIndex);
  }

  private tickWave(dt: number) {
    // HP regen
    if (this.regenHPPerThirty > 0) {
      this.regenTimer += dt;
      while (this.regenTimer >= 30) {
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + this.regenHPPerThirty);
        this.regenTimer -= 30;
      }
    }

    // Spawn enemies
    this.waveSystem.update(dt, (enemy) => this.enemies.push(enemy));

    // Update enemies
    for (const e of this.enemies) e.update(dt);

    // Handle enemies reaching end
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

    // Combat
    this.combatSystem.update(
      dt,
      this.towers,
      this.enemies,
      this.upgrades,
      this.baseHp,
      this.baseMaxHp,
      (lifeAmount) => {
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + lifeAmount);
      },
      (gold) => {
        this.economySystem.earn(gold, this.goldMult);
      },
    );

    // Economy passive
    this.economySystem.update(dt);

    // Prune dead/arrived enemies
    this.enemies = this.enemies.filter((e) => !e.isDead || e.reachedEnd);

    // Check wave complete
    const allSpawned = this.waveSystem.isFinished;
    const allDead = this.enemies.every((e) => e.isDead || e.reachedEnd);
    if (allSpawned && allDead) this.endWave();
  }

  private endWave() {
    if (this.waveIndex >= WAVE_DEFS.length - 1) {
      this.phase = 'win';
    } else {
      this.waveIndex++;
      this.buildTimer = BALANCE.BUILD_PHASE_DURATION;
      this.phase = 'build';
    }
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

  skipBuild() {
    if (this.phase !== 'build') return;
    this.buildTimer = 0;
    this.beginWave();
    this.emit();
  }

  airStrike() {
    if (this.airStrikeCharges <= 0) return;
    this.airStrikeCharges--;
    for (const e of this.enemies) if (!e.isDead && !e.reachedEnd) {
      const gold = e.goldReward;
      e.isDead = true;
      this.economySystem.earn(gold, this.goldMult);
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
    // Upgrade effects applied here; full implementation in Milestone 3
    console.log('upgrade applied:', id);
    this.phase = 'build';
    this.buildTimer = BALANCE.BUILD_PHASE_DURATION;
    this.waveIndex++;
    this.emit();
  }
}
