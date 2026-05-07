import type { EnemyDef, Vec2 } from './types';
import { positionAlongPath, PATH_TOTAL_LENGTH } from '../engine/PathManager';
import { BALANCE } from '../balance';

let _nextId = 1;

export class Enemy {
  id: number;
  type: string;
  hp: number;
  maxHp: number;
  speed: number; // px/sec
  damageToBase: number;
  goldReward: number;
  specialAbility?: string;

  distanceTravelled: number = 0;
  pos: Vec2 = { x: 0, y: 0 };
  reachedEnd: boolean = false;
  isDead: boolean = false;

  isFrozen: boolean = false;
  slowMult: number = 1.0;       // area slow (reset each frame by CombatSystem)
  activeSlowMult: number = 1.0; // hit-based slow (persists with timer)
  slowTimer: number = 0;
  stunTimer: number = 0;
  waveSpeedMult: number = 1.0;  // speed modifier from wave type
  armorMult: number = 1.0;      // damage resistance (armorMult=2 → takes half damage)
  damageAmp: number = 0; // extra damage multiplier applied by utility towers

  constructor(def: EnemyDef, waveHpMult = 1.0) {
    this.id = _nextId++;
    this.type = def.type;
    this.hp = Math.round(def.hp * waveHpMult);
    this.maxHp = this.hp;
    this.speed = def.speed * BALANCE.BASE_SPEED_PX_PER_SEC;
    this.damageToBase = def.damageToBase;
    this.goldReward = def.goldReward;
    this.specialAbility = def.specialAbility;
    this.pos = positionAlongPath(0);
  }

  update(dt: number) {
    if (this.isDead || this.reachedEnd) return;
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }
    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer === 0) this.activeSlowMult = 1.0;
    }
    const frozen = this.isFrozen || this.stunTimer > 0;
    const effectiveSpeed = frozen ? 0 : this.speed * this.slowMult * this.activeSlowMult * this.waveSpeedMult;
    this.distanceTravelled += effectiveSpeed * dt;
    if (this.distanceTravelled >= PATH_TOTAL_LENGTH) {
      this.distanceTravelled = PATH_TOTAL_LENGTH;
      this.reachedEnd = true;
    }
    this.pos = positionAlongPath(this.distanceTravelled);
  }

  takeDamage(amount: number) {
    const actual = this.armorMult > 1 ? amount / this.armorMult : amount;
    this.hp -= actual;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }
}
