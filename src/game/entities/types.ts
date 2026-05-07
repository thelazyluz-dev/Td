export interface EnemyDef {
  type: string;
  hp: number;
  speed: number; // tiles/sec multiplier
  damageToBase: number;
  goldReward: number;
  specialAbility?: string;
}

export interface TowerDef {
  type: string;
  cost: number;
  dps: number;
  range: number; // pixels
  fireRate: number; // shots/sec
  projectileSpeed: number;
  aoeRadius?: number;
}

export interface WaveDef {
  entries: Array<{ enemyType: string; count: number; interval: number }>;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type GamePhase = 'build' | 'wave' | 'upgrade' | 'gameover' | 'win';
