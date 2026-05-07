import { Application, Graphics, Container } from 'pixi.js';
import type { GameState } from './GameEngine';
import { PATH_WAYPOINTS } from './PathManager';
import { BALANCE } from '../balance';

const CANVAS_W = 800;
const CANVAS_H = 500;
const TILE = BALANCE.TILE_SIZE;

// Enemy color by type
const ENEMY_COLORS: Record<string, number> = {
  Walker: 0x55aa55,
  Runner: 0x88cc44,
  Tank: 0x888844,
  Spitter: 0xaacc00,
  Crawler: 0x446644,
  Screamer: 0xcc8800,
  Bloater: 0x886600,
  Alpha: 0xff4400,
  PatientZero: 0xff0000,
};

const TOWER_COLORS: Record<string, number> = {
  Rifleman: 0x4488cc,
  Shotgunner: 0xcc7744,
  Sniper: 0x44aacc,
  MachineGun: 0xcc4444,
  Flamethrower: 0xff6600,
  Mortar: 0x888888,
  BarbedWire: 0xaaaa44,
  Watchtower: 0x44cc88,
};

export class Renderer {
  private app: Application | null = null;
  private pathLayer = new Container();
  private towerLayer = new Container();
  private enemyLayer = new Container();
  private projectileLayer = new Container();
  private uiLayer = new Container();

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: 0x2a2a2a,
      antialias: false,
    });
    container.appendChild(this.app.canvas);
    this.app.stage.addChild(this.pathLayer, this.towerLayer, this.enemyLayer, this.projectileLayer, this.uiLayer);
    this.drawStaticPath();
  }

  private drawStaticPath() {
    this.pathLayer.removeChildren();
    const g = new Graphics();

    // Draw grid
    g.setStrokeStyle({ width: 1, color: 0x3a3a3a });
    for (let x = 0; x <= CANVAS_W; x += TILE) {
      g.moveTo(x, 0).lineTo(x, CANVAS_H);
    }
    for (let y = 0; y <= CANVAS_H; y += TILE) {
      g.moveTo(0, y).lineTo(CANVAS_W, y);
    }
    g.stroke();

    // Draw path
    g.setStrokeStyle({ width: TILE * 0.9, color: 0x4a3a2a });
    g.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
    for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
      g.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
    }
    g.stroke();

    // Draw waypoint dots
    for (const wp of PATH_WAYPOINTS) {
      g.circle(wp.x, wp.y, 5).fill({ color: 0x886655 });
    }

    // Start / end markers
    const wp0 = PATH_WAYPOINTS[0];
    const wpEnd = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    g.rect(wp0.x - 5, wp0.y - 15, 10, 30).fill({ color: 0x44ff44 });
    g.rect(wpEnd.x - 5, wpEnd.y - 15, 10, 30).fill({ color: 0xff4444 });

    this.pathLayer.addChild(g);
  }

  render(state: GameState) {
    if (!this.app) return;
    this.renderTowers(state);
    this.renderEnemies(state);
    this.renderProjectiles(state);
  }

  private renderTowers(state: GameState) {
    this.towerLayer.removeChildren();
    for (const tower of state.towers) {
      const g = new Graphics();
      const color = TOWER_COLORS[tower.type] ?? 0xffffff;
      g.rect(-TILE * 0.4, -TILE * 0.4, TILE * 0.8, TILE * 0.8).fill({ color });
      g.rect(-2, -TILE * 0.45, 4, TILE * 0.45).fill({ color: 0xcccccc }); // barrel
      g.position.set(tower.pos.x, tower.pos.y);
      this.towerLayer.addChild(g);

      // Range circle (faint)
      const rg = new Graphics();
      rg.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.1 });
      rg.circle(0, 0, tower.effectiveRange).stroke();
      rg.position.set(tower.pos.x, tower.pos.y);
      this.towerLayer.addChild(rg);
    }
  }

  private renderEnemies(state: GameState) {
    this.enemyLayer.removeChildren();
    const alive = state.enemies.filter((e) => !e.isDead && !e.reachedEnd);
    for (const enemy of alive) {
      const g = new Graphics();
      const color = ENEMY_COLORS[enemy.type] ?? 0xffffff;
      const r = enemy.type === 'Tank' || enemy.type === 'Alpha' || enemy.type === 'PatientZero' ? 14 : 8;
      g.circle(0, 0, r).fill({ color });
      // HP bar
      const barW = r * 2.5;
      const barH = 3;
      g.rect(-barW / 2, -r - 6, barW, barH).fill({ color: 0x333333 });
      const hpRatio = enemy.hp / enemy.maxHp;
      const hpColor = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc00 : 0xcc4444;
      g.rect(-barW / 2, -r - 6, barW * hpRatio, barH).fill({ color: hpColor });
      g.position.set(enemy.pos.x, enemy.pos.y);
      this.enemyLayer.addChild(g);
    }
  }

  private renderProjectiles(state: GameState) {
    this.projectileLayer.removeChildren();
    for (const proj of state.projectiles) {
      const g = new Graphics();
      g.circle(0, 0, 3).fill({ color: 0xffff88 });
      g.position.set(proj.pos.x, proj.pos.y);
      this.projectileLayer.addChild(g);
    }
  }

  destroy() {
    this.app?.destroy(true);
    this.app = null;
  }

  get canvasWidth() { return CANVAS_W; }
  get canvasHeight() { return CANVAS_H; }
}

export { CANVAS_W, CANVAS_H, TILE };
