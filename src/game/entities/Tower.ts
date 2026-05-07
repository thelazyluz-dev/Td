import type { TowerDef, Vec2 } from './types';

let _nextTowerId = 1;

export class Tower {
  id: number;
  type: string;
  pos: Vec2;
  range: number;
  fireRate: number; // shots/sec
  damage: number; // per shot = dps / fireRate
  projectileSpeed: number;
  aoeRadius: number;

  fireCooldown: number = 0; // seconds until next shot
  targetId: number | null = null;

  // runtime modifiers applied by upgrades (multipliers)
  damageMultiplier: number = 1.0;
  fireRateMultiplier: number = 1.0;
  rangeMultiplier: number = 1.0;

  // upgrade tracking
  baseCost: number;
  upgrades: number = 0;
  totalSpent: number; // base cost + all upgrade costs paid (for sell refund)

  constructor(def: TowerDef, pos: Vec2) {
    this.id = _nextTowerId++;
    this.type = def.type;
    this.pos = { ...pos };
    this.range = def.range;
    this.fireRate = def.fireRate;
    this.damage = def.fireRate > 0 ? def.dps / def.fireRate : 0;
    this.projectileSpeed = def.projectileSpeed;
    this.aoeRadius = def.aoeRadius ?? 0;
    this.fireCooldown = 0;
    this.baseCost = def.cost;
    this.totalSpent = def.cost;
  }

  get effectiveRange() { return this.range * this.rangeMultiplier; }
  get effectiveDamage() { return this.damage * this.damageMultiplier; }
  get effectiveFireRate() { return this.fireRate * this.fireRateMultiplier; }

  get upgradeCost(): number {
    const base = [1.5, 2.0, 3.0];
    if (this.upgrades < base.length) return Math.round(this.baseCost * base[this.upgrades]);
    // Exponential scaling for levels 3+
    return Math.round(this.baseCost * (3.0 + (this.upgrades - 2) * 1.8));
  }
}
