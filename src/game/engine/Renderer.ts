import { Application, Graphics, Container, Text } from 'pixi.js';
import type { GameState } from './GameEngine';
import { PATH_WAYPOINTS } from './PathManager';
import { BALANCE } from '../balance';

export const CANVAS_W = 800;
export const CANVAS_H = 500;
export const TILE = BALANCE.TILE_SIZE;

// ── Color tables ────────────────────────────────────────────────────────────

const EC: Record<string, number> = {
  Walker:      0x44ee44,
  Runner:      0x88ff22,
  Tank:        0xaaaa33,
  Spitter:     0x22ddaa,
  Crawler:     0x22aa55,
  Screamer:    0xff9900,
  Bloater:     0xcc44ff,
  Alpha:       0xff7700,
  PatientZero: 0xff2222,
};

const TC: Record<string, number> = {
  Rifleman:    0x44aaff,
  Shotgunner:  0xff7722,
  Sniper:      0x22ffee,
  MachineGun:  0xff3344,
  Flamethrower:0xff9900,
  Mortar:      0x8899cc,
  BarbedWire:  0xeecc22,
  Watchtower:  0x44ee88,
};

function enemyRadius(t: string): number {
  if (t === 'PatientZero') return 19;
  if (t === 'Alpha')       return 16;
  if (t === 'Tank' || t === 'Bloater') return 13;
  return 9;
}

// ── Sprite data ─────────────────────────────────────────────────────────────

const DEATH_DUR  = 0.36;
const FLASH_DUR  = 0.20;
const MUZZLE_DUR = 0.09;
const SPAWN_DUR  = 0.22;
const TRAIL_LEN  = 7;
const RECOIL_DUR = 0.12;

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
  muzzleTimer: number;
  angle: number;
  popTimer: number;
  recoilTimer: number;
  recoilMax: number;
  upgradeLevel: number;
  starsContainer: Container;
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

// ── Renderer ────────────────────────────────────────────────────────────────

export class Renderer {
  private app: Application | null = null;

  // gameContainer holds all game layers and is scaled to fit the viewport
  private gameContainer = new Container();

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

  // Viewport scaling for toGameCoords
  private _gameScale   = 1;
  private _gameOffsetX = 0;
  private _gameOffsetY = 0;

  // Screen shake
  private shakeAmt  = 0;
  private shakeDur  = 0;
  private shakeMax  = 0;

  // Wave banner
  private banner: Text | null = null;
  private bannerTimer = 0;
  private bannerDur   = 0;

  private _onResize = () => this.updateViewport();

  async init(container: HTMLElement): Promise<void> {
    const resolution = Math.min(window.devicePixelRatio || 1, 2);

    this.app = new Application();
    await this.app.init({
      resizeTo: container,
      resolution,
      autoDensity: true,
      backgroundColor: 0x1a4a0a,
      antialias: true,
    });

    container.appendChild(this.app.canvas);
    (this.app.canvas as HTMLCanvasElement).style.display = 'block';

    this.app.stage.addChild(this.gameContainer);
    this.gameContainer.addChild(
      this.pathLayer, this.towerLayer, this.enemyLayer,
      this.projectileLayer, this.particleLayer, this.uiLayer,
    );

    this.drawPath();

    // Use PixiJS renderer resize event (fires when resizeTo detects size change)
    this.app.renderer.on('resize', this._onResize);
    this.updateViewport();
  }

  private updateViewport(): void {
    if (!this.app) return;
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    if (vw <= 0 || vh <= 0) return;

    const scaleByW = vw / CANVAS_W;
    const scaleByH = vh / CANVAS_H;
    // If letterboxing by height would leave less than 72% of width used,
    // switch to fill-width mode and center vertically on the path.
    const fillRatio = (CANVAS_W * scaleByH) / vw;
    let scale: number, offsetX: number, offsetY: number;
    if (fillRatio >= 0.72) {
      scale   = Math.min(scaleByW, scaleByH);
      offsetX = (vw - CANVAS_W * scale) / 2;
      offsetY = (vh - CANVAS_H * scale) / 2;
    } else {
      // Wide landscape phone: fill width, crop top/bottom grass
      const pathMinY = Math.min(...PATH_WAYPOINTS.map(w => w.y));
      const pathMaxY = Math.max(...PATH_WAYPOINTS.map(w => w.y));
      const pathCenterY = (pathMinY + pathMaxY) / 2;
      scale   = scaleByW;
      offsetX = 0;
      // Center on path midpoint; clamp so path endpoints stay on screen
      const idealOffY = vh / 2 - pathCenterY * scale;
      const minOffY   = vh - CANVAS_H * scale; // bottom edge in view
      const maxOffY   = 0;                      // top edge in view
      offsetY = Math.max(minOffY, Math.min(maxOffY, idealOffY));
    }

    this._gameScale   = scale;
    this._gameOffsetX = offsetX;
    this._gameOffsetY = offsetY;
    this.gameContainer.scale.set(scale);
    this.gameContainer.position.set(offsetX, offsetY);
  }

  /** Convert screen/client coordinates to game-space coordinates (800x500 units) */
  toGameCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (!this.app) return { x: 0, y: 0 };
    const canvas = this.app.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // Map from client space to CSS canvas space, then to game space
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const x = (cssX - this._gameOffsetX) / this._gameScale;
    const y = (cssY - this._gameOffsetY) / this._gameScale;
    return { x, y };
  }

  // ── Static path + background ──────────────────────────────────────────────

  private drawPath(): void {
    const g = new Graphics();

    // Bright green grass background
    g.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: 0x2e6b12 });

    // Grass texture patches (lighter/darker circles)
    const rng = mulberry32(42);
    for (let i = 0; i < 120; i++) {
      const px = rng() * CANVAS_W;
      const py = rng() * CANVAS_H;
      const r2 = 8 + rng() * 28;
      const lighter = rng() > 0.5;
      const col = lighter ? 0x3d8a18 : 0x235510;
      g.circle(px, py, r2).fill({ color: col, alpha: 0.45 });
    }

    // Decorative trees/bushes (dark green circles) away from path
    const treeRng = mulberry32(99);
    const treePositions = [
      { x: 60,  y: 40  }, { x: 200, y: 40  }, { x: 380, y: 40  },
      { x: 550, y: 40  }, { x: 720, y: 40  }, { x: 60,  y: 460 },
      { x: 200, y: 460 }, { x: 380, y: 460 }, { x: 550, y: 460 },
      { x: 720, y: 460 }, { x: 740, y: 300 }, { x: 60,  y: 300 },
      { x: 400, y: 200 }, { x: 260, y: 400 }, { x: 560, y: 240 },
      { x: 100, y: 380 }, { x: 440, y: 440 }, { x: 680, y: 440 },
    ];
    for (const pos of treePositions) {
      const sz = 10 + treeRng() * 10;
      // Dark green bush/tree
      g.circle(pos.x, pos.y, sz).fill({ color: 0x1a4d08 });
      g.circle(pos.x - sz*0.3, pos.y - sz*0.2, sz*0.65).fill({ color: 0x236610 });
      g.circle(pos.x + sz*0.25, pos.y - sz*0.15, sz*0.55).fill({ color: 0x1e5c0e });
      // Highlight
      g.circle(pos.x - sz*0.15, pos.y - sz*0.35, sz*0.3).fill({ color: 0x3a8020, alpha: 0.5 });
    }

    // Path layers: dark edge → main sand → lighter center stripe
    const pts = PATH_WAYPOINTS;
    const stroke = (w: number, color: number, alpha = 1) => {
      g.setStrokeStyle({ width: w, color, alpha });
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };
    stroke(TILE * 1.1,  0x8a5c1a);          // dark earthy edge
    stroke(TILE * 0.90, 0xc49030);           // main sandy path
    stroke(TILE * 0.55, 0xd4a840);           // slightly lighter
    stroke(6,           0xe0b050, 0.7);      // center highlight stripe

    // Gravel dots on path
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y, bx = pts[i+1].x, by = pts[i+1].y;
      const steps = Math.ceil(Math.hypot(bx-ax, by-ay) / 8);
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const cx = ax + (bx-ax)*t2 + (Math.random()-0.5)*TILE*0.45;
        const cy = ay + (by-ay)*t2 + (Math.random()-0.5)*TILE*0.45;
        const r  = 0.8 + Math.random() * 1.2;
        const luma = 0x90 + Math.floor(Math.random()*0x20);
        const col2 = (luma<<16) | (Math.floor(luma*0.82)<<8) | Math.floor(luma*0.55);
        g.circle(cx, cy, r).fill({ color: col2 });
      }
    }

    // Start marker
    const s = pts[0];
    g.circle(s.x, s.y, 10).fill({ color: 0x22c55e });
    g.setStrokeStyle({ width: 2, color: 0x166534 }); g.circle(s.x, s.y, 10).stroke();
    g.rect(s.x - 1.5, s.y - 14, 3, 14).fill({ color: 0x166534 });
    g.poly([s.x+1.5, s.y-14, s.x+9, s.y-10, s.x+1.5, s.y-7]).fill({ color: 0x22c55e });

    // End marker
    const e = pts[pts.length - 1];
    g.circle(e.x, e.y, 10).fill({ color: 0xdc2626 });
    g.setStrokeStyle({ width: 2, color: 0x7f1d1d }); g.circle(e.x, e.y, 10).stroke();
    g.setStrokeStyle({ width: 2.5, color: 0x7f1d1d });
    g.moveTo(e.x-5, e.y-5).lineTo(e.x+5, e.y+5).stroke();
    g.moveTo(e.x+5, e.y-5).lineTo(e.x-5, e.y+5).stroke();

    this.pathLayer.addChild(g);
  }

  // ── Public update (called from GameCanvas RAF loop) ────────────────────

  update(state: GameState, dt: number): void {
    if (!this.app) return;
    this.tickShake(dt);
    this.syncTowers(state, dt);
    this.syncEnemies(state, dt);
    this.syncProjectiles(state);
    this.tickParticles(dt);
    this.tickDmgNums(dt);
    this.tickBanner(dt);
  }

  // ── Screen shake ────────────────────────────────────────────────────────

  shake(intensity: number, duration: number): void {
    this.shakeAmt = intensity;
    this.shakeDur = duration;
    this.shakeMax = duration;
  }

  private tickShake(dt: number): void {
    if (!this.app) return;
    if (this.shakeDur > 0) {
      this.shakeDur -= dt;
      const pct = this.shakeDur / this.shakeMax;
      const amt = this.shakeAmt * pct;
      this.gameContainer.x = this._gameOffsetX + (Math.random() - 0.5) * amt * 2;
      this.gameContainer.y = this._gameOffsetY + (Math.random() - 0.5) * amt * 2;
    } else {
      this.gameContainer.x = this._gameOffsetX;
      this.gameContainer.y = this._gameOffsetY;
    }
  }

  // ── Wave banner ─────────────────────────────────────────────────────────

  showWaveBanner(waveNum: number): void {
    if (this.banner) { this.uiLayer.removeChild(this.banner); this.banner = null; }
    const isFinal = waveNum === 10;
    const isBoss  = waveNum === 5;
    const label   = isFinal ? '⚠ FINAL WAVE ⚠' : isBoss ? '— BOSS —' : `WAVE ${waveNum}`;
    const color   = isFinal ? 0xff2020 : isBoss ? 0xff6600 : 0xffffff;
    const t = new Text({ text: label, style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 44,
      fontWeight: '900',
      fill: color,
      dropShadow: { alpha: 0.9, angle: Math.PI/2, blur: 6, color: 0x000000, distance: 3 },
    }});
    t.anchor.set(0.5);
    t.position.set(CANVAS_W / 2, CANVAS_H / 2 - 20);
    t.alpha = 0;
    this.uiLayer.addChild(t);
    this.banner = t;
    this.bannerDur = 2.4;
    this.bannerTimer = this.bannerDur;
  }

  private tickBanner(dt: number): void {
    if (!this.banner) return;
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) { this.uiLayer.removeChild(this.banner); this.banner = null; return; }
    const remaining = this.bannerTimer / this.bannerDur;
    const fadeIn  = (this.bannerDur - this.bannerTimer) / 0.25;
    const fadeOut = this.bannerTimer / 0.5;
    this.banner.alpha = Math.min(1, fadeIn, fadeOut);
    const s = 0.6 + 0.4 * Math.min(1, fadeIn);
    this.banner.scale.set(s);
    void remaining;
  }

  // ── TOWERS ──────────────────────────────────────────────────────────────

  private syncTowers(state: GameState, dt: number): void {
    const ids = new Set(state.towers.map(t => t.id));

    for (const tower of state.towers) {
      let sp = this.towerSprites.get(tower.id);
      if (!sp) {
        sp = this.makeTower(tower.type, tower.effectiveRange);
        sp.container.position.set(tower.pos.x, tower.pos.y);
        sp.container.scale.set(0);
        this.towerLayer.addChild(sp.container);
        this.towerSprites.set(tower.id, sp);
      }

      // Pop-in
      if (sp.popTimer > 0) {
        sp.popTimer -= dt;
        const t2 = 1 - sp.popTimer / SPAWN_DUR;
        const s2 = t2 < 0.6 ? (t2/0.6)*1.25 : 1.25 - ((t2-0.6)/0.4)*0.25;
        sp.container.scale.set(Math.max(0, s2));
      }

      // Barrel rotation
      let targetAngle = sp.angle;
      let best = Infinity;
      for (const en of state.enemies) {
        if (en.isDead || en.reachedEnd) continue;
        const dx = en.pos.x - tower.pos.x, dy = en.pos.y - tower.pos.y;
        const d  = Math.hypot(dx, dy);
        if (d <= tower.effectiveRange && d < best) { best = d; targetAngle = Math.atan2(dy, dx) + Math.PI/2; }
      }
      let diff = targetAngle - sp.angle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      sp.angle += diff * Math.min(1, dt * 14);
      sp.barrel.rotation = sp.angle;

      // Barrel recoil
      if (sp.recoilTimer > 0) {
        sp.recoilTimer -= dt;
        const t2 = sp.recoilTimer / sp.recoilMax;
        const offset = t2 > 0.5 ? (1-t2)/0.5 * 4 : (t2/0.5) * 4;
        sp.barrel.position.y = offset;
      } else {
        sp.barrel.position.y = 0;
      }

      // Muzzle decay
      if (sp.muzzleTimer > 0) {
        sp.muzzleTimer -= dt;
        sp.muzzle.alpha = Math.max(0, sp.muzzleTimer / MUZZLE_DUR);
      }

      // Upgrade stars
      if (tower.upgrades !== sp.upgradeLevel) {
        sp.upgradeLevel = tower.upgrades;
        this.updateStars(sp, tower.upgrades);
      }
    }

    for (const [id, sp] of this.towerSprites) {
      if (!ids.has(id)) { this.towerLayer.removeChild(sp.container); this.towerSprites.delete(id); }
    }
  }

  private updateStars(sp: TowerSprite, level: number): void {
    sp.starsContainer.removeChildren();
    if (level <= 0) return;
    const starSize = 9;
    const gap = 10;
    const totalW = level * gap;
    for (let i = 0; i < level; i++) {
      const star = new Text({ text: '★', style: {
        fontFamily: 'Arial',
        fontSize: starSize,
        fontWeight: '900',
        fill: 0xffd700,
      }});
      star.anchor.set(0.5, 0);
      star.position.set(-totalW/2 + gap/2 + i * gap, TILE * 0.5);
      sp.starsContainer.addChild(star);
    }
  }

  private makeTower(type: string, range: number): TowerSprite {
    const color = TC[type] ?? 0xaaaaaa;
    const cont  = new Container();

    // Range ring
    const ring = new Graphics();
    ring.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.08 });
    ring.circle(0, 0, range).stroke();
    cont.addChild(ring);

    // Base shape (varies by type)
    const base = new Graphics();
    const half = TILE * 0.38;
    switch (type) {
      case 'Sniper':
        base.poly([-half*0.7,-half, half*0.7,-half, half,-0, half*0.7,half, -half*0.7,half, -half,0]).fill({ color });
        break;
      case 'Mortar':
        base.circle(0, 0, TILE*0.42).fill({ color });
        base.circle(0, 0, TILE*0.28).fill({ color: 0x555577 });
        break;
      case 'BarbedWire': {
        base.setStrokeStyle({ width: 4, color: 0xeecc22 });
        [-45,-135,45,135].forEach(a => {
          const rad = a * Math.PI/180;
          base.moveTo(0,0).lineTo(Math.cos(rad)*TILE*0.45, Math.sin(rad)*TILE*0.45);
        });
        base.stroke();
        base.circle(0,0,4).fill({ color: 0xffff88 });
        break;
      }
      case 'Watchtower':
        base.roundRect(-half*0.55, -half*1.1, half*1.1, half*2.2, 3).fill({ color });
        base.roundRect(-half*0.7, half*0.5, half*1.4, half*0.8, 2).fill({ color: adjustColor(color, 0.8) });
        break;
      case 'Flamethrower':
        base.circle(0, 0, TILE*0.38).fill({ color });
        base.circle(0, 0, TILE*0.23).fill({ color: adjustColor(color, 0.7) });
        break;
      default:
        base.roundRect(-half, -half, half*2, half*2, 5).fill({ color });
    }
    // Thick outline for cartoon look
    base.setStrokeStyle({ width: 2.5, color: 0x000000, alpha: 0.6 });
    base.circle(0, 0, half * 1.1).stroke();
    // Highlight
    base.setStrokeStyle({ width: 1.5, color: 0xffffff, alpha: 0.18 });
    base.circle(-half*0.3, -half*0.3, half*0.5).stroke();
    cont.addChild(base);

    // Barrel container (rotates)
    const barrel = new Container();
    if (type !== 'BarbedWire' && type !== 'Watchtower') {
      const bG = new Graphics();
      this.drawBarrel(bG, type);
      barrel.addChild(bG);
    }

    // Muzzle flash
    const muzzle = new Graphics();
    muzzle.circle(0, -TILE * 0.45, 9).fill({ color: 0xffee88 });
    muzzle.circle(0, -TILE * 0.45, 5).fill({ color: 0xffffff });
    muzzle.alpha = 0;
    barrel.addChild(muzzle);
    cont.addChild(barrel);

    // Stars container (shown below tower)
    const starsContainer = new Container();
    cont.addChild(starsContainer);

    return {
      container: cont, barrel, muzzle,
      muzzleTimer: 0, angle: -Math.PI/2,
      popTimer: SPAWN_DUR, recoilTimer: 0, recoilMax: RECOIL_DUR,
      upgradeLevel: 0, starsContainer,
    };
  }

  private drawBarrel(g: Graphics, type: string): void {
    switch (type) {
      case 'Shotgunner':
        g.roundRect(-5, -TILE*0.38, 10, TILE*0.34, 2).fill({ color: 0xdddddd });
        g.poly([-8, -TILE*0.38, 8, -TILE*0.38, 11, -TILE*0.47, -11, -TILE*0.47]).fill({ color: 0xcccccc });
        break;
      case 'Sniper':
        g.roundRect(-2, -TILE*0.62, 4, TILE*0.56, 1).fill({ color: 0xdddddd });
        g.circle(0, -TILE*0.62, 3).fill({ color: 0x555555 });
        break;
      case 'MachineGun': {
        [-3.5, 0, 3.5].forEach(ox => {
          g.roundRect(ox-1.5, -TILE*0.44, 3, TILE*0.38, 1).fill({ color: 0xcccccc });
        });
        break;
      }
      case 'Flamethrower':
        g.poly([-4, -TILE*0.02, 4, -TILE*0.02, 7, -TILE*0.44, -7, -TILE*0.44]).fill({ color: 0xdd8844 });
        g.roundRect(-3, -TILE*0.44, 6, TILE*0.12, 2).fill({ color: 0xffaa44 });
        break;
      case 'Mortar':
        g.roundRect(-6, -TILE*0.30, 12, TILE*0.26, 3).fill({ color: 0xbbbbbb });
        g.circle(0, -TILE*0.30, 6).fill({ color: 0x444444 });
        break;
      default:
        g.roundRect(-3.5, -TILE*0.44, 7, TILE*0.40, 2).fill({ color: 0xdddddd });
    }
  }

  triggerMuzzle(towerId: number): void {
    const sp = this.towerSprites.get(towerId);
    if (sp) {
      sp.muzzleTimer = MUZZLE_DUR;
      sp.muzzle.alpha = 1;
      sp.recoilTimer = RECOIL_DUR;
      sp.recoilMax   = RECOIL_DUR;
    }
  }

  // ── ENEMIES ─────────────────────────────────────────────────────────────

  private syncEnemies(state: GameState, dt: number): void {
    const seen = new Set<number>();

    for (const en of state.enemies) {
      if (en.reachedEnd) continue;
      seen.add(en.id);

      let sp = this.enemySprites.get(en.id);
      if (!sp) {
        sp = this.makeEnemy(en.type);
        sp.prevHp = en.hp;
        sp.bobTimer = Math.random() * Math.PI * 2;
        this.enemyLayer.addChild(sp.container);
        this.enemySprites.set(en.id, sp);
      }

      if (en.isDead && !sp.isDying) {
        sp.isDying = true;
        sp.deathTimer = DEATH_DUR;
        this.burstParticles(en.pos.x, en.pos.y, EC[en.type] ?? 0x55aa55, enemyRadius(en.type));
      }
      if (sp.isDying) {
        sp.deathTimer -= dt;
        const t2 = Math.max(0, 1 - sp.deathTimer / DEATH_DUR);
        sp.container.alpha = 1 - t2;
        sp.container.scale.set(1 - t2 * 0.7);
        if (sp.deathTimer <= 0) { this.enemyLayer.removeChild(sp.container); this.enemySprites.delete(en.id); }
        continue;
      }

      // Damage flash
      if (en.hp < sp.prevHp) {
        sp.flashTimer = FLASH_DUR;
        this.spawnDmgNum(en.pos.x, en.pos.y - enemyRadius(en.type) - 8, Math.round(sp.prevHp - en.hp));
      }
      sp.prevHp = en.hp;
      if (sp.flashTimer > 0) {
        sp.flashTimer -= dt;
        sp.body.tint = sp.flashTimer > FLASH_DUR * 0.5 ? 0xffffff : 0xff2222;
      } else { sp.body.tint = 0xffffff; }

      // Bob
      sp.bobTimer += dt;
      const bob = Math.sin(sp.bobTimer * Math.PI * 3.5) * 1.8;
      sp.container.position.set(en.pos.x, en.pos.y + bob);

      // HP bar
      const r2 = enemyRadius(en.type);
      const bW = r2 * 2.8;
      const ratio = Math.max(0, en.hp / en.maxHp);
      const hpC = ratio > 0.6 ? 0x22ee66 : ratio > 0.3 ? 0xffcc00 : 0xff3333;
      sp.hpFg.clear().roundRect(-bW/2, -r2-10, bW*ratio, 5, 2.5).fill({ color: hpC });
    }

    for (const [id, sp] of this.enemySprites) {
      if (!seen.has(id) && !sp.isDying) { this.enemyLayer.removeChild(sp.container); this.enemySprites.delete(id); }
    }
  }

  private makeEnemy(type: string): EnemySprite {
    const color = EC[type] ?? 0x888888;
    const r     = enemyRadius(type);
    const cont  = new Container();

    // Drop shadow
    const shadow = new Graphics();
    shadow.ellipse(1, r*0.85, r*0.85, r*0.28).fill({ color: 0x000000, alpha: 0.35 });
    cont.addChild(shadow);

    const body = new Graphics();
    this.drawEnemyBody(body, type, r, color);
    cont.addChild(body);

    // HP bar (larger, more visible)
    const bW = r * 2.8;
    const hpBg = new Graphics();
    hpBg.roundRect(-bW/2, -r-10, bW, 5, 2.5).fill({ color: 0x111111 });
    cont.addChild(hpBg);
    const hpFg = new Graphics();
    hpFg.roundRect(-bW/2, -r-10, bW, 5, 2.5).fill({ color: 0x22ee66 });
    cont.addChild(hpFg);

    return { container: cont, body, hpFg, prevHp: 0, flashTimer: 0, bobTimer: 0, isDying: false, deathTimer: 0 };
  }

  private drawEnemyBody(g: Graphics, type: string, r: number, color: number): void {
    const dark = adjustColor(color, 0.55);

    switch (type) {
      case 'Walker': {
        g.roundRect(-r*0.48, -r*0.1, r*0.96, r*1.0, 2).fill({ color });
        g.circle(0, -r*0.45, r*0.52).fill({ color });
        // eyes
        g.circle(-r*0.2, -r*0.5, r*0.13).fill({ color: 0xffffff });
        g.circle( r*0.2, -r*0.5, r*0.13).fill({ color: 0xffffff });
        g.circle(-r*0.2, -r*0.5, r*0.07).fill({ color: 0xff0000 });
        g.circle( r*0.2, -r*0.5, r*0.07).fill({ color: 0xff0000 });
        break;
      }
      case 'Runner': {
        g.ellipse(0, 0, r*0.65, r).fill({ color });
        g.circle(0, -r*0.62, r*0.38).fill({ color });
        g.ellipse(-r*0.7, 0, r*0.18, r*0.5).fill({ color: dark });
        break;
      }
      case 'Tank': {
        g.roundRect(-r, -r*0.7, r*2, r*1.4, 4).fill({ color });
        g.circle(0, -r*0.55, r*0.35).fill({ color: dark });
        g.setStrokeStyle({ width: 2.5, color: dark, alpha: 0.8 });
        g.moveTo(-r*0.8, 0).lineTo(r*0.8, 0).stroke();
        g.moveTo(-r*0.8, r*0.4).lineTo(r*0.8, r*0.4).stroke();
        break;
      }
      case 'Spitter': {
        g.circle(0, 0, r).fill({ color });
        g.circle(0, r*0.35, r*0.3).fill({ color: 0x44ff00 });
        g.ellipse(0, r*0.78, r*0.1, r*0.25).fill({ color: 0x44ff00 });
        g.circle(-r*0.3, -r*0.25, r*0.14).fill({ color: 0x000000 });
        g.circle( r*0.3, -r*0.25, r*0.14).fill({ color: 0x000000 });
        break;
      }
      case 'Crawler': {
        g.ellipse(0, 0, r*1.3, r*0.65).fill({ color });
        for (let i = 0; i < 3; i++) {
          const xOff = (i-1) * r * 0.7;
          g.roundRect(xOff-1.5, r*0.5, 3, r*0.5, 1).fill({ color: dark });
          g.roundRect(xOff-1.5, -r,    3, r*0.5, 1).fill({ color: dark });
        }
        break;
      }
      case 'Screamer': {
        g.circle(0, 0, r).fill({ color });
        g.ellipse(0, r*0.22, r*0.48, r*0.38).fill({ color: 0x111111 });
        g.setStrokeStyle({ width: 2, color: 0xffdd44, alpha: 0.7 });
        [-30,-15,0,15,30].forEach(deg => {
          const rad = deg * Math.PI/180;
          g.moveTo(Math.cos(rad)*r*1.1, Math.sin(rad)*r*1.1)
           .lineTo(Math.cos(rad)*r*1.6, Math.sin(rad)*r*1.6);
        });
        g.stroke();
        g.circle(-r*0.3, -r*0.3, r*0.12).fill({ color: 0xffffff });
        g.circle( r*0.3, -r*0.3, r*0.12).fill({ color: 0xffffff });
        break;
      }
      case 'Bloater': {
        g.circle(0, 0, r).fill({ color });
        for (let i = 0; i < 7; i++) {
          const a = (Math.PI*2*i)/7;
          g.circle(Math.cos(a)*r*0.72, Math.sin(a)*r*0.72, r*0.22).fill({ color: adjustColor(color, 1.3) });
        }
        g.circle(0, 0, r*0.25).fill({ color: 0x9933ff, alpha: 0.7 });
        break;
      }
      case 'Alpha': {
        g.poly([0,-r, r*0.6,-r*0.35, r*0.35,0, r*0.6,r*0.35, 0,r, -r*0.6,r*0.35, -r*0.35,0, -r*0.6,-r*0.35]).fill({ color });
        g.circle(0, 0, r*0.32).fill({ color: 0xff9900 });
        g.circle(0, 0, r*0.15).fill({ color: 0xffdd44 });
        break;
      }
      case 'PatientZero': {
        g.circle(0, 0, r).fill({ color });
        g.setStrokeStyle({ width: 2.5, color: 0xaa0000, alpha: 0.8 });
        g.moveTo(-r*0.6, -r*0.5).lineTo(-r*0.2, 0).lineTo(-r*0.5, r*0.5).stroke();
        g.moveTo( r*0.6, -r*0.5).lineTo( r*0.2, 0).lineTo( r*0.5, r*0.5).stroke();
        g.rect(-r*0.12, -r*0.6, r*0.24, r*1.2).fill({ color: 0xff2222, alpha: 0.95 });
        g.rect(-r*0.6, -r*0.12, r*1.2, r*0.24).fill({ color: 0xff2222, alpha: 0.95 });
        g.circle(0, 0, r*0.22).fill({ color: 0xff4444 });
        break;
      }
      default:
        g.circle(0, 0, r).fill({ color });
    }

    // Common shine
    g.circle(-r*0.3, -r*0.3, r*0.2).fill({ color: 0xffffff, alpha: 0.18 });
    // Thicker cartoon outline (2px)
    g.setStrokeStyle({ width: 2, color: 0x000000, alpha: 0.5 });
    g.circle(0, 0, r).stroke();
  }

  // ── PROJECTILES ──────────────────────────────────────────────────────────

  private syncProjectiles(state: GameState): void {
    const ids = new Set(state.projectiles.map(p => p.id));

    for (const proj of state.projectiles) {
      if (!this.trails.has(proj.id)) {
        this.triggerMuzzle(proj.towerId);
        const cont  = new Container();
        const dots: Graphics[] = [];
        for (let i = 0; i < TRAIL_LEN; i++) {
          const g = new Graphics();
          const ri = Math.max(1, 3.5 - i * 0.45);
          g.circle(0, 0, ri).fill({ color: i === 0 ? 0xffffff : i === 1 ? 0xffffaa : 0xffdd44 });
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
        if (pos) { t.dots[i].position.set(pos.x, pos.y); t.dots[i].alpha = (1 - i/TRAIL_LEN) * 0.92; }
        else      { t.dots[i].alpha = 0; }
      }
    }

    for (const [id, t] of this.trails) {
      if (!ids.has(id)) { this.projectileLayer.removeChild(t.container); this.trails.delete(id); }
    }
  }

  // ── PARTICLES ────────────────────────────────────────────────────────────

  private burstParticles(x: number, y: number, color: number, r: number): void {
    const n = 5 + Math.ceil(r * 0.6);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI*2*i)/n + Math.random()*0.7;
      const spd   = 40 + Math.random()*75;
      const life  = 0.35 + Math.random()*0.2;
      const g     = new Graphics();
      g.circle(0, 0, 1.5 + Math.random()*2.5).fill({ color: i%3===0 ? 0xffffff : color });
      g.position.set(x, y);
      this.particleLayer.addChild(g);
      this.particles.push({ g, x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 30, life, maxLife: life });
    }
  }

  private tickParticles(dt: number): void {
    for (let i = this.particles.length-1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particleLayer.removeChild(p.g); this.particles.splice(i, 1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 95*dt;
      p.g.position.set(p.x, p.y);
      p.g.alpha = p.life / p.maxLife;
    }
  }

  // ── DAMAGE NUMBERS ───────────────────────────────────────────────────────

  private spawnDmgNum(x: number, y: number, value: number): void {
    if (this.dmgNums.length >= 30) return;
    const big = value >= 20;
    const t = new Text({ text: String(value), style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: big ? 15 : 12,
      fontWeight: '900',
      fill: big ? 0xff6644 : 0xffffff,
    }});
    t.anchor.set(0.5, 1);
    t.position.set(x, y);
    this.uiLayer.addChild(t);
    this.dmgNums.push({ text: t, vy: -65, life: 0.75, maxLife: 0.75 });
  }

  private tickDmgNums(dt: number): void {
    for (let i = this.dmgNums.length-1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.life -= dt;
      if (d.life <= 0) { this.uiLayer.removeChild(d.text); this.dmgNums.splice(i, 1); continue; }
      d.text.y += d.vy*dt;
      d.vy *= 0.92;
      d.text.alpha = d.life / d.maxLife;
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.app?.renderer.off('resize', this._onResize);
    this.app?.destroy(true);
    this.app = null;
    this.enemySprites.clear();
    this.towerSprites.clear();
    this.trails.clear();
    this.particles = [];
    this.dmgNums = [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function adjustColor(hex: number, factor: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((hex >>  8) & 0xff) * factor));
  const b = Math.min(255, Math.round( (hex        & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/** Simple seeded RNG (mulberry32) for deterministic decorations */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
