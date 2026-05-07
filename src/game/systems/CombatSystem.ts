import { Tower } from '../entities/Tower';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';

export interface CombatUpgrades {
  globalDamageBonus: number;  // additive multiplier sum
  critChance: number;
  instaKillChance: number;
  berserkerBonus: number;
  lastStandFireMult: number;
  lifestealPct: number;
  chainExplosionChance: number;
}

export const DEFAULT_COMBAT_UPGRADES: CombatUpgrades = {
  globalDamageBonus: 0,
  critChance: 0,
  instaKillChance: 0,
  berserkerBonus: 0,
  lastStandFireMult: 1,
  lifestealPct: 0,
  chainExplosionChance: 0,
};

export class CombatSystem {
  private projectiles: Projectile[] = [];

  update(
    dt: number,
    towers: Tower[],
    enemies: Enemy[],
    upgrades: CombatUpgrades,
    baseHp: number,
    baseMaxHp: number,
    onLifesteal: (amount: number) => void,
    onGoldEarned: (amount: number) => void,
  ) {
    const aliveEnemies = enemies.filter((e) => !e.isDead && !e.reachedEnd);

    // Reset per-frame utility effects so they only apply while in range
    for (const e of aliveEnemies) { e.slowMult = 1.0; e.damageAmp = 0; }

    // Utility towers: GlueTrap slows 70%, BugLight amplifies damage taken +35%
    for (const tower of towers) {
      if (tower.type === 'GlueTrap' && tower.effectiveRange > 0) {
        for (const e of aliveEnemies) {
          if (Math.hypot(e.pos.x - tower.pos.x, e.pos.y - tower.pos.y) <= tower.effectiveRange)
            e.slowMult = Math.min(e.slowMult, 0.30);
        }
      } else if (tower.type === 'BugLight' && tower.effectiveRange > 0) {
        for (const e of aliveEnemies) {
          if (Math.hypot(e.pos.x - tower.pos.x, e.pos.y - tower.pos.y) <= tower.effectiveRange)
            e.damageAmp = Math.max(e.damageAmp, 0.35);
        }
      }
    }

    // Tower targeting & firing
    const lastStandActive = baseHp === 1 && upgrades.lastStandFireMult > 1;
    const berserkerActive = baseHp / baseMaxHp < 0.5 && upgrades.berserkerBonus > 0;

    for (const tower of towers) {
      if (tower.effectiveFireRate === 0) continue; // utility tower

      tower.fireCooldown -= dt;
      if (tower.fireCooldown > 0) continue;

      // Find nearest enemy in range
      let nearest: Enemy | null = null;
      let nearestDist = Infinity;
      for (const e of aliveEnemies) {
        const dist = Math.hypot(e.pos.x - tower.pos.x, e.pos.y - tower.pos.y);
        if (dist <= tower.effectiveRange && dist < nearestDist) {
          nearest = e;
          nearestDist = dist;
        }
      }
      if (!nearest) continue;

      tower.fireCooldown = 1 / tower.effectiveFireRate;
      if (lastStandActive) tower.fireCooldown /= upgrades.lastStandFireMult;

      const proj = new Projectile(tower.id, nearest.id, tower.pos, tower.projectileSpeed, tower.effectiveDamage);
      this.projectiles.push(proj);
    }

    // Move projectiles (homing)
    for (const proj of this.projectiles) {
      if (proj.hit) continue;
      const target = aliveEnemies.find((e) => e.id === proj.targetEnemyId);
      if (!target) { proj.hit = true; continue; }

      const dx = target.pos.x - proj.pos.x;
      const dy = target.pos.y - proj.pos.y;
      const dist = Math.hypot(dx, dy);
      const step = proj.speed * dt;

      if (dist <= step) {
        proj.hit = true;
        proj.pos = { ...target.pos };
        this.applyProjectileHit(proj, target, aliveEnemies, upgrades, berserkerActive, onLifesteal, onGoldEarned);
      } else {
        proj.pos.x += (dx / dist) * step;
        proj.pos.y += (dy / dist) * step;
      }
    }

    this.projectiles = this.projectiles.filter((p) => !p.hit);
  }

  private applyProjectileHit(
    proj: Projectile,
    target: Enemy,
    aliveEnemies: Enemy[],
    upgrades: CombatUpgrades,
    berserkerActive: boolean,
    onLifesteal: (amount: number) => void,
    onGoldEarned: (amount: number) => void,
  ) {
    if (target.isDead) return;

    let dmg = proj.damage * (1 + upgrades.globalDamageBonus);
    if (berserkerActive) dmg *= 1 + upgrades.berserkerBonus;
    if (target.damageAmp > 0) dmg *= 1 + target.damageAmp; // BugLight amplification

    // Crit
    if (upgrades.critChance > 0 && Math.random() < upgrades.critChance) dmg *= 2;

    // Insta-kill
    const instakill = upgrades.instaKillChance > 0 && Math.random() < upgrades.instaKillChance;
    const finalDmg = instakill ? target.hp : dmg;

    target.takeDamage(finalDmg);

    if (upgrades.lifestealPct > 0) onLifesteal(finalDmg * upgrades.lifestealPct);

    if (target.isDead) {
      onGoldEarned(target.goldReward);

      if (upgrades.chainExplosionChance > 0 && Math.random() < upgrades.chainExplosionChance) {
        for (const e of aliveEnemies) {
          if (e.id !== target.id && Math.hypot(e.pos.x - target.pos.x, e.pos.y - target.pos.y) < 60) {
            e.takeDamage(30);
            if (e.isDead) onGoldEarned(e.goldReward);
          }
        }
      }
    }
  }

  getProjectiles(): Readonly<Projectile[]> {
    return this.projectiles;
  }
}
