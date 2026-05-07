import { Enemy } from '../entities/Enemy';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { WaveSystem } from '../systems/WaveSystem';
import { CombatSystem, DEFAULT_COMBAT_UPGRADES, type CombatUpgrades } from '../systems/CombatSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { TOWER_DEFS } from '../data/towers';
import { BALANCE } from '../balance';
import type { GamePhase, Vec2 } from '../entities/types';
import type { SavedTower } from '../../utils/buildSave';
import { setActivePath, PATH_VARIANTS } from './PathManager';

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
  lastPerfectBonus: number;
  isPaused: boolean;
  lastWaveKills: number;
  lastWaveEscaped: number;
  waveModifier: 'speed' | 'armor' | null;
  pathVariant: number;
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
  private baseDamagedThisWave = false;
  private lastPerfectBonus = 0;
  private isPaused = false;
  private regenHPPerThirty = 0;
  private waveKillsCount = 0;
  private waveEscapedCount = 0;
  private lastWaveKills = 0;
  private lastWaveEscaped = 0;
  private currentWaveModifier: 'speed' | 'armor' | null = null;
  private pathVariantIdx = 0;
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
      earlyWaveBonus: this.earlyWaveBonusAmount(),
      speed: this.speedMult,
      lastPerfectBonus: this.lastPerfectBonus,
      isPaused: this.isPaused,
      lastWaveKills: this.lastWaveKills,
      lastWaveEscaped: this.lastWaveEscaped,
      waveModifier: this.currentWaveModifier,
      pathVariant: this.pathVariantIdx,
    };
  }

  start() {
    this.pathVariantIdx = Math.floor(Math.random() * PATH_VARIANTS.length);
    setActivePath(this.pathVariantIdx);
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

  private earlyWaveBonusAmount(): number {
    return 50 + this.committedWaveIdx * 15;
  }

  private waveModifierFor(idx: number): 'speed' | 'armor' | null {
    if (idx < 2) return null;
    if (idx % 5 === 2) return 'speed';
    if (idx % 5 === 4) return 'armor';
    return null;
  }

  setSpeed(mult: number) { this.speedMult = mult; this.emit(); }

  pause(): void {
    if (this.isPaused || this.phase === 'gameover') return;
    this.isPaused = true;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.emit();
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.lastTs = null;
    this.rafId = requestAnimationFrame(this.loop);
    this.emit();
  }

  togglePause(): void {
    if (this.isPaused) this.resume(); else this.pause();
  }

  private tickBuild(dt: number) {
    this.buildTimer -= dt;
    if (this.buildTimer <= 0) {
      this.buildTimer = 0;
      this.beginWave();
    }
  }

  private beginWave() {
    this.phase = 'wave';
    this.earlyWaveSentThisRound = false;
    this.baseDamagedThisWave = false;
    this.lastPerfectBonus = 0;
    this.waveKillsCount = 0;
    this.waveEscapedCount = 0;
    this.currentWaveModifier = this.waveModifierFor(this.committedWaveIdx);
    const ws = new WaveSystem();
    ws.startWave(this.committedWaveIdx, this.currentWaveModifier);
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
      this.baseDamagedThisWave = true;
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
    this.waveKillsCount += this.enemies.filter(e => e.isDead && !e.reachedEnd).length;
    this.enemies = this.enemies.filter((e) => !e.isDead || e.reachedEnd);

    // All wave systems done + all enemies cleared = wave over
    const allSpawned = this.waveSystems.every(ws => ws.isFinished);
    const allDead = this.enemies.every((e) => e.isDead || e.reachedEnd);
    if (allSpawned && allDead) this.endWave();
  }

  private endWave() {
    if (!this.baseDamagedThisWave) {
      const perfBonus = 30 + this.committedWaveIdx * 8;
      this.lastPerfectBonus = perfBonus;
      this.economySystem.earn(perfBonus, 1.0);
    } else {
      this.lastPerfectBonus = 0;
    }
    this.lastWaveKills = this.waveKillsCount;
    this.lastWaveEscaped = this.enemies.filter(e => e.reachedEnd).length;
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
    if (tower.upgrades === 0 && tower.branch === null) return false; // must pick branch first
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

  upgradeTowerBranch(towerId: number, branch: 'dmg' | 'util'): boolean {
    const tower = this.towers.find(t => t.id === towerId);
    if (!tower || tower.upgrades !== 0 || tower.branch !== null) return false;
    const cost = tower.upgradeCost;
    if (!this.economySystem.spend(cost)) return false;
    tower.branch = branch;
    tower.totalSpent += cost;
    tower.upgrades = 1;
    if (branch === 'dmg') {
      tower.damageMultiplier   = 2.5;
      tower.fireRateMultiplier = 1.2;
      tower.rangeMultiplier    = 1.1;
    } else {
      tower.damageMultiplier   = 1.3;
      tower.fireRateMultiplier = 1.7;
      tower.rangeMultiplier    = 1.6;
    }
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
    const earlyBonus = this.earlyWaveBonusAmount();
    this.committedWaveIdx++;
    this.economySystem.earn(earlyBonus, this.goldMult);
    const ws = new WaveSystem();
    ws.startWave(this.committedWaveIdx, this.waveModifierFor(this.committedWaveIdx));
    this.waveSystems.push(ws);
    this.emit();
  }

  airStrike() {
    if (this.airStrikeCharges <= 0) return;
    this.airStrikeCharges--;
    for (const e of this.enemies) if (!e.isDead && !e.reachedEnd) {
      e.isDead = true;
      this.waveKillsCount++;
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

  loadBuild(savedTowers: SavedTower[], tileSize: number) {
    if (this.phase !== 'build') return;
    for (const st of savedTowers) {
      const def = TOWER_DEFS[st.type];
      if (!def) continue;
      const pos: Vec2 = { x: st.col * tileSize + tileSize / 2, y: st.row * tileSize + tileSize / 2 };
      if (this.economySystem.spend(def.cost)) {
        this.towers.push(new Tower(def, pos));
      }
    }
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
