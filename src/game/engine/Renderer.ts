import { Application, Graphics, Container, Text } from 'pixi.js';
import type { GameState } from './GameEngine';
import { PATH_WAYPOINTS } from './PathManager';
import { BALANCE } from '../balance';

export const CANVAS_W = 800;
export const CANVAS_H = 500;
export const TILE = BALANCE.TILE_SIZE;

const ENEMY_COLORS: Record<string, number> = {
  Walker:     0x55aa55,
  Runner:     0x88dd44,
  Tank:       0x999944,
  Spitter:    0xaacc00,
  Crawler:    0x336633,
  Screamer:   0xdd8800,
  Bloater:    0x996600,
  Alpha:      0xff5500,
  PatientZero:0xff1111,
};

const TOWER_COLORS: Record<string, number> = {
  Rifleman:    0x3377cc,
  Shotgunner:  0xcc6633,
  Sniper:      0x33aadd,
  MachineGun:  0xcc3333,
  Flamethrower:0xff5500,
  Mortar:      0x777777,
  BarbedWire:  0x999933,
  Watchtower:  0x33bb77,
};

function enemyRadius(type: string): number {
  if (type === 'PatientZero') return 18;
  if (type === 'Alpha') return 15;
  if (type === 'Tank' || type === 'Bloater') return 12;
  return 8;
}

const DEATH_DUR   = 0.35;
const FLASH_DUR   = 0.20;
const MUZZLE_DUR  = 0.09;
const SPAWN_DUR   = 0.22;
const TRAIL_LEN   = 6;

interface EnemySprite {
  container: Container;
  body: Graphics;
  hpFg: Graphics;
  prevHp: number;
  flashTimer: number;
  bobTimer: number;
  isDying: boolean;
  deathTimer: number;
}

interface TowerSprite {
  container: Container;
  barrel: Container;
  muzzle: Graphics;
  rangeRing: Graphics;
  muzzleTimer: number;
  angle: number;
  popTimer: number;
}

interface Trail {
  container: Container;
  dots: Graphics[];
  positions: Array<{ x: number; y: number }>;
}

interface Particle {
  g: Graphics;
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
}

interface DmgNum {
  text: Text;
  vy: number;
  life: number;
  maxLife: number;
}

export class Renderer {
  private app: Application | null = null;

  private pathLayer       = new Container();
  private towerLayer      = new Container();
  private enemyLayer      = new Container();
  private projectileLayer = new Container();
  private particleLayer   = new Container();
  private uiLayer         = new Container();

  private enemySprites  = new Map<number, EnemySprite>();
  private towerSprites  = new Map<number, TowerSprite>();
  private trails        = new Map<number, Trail>();
  private particles: Particle[] = [];
  private dmgNums: DmgNum[] = [];

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: 0x111111,
      antialias: true,
    });
    container.appendChild(this.app.canvas);
    this.app.stage.addChild(
      this.pathLayer,
      this.towerLayer,
      this.enemyLayer,
      this.projectileLayer,
      this.particleLayer,
      this.uiLayer,
    );
    this.drawPath();
  }

  private drawPath(): void {
    const g = new Graphics();

    // Grid
    g.setStrokeStyle({ width: 1, color: 0x222222 });
    for (let x = 0; x <= CANVAS_W; x += TILE) { g.moveTo(x, 0).lineTo(x, CANVAS_H); }
    for (let y = 0; y <= CANVAS_H; y += TILE) { g.moveTo(0, y).lineTo(CANVAS_W, y); }
    g.stroke();

    // Path (3 layered strokes for depth)
    const drawPathStroke = (w: number, color: number, alpha = 1) => {
      g.setStrokeStyle({ width: w, color, alpha });
      g.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
      for (let i = 1; i < PATH_WAYPOINTS.length; i++) g.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
      g.stroke();
    };
    drawPathStroke(TILE * 0.95, 0x1a1005);
    drawPathStroke(TILE * 0.78, 0x3a2810);
    drawPathStroke(TILE * 0.60, 0x4a3418);
    drawPathStroke(3, 0x6a5030, 0.4); // centre highlight

    // Start
    const s = PATH_WAYPOINTS[0];
    g.circle(s.x, s.y, 9).fill({ color: 0x22c55e });
    g.setStrokeStyle({ width: 2, color: 0x15803d }); g.circle(s.x, s.y, 9).stroke();

    // End (base)
    const e = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    g.circle(e.x, e.y, 9).fill({ color: 0xdc2626 });
    g.setStrokeStyle({ width: 2, color: 0x991b1b }); g.circle(e.x, e.y, 9).stroke();

    this.pathLayer.addChild(g);
  }

  // ── public entry point (called from RAF loop in GameCanvas) ──────────────

  update(state: GameState, dt: number): void {
    if (!this.app) return;
    this.syncTowers(state, dt);
    this.syncEnemies(state, dt);
    this.syncProjectiles(state, dt);
    this.tickParticles(dt);
    this.tickDmgNums(dt);
  }

  // ── TOWERS ───────────────────────────────────────────────────────────────

  private syncTowers(state: GameState, dt: number): void {
    const ids = new Set(state.towers.map(t => t.id));

    for (const tower of state.towers) {
      let sp = this.towerSprites.get(tower.id);
      if (!sp) {
        sp = this.makeTowerSprite(tower.type, tower.effectiveRange);
        sp.container.position.set(tower.pos.x, tower.pos.y);
        sp.container.scale.set(0);
        this.towerLayer.addChild(sp.container);
        this.towerSprites.set(tower.id, sp);
      }

      // Pop-in
      if (sp.popTimer > 0) {
        sp.popTimer -= dt;
        const t = 1 - sp.popTimer / SPAWN_DUR;
        const s = t < 0.6 ? (t / 0.6) * 1.2 : 1.2 - ((t - 0.6) / 0.4) * 0.2;
        sp.container.scale.set(Math.max(0, s));
      }

      // Barrel rotation
      let targetAngle = sp.angle;
      let best = Infinity;
      for (const en of state.enemies) {
        if (en.isDead || en.reachedEnd) continue;
        const dx = en.pos.x - tower.pos.x;
        const dy = en.pos.y - tower.pos.y;
        const d = Math.hypot(dx, dy);
        if (d <= tower.effectiveRange && d < best) {
          best = d;
          targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }
      let diff = targetAngle - sp.angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      sp.angle += diff * Math.min(1, dt * 14);
      sp.barrel.rotation = sp.angle;

      // Muzzle decay
      if (sp.muzzleTimer > 0) {
        sp.muzzleTimer -= dt;
        sp.muzzle.alpha = Math.max(0, sp.muzzleTimer / MUZZLE_DUR);
      }
    }

    for (const [id, sp] of this.towerSprites) {
      if (!ids.has(id)) { this.towerLayer.removeChild(sp.container); this.towerSprites.delete(id); }
    }
  }

  private makeTowerSprite(type: string, range: number): TowerSprite {
    const color = TOWER_COLORS[type] ?? 0xaaaaaa;
    const cont = new Container();

    const rangeRing = new Graphics();
    rangeRing.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.07 });
    rangeRing.circle(0, 0, range).stroke();
    cont.addChild(rangeRing);

    const half = TILE * 0.37;
    const base = new Graphics();
    base.roundRect(-half, -half, half * 2, half * 2, 5).fill({ color });
    base.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.45 });
    base.roundRect(-half, -half, half * 2, half * 2, 5).stroke();
    // inner highlight
    base.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.15 });
    base.roundRect(-half + 2, -half + 2, half * 2 - 4, half * 2 - 4, 4).stroke();
    cont.addChild(base);

    const barrel = new Container();
    const bG = new Graphics();
    bG.roundRect(-3.5, -TILE * 0.44, 7, TILE * 0.40, 2).fill({ color: 0xdddddd });
    bG.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.3 });
    bG.roundRect(-3.5, -TILE * 0.44, 7, TILE * 0.40, 2).stroke();
    barrel.addChild(bG);

    const muzzle = new Graphics();
    muzzle.circle(0, -TILE * 0.44, 8).fill({ color: 0xffee88 });
    muzzle.alpha = 0;
    barrel.addChild(muzzle);
    cont.addChild(barrel);

    return { container: cont, barrel, muzzle, rangeRing, muzzleTimer: 0, angle: -Math.PI / 2, popTimer: SPAWN_DUR };
  }

  triggerMuzzle(towerId: number): void {
    const sp = this.towerSprites.get(towerId);
    if (sp) { sp.muzzleTimer = MUZZLE_DUR; sp.muzzle.alpha = 1; }
  }

  // ── ENEMIES ──────────────────────────────────────────────────────────────

  private syncEnemies(state: GameState, dt: number): void {
    const seen = new Set<number>();

    for (const en of state.enemies) {
      if (en.reachedEnd) continue;
      seen.add(en.id);

      let sp = this.enemySprites.get(en.id);
      if (!sp) {
        sp = this.makeEnemySprite(en.type);
        sp.prevHp = en.hp;
        sp.bobTimer = Math.random() * Math.PI * 2;
        this.enemyLayer.addChild(sp.container);
        this.enemySprites.set(en.id, sp);
      }

      // Trigger death
      if (en.isDead && !sp.isDying) {
        sp.isDying = true;
        sp.deathTimer = DEATH_DUR;
        this.spawnDeathParticles(en.pos.x, en.pos.y, ENEMY_COLORS[en.type] ?? 0x55aa55, enemyRadius(en.type));
      }

      // Death animation
      if (sp.isDying) {
        sp.deathTimer -= dt;
        const t = Math.max(0, 1 - sp.deathTimer / DEATH_DUR);
        sp.container.alpha = 1 - t;
        sp.container.scale.set(1 - t * 0.7);
        if (sp.deathTimer <= 0) { this.enemyLayer.removeChild(sp.container); this.enemySprites.delete(en.id); }
        continue;
      }

      // Damage detection
      if (en.hp < sp.prevHp) {
        sp.flashTimer = FLASH_DUR;
        this.spawnDmgNum(en.pos.x, en.pos.y - enemyRadius(en.type) - 8, Math.round(sp.prevHp - en.hp));
      }
      sp.prevHp = en.hp;

      // Flash tint
      if (sp.flashTimer > 0) {
        sp.flashTimer -= dt;
        sp.body.tint = sp.flashTimer > FLASH_DUR * 0.55 ? 0xffffff : 0xff3333;
      } else {
        sp.body.tint = 0xffffff;
      }

      // Bob + position
      sp.bobTimer += dt;
      const bob = Math.sin(sp.bobTimer * Math.PI * 3.5) * 1.8;
      sp.container.position.set(en.pos.x, en.pos.y + bob);

      // HP bar
      const r = enemyRadius(en.type);
      const bW = r * 2.8;
      const ratio = Math.max(0, en.hp / en.maxHp);
      const hpColor = ratio > 0.6 ? 0x22c55e : ratio > 0.3 ? 0xf59e0b : 0xef4444;
      sp.hpFg.clear().rect(-bW / 2, -r - 8, bW * ratio, 3).fill({ color: hpColor });
    }

    for (const [id, sp] of this.enemySprites) {
      if (!seen.has(id) && !sp.isDying) { this.enemyLayer.removeChild(sp.container); this.enemySprites.delete(id); }
    }
  }

  private makeEnemySprite(type: string): EnemySprite {
    const color = ENEMY_COLORS[type] ?? 0x888888;
    const r = enemyRadius(type);
    const cont = new Container();

    // Shadow
    const shadow = new Graphics();
    shadow.ellipse(0, r + 1, r * 0.9, 3).fill({ color: 0x000000, alpha: 0.3 });
    cont.addChild(shadow);

    const body = new Graphics();
    body.circle(0, 0, r).fill({ color });
    // Shine
    body.circle(-r * 0.28, -r * 0.28, r * 0.25).fill({ color: 0xffffff, alpha: 0.18 });
    body.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.35 });
    body.circle(0, 0, r).stroke();
    cont.addChild(body);

    const bW = r * 2.8;
    const hpBg = new Graphics();
    hpBg.rect(-bW / 2, -r - 8, bW, 3).fill({ color: 0x111111 });
    hpBg.setStrokeStyle({ width: 0.5, color: 0x000000 });
    hpBg.rect(-bW / 2, -r - 8, bW, 3).stroke();
    cont.addChild(hpBg);

    const hpFg = new Graphics();
    hpFg.rect(-bW / 2, -r - 8, bW, 3).fill({ color: 0x22c55e });
    cont.addChild(hpFg);

    return { container: cont, body, hpFg, prevHp: 0, flashTimer: 0, bobTimer: 0, isDying: false, deathTimer: 0 };
  }

  // ── PROJECTILES ──────────────────────────────────────────────────────────

  private syncProjectiles(state: GameState, _dt: number): void {
    const ids = new Set(state.projectiles.map(p => p.id));

    for (const proj of state.projectiles) {
      if (!this.trails.has(proj.id)) {
        this.triggerMuzzle(proj.towerId);
        const cont = new Container();
        const dots: Graphics[] = [];
        for (let i = 0; i < TRAIL_LEN; i++) {
          const g = new Graphics();
          const r = Math.max(1, 3.5 - i * 0.5);
          g.circle(0, 0, r).fill({ color: i === 0 ? 0xffffff : 0xffee44 });
          g.alpha = 0;
          cont.addChild(g);
          dots.push(g);
        }
        this.projectileLayer.addChild(cont);
        this.trails.set(proj.id, { container: cont, dots, positions: [] });
      }

      const t = this.trails.get(proj.id)!;
      t.positions.unshift({ x: proj.pos.x, y: proj.pos.y });
      if (t.positions.length > TRAIL_LEN) t.positions.pop();

      for (let i = 0; i < TRAIL_LEN; i++) {
        const pos = t.positions[i];
        if (pos) { t.dots[i].position.set(pos.x, pos.y); t.dots[i].alpha = (1 - i / TRAIL_LEN) * 0.9; }
        else      { t.dots[i].alpha = 0; }
      }
    }

    for (const [id, t] of this.trails) {
      if (!ids.has(id)) {
        // Fade-out trail briefly (impact flash)
        this.projectileLayer.removeChild(t.container);
        this.trails.delete(id);
      }
    }
  }

  // ── PARTICLES ────────────────────────────────────────────────────────────

  private spawnDeathParticles(x: number, y: number, color: number, r: number): void {
    const n = 5 + Math.ceil(r * 0.5);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const spd   = 35 + Math.random() * 70;
      const life  = 0.35 + Math.random() * 0.2;
      const g = new Graphics();
      g.circle(0, 0, 2 + Math.random() * 2.5).fill({ color });
      g.position.set(x, y);
      this.particleLayer.addChild(g);
      this.particles.push({ g, x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 25, life, maxLife: life });
    }
  }

  private tickParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particleLayer.removeChild(p.g); this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt;
      p.g.position.set(p.x, p.y);
      p.g.alpha = p.life / p.maxLife;
    }
  }

  // ── DAMAGE NUMBERS ───────────────────────────────────────────────────────

  private spawnDmgNum(x: number, y: number, value: number): void {
    if (this.dmgNums.length >= 30) return;
    const text = new Text({ text: String(value), style: { fontSize: 12, fontWeight: 'bold', fill: 0xffffff } });
    text.position.set(x - text.width / 2, y);
    this.uiLayer.addChild(text);
    this.dmgNums.push({ text, vy: -55, life: 0.7, maxLife: 0.7 });
  }

  private tickDmgNums(dt: number): void {
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.life -= dt;
      if (d.life <= 0) { this.uiLayer.removeChild(d.text); this.dmgNums.splice(i, 1); continue; }
      d.text.y += d.vy * dt;
      d.vy   *= 0.93;
      d.text.alpha = d.life / d.maxLife;
    }
  }

  destroy(): void {
    this.app?.destroy(true);
    this.app = null;
    this.enemySprites.clear();
    this.towerSprites.clear();
    this.trails.clear();
    this.particles = [];
    this.dmgNums = [];
  }
}
