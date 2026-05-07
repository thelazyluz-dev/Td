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

    // Tower synergies: precompute per-tower bonus flags
    for (const tower of towers) {
      (tower as any)._synergyChains = 0;
      (tower as any)._synergyDmgBoost = false;
      (tower as any)._synergyCritBoost = false;
    }
    const glueTraps  = towers.filter(t => t.type === 'GlueTrap');
    const sprinklers = towers.filter(t => t.type === 'Sprinkler');
    const bugLights  = towers.filter(t => t.type === 'BugLight');
    for (const tower of towers) {
      if (tower.type === 'Zapper') {
        const nearGlue = glueTraps.some(g => Math.hypot(g.pos.x - tower.pos.x, g.pos.y - tower.pos.y) <= 200);
        const nearSprinkler = sprinklers.some(s => Math.hypot(s.pos.x - tower.pos.x, s.pos.y - tower.pos.y) <= 200);
        if (nearGlue) (tower as any)._synergyChains = 1;  // chain 1 extra enemy
        if (nearSprinkler) (tower as any)._synergyDmgBoost = true; // ×2 damage
      }
      if (tower.type === 'MagGlass') {
        const nearLight = bugLights.some(l => Math.hypot(l.pos.x - tower.pos.x, l.pos.y - tower.pos.y) <= 200);
        if (nearLight) (tower as any)._synergyCritBoost = true; // ×3 crit
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
        const wasAlive = !target.isDead;
        const firingTower = towers.find(t => t.id === proj.towerId) ?? null;
        this.applyProjectileHit(proj, target, firingTower, aliveEnemies, upgrades, berserkerActive, onLifesteal, onGoldEarned);
        if (wasAlive && target.isDead) {
          if (firingTower) firingTower.kills++;
        }
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
    firingTower: Tower | null,
    aliveEnemies: Enemy[],
    upgrades: CombatUpgrades,
    berserkerActive: boolean,
    onLifesteal: (amount: number) => void,
    onGoldEarned: (amount: number) => void,
  ) {
    if (target.isDead) return;

    let dmg = proj.damage * (1 + upgrades.globalDamageBonus);
    if (berserkerActive) dmg *= 1 + upgrades.berserkerBonus;
    if (target.damageAmp > 0) dmg *= 1 + target.damageAmp;
    if (firingTower && (firingTower as any)._synergyDmgBoost) dmg *= 2;

    // Crit (MagGlass synergy triples crit chance)
    const critChance = (firingTower && (firingTower as any)._synergyCritBoost)
      ? upgrades.critChance * 3
      : upgrades.critChance;
    if (critChance > 0 && Math.random() < critChance) dmg *= 2;

    // Insta-kill
    const instakill = upgrades.instaKillChance > 0 && Math.random() < upgrades.instaKillChance;
    const finalDmg = instakill ? target.hp : dmg;

    target.takeDamage(finalDmg);

    // Tower passives on hit
    if (firingTower && !target.isDead) {
      if (firingTower.type === 'BugSpray') {
        target.activeSlowMult = 0.70;
        target.slowTimer = 2.0;
      } else if (firingTower.type === 'Sprinkler') {
        target.activeSlowMult = Math.min(target.activeSlowMult, 0.85);
        target.slowTimer = Math.max(target.slowTimer, 1.5);
      } else if (firingTower.type === 'Swatter' && Math.random() < 0.12) {
        target.stunTimer = Math.max(target.stunTimer, 0.8);
      }
    }

    // Zapper: chain lightning to nearest extra enemy
    if (firingTower?.type === 'Zapper') {
      const chainCount = (firingTower as any)._synergyChains ?? 1;
      let chained = 0;
      const sorted = aliveEnemies
        .filter(e => e.id !== target.id && !e.isDead)
        .sort((a, b) =>
          Math.hypot(a.pos.x - target.pos.x, a.pos.y - target.pos.y) -
          Math.hypot(b.pos.x - target.pos.x, b.pos.y - target.pos.y));
      for (const e of sorted) {
        if (chained >= chainCount) break;
        if (Math.hypot(e.pos.x - target.pos.x, e.pos.y - target.pos.y) > 100) break;
        e.takeDamage(finalDmg * 0.5);
        if (e.isDead) onGoldEarned(e.goldReward);
        chained++;
      }
    }

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
