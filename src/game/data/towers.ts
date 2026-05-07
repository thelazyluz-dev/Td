import type { TowerDef } from '../entities/types';

export const TOWER_DEFS: Record<string, TowerDef> = {
  Rifleman: {
    type: 'Rifleman',
    cost: 50,
    dps: 15,
    range: 150,
    fireRate: 1.5,
    projectileSpeed: 300,
  },
  Shotgunner: {
    type: 'Shotgunner',
    cost: 80,
    dps: 25,
    range: 90,
    fireRate: 1.0,
    projectileSpeed: 250,
    aoeRadius: 0, // cone, handled in combat
  },
  Sniper: {
    type: 'Sniper',
    cost: 120,
    dps: 45,
    range: 300,
    fireRate: 0.5,
    projectileSpeed: 600,
  },
  MachineGun: {
    type: 'MachineGun',
    cost: 150,
    dps: 30,
    range: 130,
    fireRate: 5.0,
    projectileSpeed: 400,
  },
  Flamethrower: {
    type: 'Flamethrower',
    cost: 100,
    dps: 8,
    range: 80,
    fireRate: 10, // continuous DoT
    projectileSpeed: 150,
  },
  Mortar: {
    type: 'Mortar',
    cost: 200,
    dps: 60,
    range: 250,
    fireRate: 0.3,
    projectileSpeed: 200,
    aoeRadius: 60,
  },
  BarbedWire: {
    type: 'BarbedWire',
    cost: 40,
    dps: 0,
    range: 0,
    fireRate: 0,
    projectileSpeed: 0,
  },
  Watchtower: {
    type: 'Watchtower',
    cost: 60,
    dps: 0,
    range: 200,
    fireRate: 0,
    projectileSpeed: 0,
  },
};
