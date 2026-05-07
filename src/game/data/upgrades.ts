export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  category: 'damage' | 'economy' | 'defense' | 'specialization' | 'special';
  minWave: number; // earliest wave this can appear (1-indexed)
  effect: Record<string, number | boolean>;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  // Damage
  {
    id: 'armor_piercing',
    name: 'Armor Piercing',
    description: '+25% damage to all towers',
    category: 'damage',
    minWave: 1,
    effect: { globalDamageBonus: 0.25 },
  },
  {
    id: 'headshot',
    name: 'Headshot',
    description: '5% chance to instantly kill',
    category: 'damage',
    minWave: 1,
    effect: { instaKillChance: 0.05 },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: '+50% damage when base HP < 50%',
    category: 'damage',
    minWave: 1,
    effect: { berserkerBonus: 0.5 },
  },
  {
    id: 'critical_hit',
    name: 'Critical Hit',
    description: '10% chance for 2x damage',
    category: 'damage',
    minWave: 1,
    effect: { critChance: 0.1 },
  },
  {
    id: 'heavy_rounds',
    name: 'Heavy Rounds',
    description: '+40% damage, -15% fire rate',
    category: 'damage',
    minWave: 1,
    effect: { globalDamageBonus: 0.4, globalFireRateMult: -0.15 },
  },
  // Economy
  {
    id: 'scavenger',
    name: 'Scavenger',
    description: '+30% gold from enemies',
    category: 'economy',
    minWave: 1,
    effect: { goldBonusMult: 0.3 },
  },
  {
    id: 'salvage_crew',
    name: 'Salvage Crew',
    description: '+5 gold every 10 seconds',
    category: 'economy',
    minWave: 1,
    effect: { passiveGoldPerTen: 5 },
  },
  {
    id: 'fire_sale',
    name: 'Fire Sale',
    description: 'Towers cost 25% less next wave',
    category: 'economy',
    minWave: 1,
    effect: { towerDiscountNextWave: 0.25 },
  },
  // Defense
  {
    id: 'reinforced_walls',
    name: 'Reinforced Walls',
    description: 'Base +5 HP',
    category: 'defense',
    minWave: 1,
    effect: { bonusBaseHP: 5 },
  },
  {
    id: 'adrenaline_shot',
    name: 'Adrenaline Shot',
    description: 'Survive at 1 HP once this run',
    category: 'defense',
    minWave: 1,
    effect: { surviveOnce: true },
  },
  {
    id: 'quick_repairs',
    name: 'Quick Repairs',
    description: 'Regen 1 HP every 30 seconds',
    category: 'defense',
    minWave: 1,
    effect: { regenHPPerThirty: 1 },
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    description: 'When base at 1 HP, towers fire 2x',
    category: 'defense',
    minWave: 1,
    effect: { lastStandFireMult: 2 },
  },
  // Specialization
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Snipers deal +100% damage',
    category: 'specialization',
    minWave: 4,
    effect: { sniperDamageBonus: 1.0 },
  },
  {
    id: 'spread_the_lead',
    name: 'Spread the Lead',
    description: 'Shotgunners hit +1 target',
    category: 'specialization',
    minWave: 4,
    effect: { shotgunnerExtraTargets: 1 },
  },
  {
    id: 'burning_hatred',
    name: 'Burning Hatred',
    description: 'Flamethrower DoT lasts 2x longer',
    category: 'specialization',
    minWave: 4,
    effect: { flamethrowerDotMult: 2 },
  },
  {
    id: 'auto_loader',
    name: 'Auto-Loader',
    description: 'Mortars fire 50% faster',
    category: 'specialization',
    minWave: 4,
    effect: { mortarFireRateBonus: 0.5 },
  },
  // Special
  {
    id: 'time_distortion',
    name: 'Time Distortion',
    description: 'Next wave is 20% slower (one-time)',
    category: 'special',
    minWave: 8,
    effect: { nextWaveSlowMult: 0.8, oneTime: true },
  },
  {
    id: 'air_strike',
    name: 'Air Strike',
    description: 'Button: kill all on-screen enemies (1 use)',
    category: 'special',
    minWave: 8,
    effect: { airStrikeCharges: 1 },
  },
  {
    id: 'emp',
    name: 'EMP',
    description: 'Button: freeze all enemies 3 sec (3 uses)',
    category: 'special',
    minWave: 8,
    effect: { empCharges: 3 },
  },
  {
    id: 'vampire_towers',
    name: 'Vampire Towers',
    description: '2% of damage dealt restores base HP',
    category: 'special',
    minWave: 8,
    effect: { lifestealPct: 0.02 },
  },
  {
    id: 'chain_reaction',
    name: 'Chain Reaction',
    description: '10% chance killed enemy explodes',
    category: 'special',
    minWave: 8,
    effect: { chainExplosionChance: 0.1 },
  },
];
