import type { WaveDef } from '../entities/types';

// interval = seconds between spawns within this group
export const WAVE_DEFS: WaveDef[] = [
  // Wave 1
  { entries: [{ enemyType: 'Walker', count: 8, interval: 1.2 }] },
  // Wave 2
  {
    entries: [
      { enemyType: 'Walker', count: 12, interval: 1.0 },
      { enemyType: 'Runner', count: 3, interval: 0.8 },
    ],
  },
  // Wave 3
  {
    entries: [
      { enemyType: 'Walker', count: 15, interval: 0.9 },
      { enemyType: 'Runner', count: 6, interval: 0.7 },
      { enemyType: 'Tank', count: 1, interval: 2.0 },
    ],
  },
  // Wave 4
  {
    entries: [
      { enemyType: 'Walker', count: 20, interval: 0.8 },
      { enemyType: 'Runner', count: 8, interval: 0.6 },
      { enemyType: 'Spitter', count: 2, interval: 2.0 },
    ],
  },
  // Wave 5 - Mid-boss
  {
    entries: [
      { enemyType: 'Alpha', count: 1, interval: 0 },
      { enemyType: 'Walker', count: 10, interval: 1.0 },
    ],
  },
  // Wave 6
  {
    entries: [
      { enemyType: 'Runner', count: 15, interval: 0.5 },
      { enemyType: 'Crawler', count: 4, interval: 1.5 },
      { enemyType: 'Tank', count: 2, interval: 3.0 },
    ],
  },
  // Wave 7
  {
    entries: [
      { enemyType: 'Walker', count: 20, interval: 0.8 },
      { enemyType: 'Screamer', count: 1, interval: 0 },
      { enemyType: 'Spitter', count: 3, interval: 2.0 },
    ],
  },
  // Wave 8
  {
    entries: [
      { enemyType: 'Crawler', count: 8, interval: 0.8 },
      { enemyType: 'Bloater', count: 4, interval: 2.0 },
      { enemyType: 'Tank', count: 2, interval: 3.0 },
    ],
  },
  // Wave 9
  {
    entries: [
      { enemyType: 'Screamer', count: 1, interval: 0 },
      { enemyType: 'Bloater', count: 2, interval: 2.0 },
      { enemyType: 'Walker', count: 15, interval: 0.7 },
      { enemyType: 'Runner', count: 10, interval: 0.5 },
      { enemyType: 'Crawler', count: 5, interval: 1.0 },
    ],
  },
  // Wave 10 - Final boss
  {
    entries: [
      { enemyType: 'PatientZero', count: 1, interval: 0 },
      { enemyType: 'Walker', count: 10, interval: 0.8 },
      { enemyType: 'Runner', count: 5, interval: 0.6 },
      { enemyType: 'Tank', count: 2, interval: 3.0 },
      { enemyType: 'Crawler', count: 3, interval: 1.0 },
    ],
  },
];
