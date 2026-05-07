import type { Vec2 } from './types';

let _nextProjId = 1;

export class Projectile {
  id: number;
  towerId: number;
  targetEnemyId: number;
  pos: Vec2;
  speed: number;
  damage: number;
  hit: boolean = false;

  constructor(towerId: number, targetEnemyId: number, startPos: Vec2, speed: number, damage: number) {
    this.id = _nextProjId++;
    this.towerId = towerId;
    this.targetEnemyId = targetEnemyId;
    this.pos = { ...startPos };
    this.speed = speed;
    this.damage = damage;
  }
}
