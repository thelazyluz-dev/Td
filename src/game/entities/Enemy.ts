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

  // Milestone 1 doesn't need all specials; we store them for future milestones
  isFrozen: boolean = false;
  slowMult: number = 1.0;

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
    const effectiveSpeed = this.isFrozen ? 0 : this.speed * this.slowMult;
    this.distanceTravelled += effectiveSpeed * dt;
    if (this.distanceTravelled >= PATH_TOTAL_LENGTH) {
      this.distanceTravelled = PATH_TOTAL_LENGTH;
      this.reachedEnd = true;
    }
    this.pos = positionAlongPath(this.distanceTravelled);
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }
}
