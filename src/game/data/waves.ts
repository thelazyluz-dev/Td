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
