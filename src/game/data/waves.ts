import type { WaveDef } from '../entities/types';

export const WAVE_DEFS: WaveDef[] = [
  // Wave 1 — First scouts
  { entries: [{ enemyType: 'Ant', count: 8, interval: 1.2 }] },
  // Wave 2
  { entries: [
    { enemyType: 'Ant', count: 12, interval: 1.0 },
    { enemyType: 'Fly', count: 3,  interval: 0.8 },
  ]},
  // Wave 3
  { entries: [
    { enemyType: 'Ant',   count: 15, interval: 0.9 },
    { enemyType: 'Fly',   count: 6,  interval: 0.7 },
    { enemyType: 'Roach', count: 1,  interval: 2.0 },
  ]},
  // Wave 4
  { entries: [
    { enemyType: 'Ant',      count: 20, interval: 0.8 },
    { enemyType: 'Fly',      count: 8,  interval: 0.6 },
    { enemyType: 'Mosquito', count: 2,  interval: 2.0 },
  ]},
  // Wave 5 — Mid-boss: Fire Ant Queen
  { entries: [
    { enemyType: 'FireAnt', count: 1,  interval: 0   },
    { enemyType: 'Ant',     count: 10, interval: 1.0 },
  ]},
  // Wave 6
  { entries: [
    { enemyType: 'Fly',    count: 15, interval: 0.5 },
    { enemyType: 'Beetle', count: 4,  interval: 1.5 },
    { enemyType: 'Roach',  count: 2,  interval: 3.0 },
  ]},
  // Wave 7
  { entries: [
    { enemyType: 'Ant',      count: 20, interval: 0.8 },
    { enemyType: 'Wasp',     count: 1,  interval: 0   },
    { enemyType: 'Mosquito', count: 3,  interval: 2.0 },
  ]},
  // Wave 8
  { entries: [
    { enemyType: 'Beetle',  count: 8, interval: 0.8 },
    { enemyType: 'Termite', count: 4, interval: 2.0 },
    { enemyType: 'Roach',   count: 2, interval: 3.0 },
  ]},
  // Wave 9
  { entries: [
    { enemyType: 'Wasp',    count: 1,  interval: 0   },
    { enemyType: 'Termite', count: 2,  interval: 2.0 },
    { enemyType: 'Ant',     count: 15, interval: 0.7 },
    { enemyType: 'Fly',     count: 10, interval: 0.5 },
    { enemyType: 'Beetle',  count: 5,  interval: 1.0 },
  ]},
  // Wave 10 — Final Boss: Queen Ant
  { entries: [
    { enemyType: 'QueenAnt', count: 1,  interval: 0   },
    { enemyType: 'Ant',      count: 10, interval: 0.8 },
    { enemyType: 'Fly',      count: 5,  interval: 0.6 },
    { enemyType: 'Roach',    count: 2,  interval: 3.0 },
    { enemyType: 'Beetle',   count: 3,  interval: 1.0 },
  ]},
];

// Generates a procedural wave for wave indices beyond WAVE_DEFS (index >= 10)
export function generateWave(waveIndex: number): WaveDef {
  const extra = waveIndex - 9; // 1-based offset past wave 10
  const entries: WaveDef['entries'] = [];

  const antCount = 10 + extra * 5;
  const flyCount = 5 + extra * 3;
  const heavyCount = 2 + Math.floor(extra * 0.7);
  const spawnSpeed = (base: number) => Math.max(0.2, base - extra * 0.02);

  entries.push({ enemyType: 'Ant',    count: antCount,              interval: spawnSpeed(0.8) });
  entries.push({ enemyType: 'Fly',    count: flyCount,              interval: spawnSpeed(0.5) });
  entries.push({ enemyType: 'Beetle', count: heavyCount,            interval: spawnSpeed(1.0) });
  entries.push({ enemyType: 'Termite',count: Math.ceil(heavyCount * 0.6), interval: spawnSpeed(1.5) });
  if (extra >= 3) {
    entries.push({ enemyType: 'Roach', count: Math.max(1, Math.floor(heavyCount * 0.5)), interval: spawnSpeed(2.0) });
  }
  if (extra >= 5) {
    entries.push({ enemyType: 'Mosquito', count: Math.floor(extra / 3), interval: spawnSpeed(1.8) });
  }

  // Boss every 5 waves
  if (extra % 5 === 0) {
    entries.unshift({ enemyType: 'QueenAnt', count: 1 + Math.floor(extra / 10), interval: 3.0 });
  } else if (extra % 5 === 2) {
    entries.unshift({ enemyType: 'FireAnt', count: 1 + Math.floor(extra / 5), interval: 2.0 });
  } else if (extra % 5 === 4) {
    entries.unshift({ enemyType: 'Wasp', count: 1 + Math.floor(extra / 5), interval: 2.5 });
  }

  return { entries };
}
