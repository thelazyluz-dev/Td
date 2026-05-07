import { Enemy } from '../entities/Enemy';
import { ENEMY_DEFS } from '../data/enemies';
import { WAVE_DEFS, generateWave } from '../data/waves';
import { BALANCE } from '../balance';

interface SpawnEntry {
  enemyType: string;
  count: number;
  remaining: number;
  interval: number;
  timer: number;
}

export class WaveSystem {
  private waveIndex: number = 0; // 0-based
  private spawnQueue: SpawnEntry[] = [];
  private groupIndex: number = 0;
  private modifier: 'speed' | 'armor' | null = null;

  totalEnemiesThisWave: number = 0;
  enemiesSpawned: number = 0;
  isActive: boolean = false;

  get currentWave() { return this.waveIndex + 1; } // 1-based

  startWave(waveIndex: number, modifier?: 'speed' | 'armor' | null) {
    this.waveIndex = waveIndex;
    const def = waveIndex < WAVE_DEFS.length ? WAVE_DEFS[waveIndex] : generateWave(waveIndex);
    this.modifier = modifier ?? def.modifier ?? null;
    this.spawnQueue = def.entries.map((e) => ({
      ...e,
      remaining: e.count,
      timer: 0,
    }));
    this.groupIndex = 0;
    this.totalEnemiesThisWave = def.entries.reduce((s, e) => s + e.count, 0);
    this.enemiesSpawned = 0;
    this.isActive = true;
  }

  update(dt: number, onSpawn: (enemy: Enemy) => void) {
    if (!this.isActive) return;

    // Process groups sequentially – move to next group when current is exhausted
    while (this.groupIndex < this.spawnQueue.length) {
      const group = this.spawnQueue[this.groupIndex];
      if (group.remaining === 0) {
        this.groupIndex++;
        continue;
      }

      group.timer -= dt;
      if (group.timer <= 0) {
        const def = ENEMY_DEFS[group.enemyType];
        if (!def) { group.remaining = 0; continue; }
        const hpMult = 1 + (this.waveIndex) * BALANCE.WAVE_HP_MULTIPLIER_PER_WAVE;
        const enemy = new Enemy(def, hpMult);
        if (this.modifier === 'speed') enemy.waveSpeedMult = 1.6;
        if (this.modifier === 'armor') enemy.armorMult = 2.0;
        onSpawn(enemy);
        this.enemiesSpawned++;
        group.remaining--;
        group.timer = group.interval;
      }
      break; // only advance one group per tick
    }

    if (this.groupIndex >= this.spawnQueue.length) {
      this.isActive = false;
    }
  }

  get isFinished() {
    return !this.isActive && this.spawnQueue.every((g) => g.remaining === 0);
  }
}
