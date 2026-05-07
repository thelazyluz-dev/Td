import { Application, Graphics, Container, Text } from 'pixi.js';
import type { GameState } from './GameEngine';
import { PATH_WAYPOINTS } from './PathManager';
import { BALANCE } from '../balance';

export const CANVAS_W = 800;
export const CANVAS_H = 500;
export const TILE = BALANCE.TILE_SIZE;

// ── Color tables ────────────────────────────────────────────────────────────

const EC: Record<string, number> = {
  Ant:      0xcc8833,
  Fly:      0x88bb44,
  Roach:    0x664422,
  Mosquito: 0x779944,
  Beetle:   0x3366cc,
  Wasp:     0xffcc00,
  Termite:  0xddcc88,
  FireAnt:  0xff5500,
  QueenAnt: 0xff2200,
};

const TC: Record<string, number> = {
  BugSpray:   0x44aaff,
  Swatter:    0xff7722,
  Zapper:     0xffee00,
  Sprinkler:  0x44cc88,
  MagGlass:   0xffaa00,
  PoisonBomb: 0x88cc00,
  GlueTrap:   0xddaa00,
  BugLight:   0xffff44,
};

function enemyRadius(t: string): number {
  if (t === 'QueenAnt') return 19;
  if (t === 'FireAnt')  return 16;
  if (t === 'Roach' || t === 'Termite') return 13;
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
      case 'Zapper':
        base.poly([-half*0.7,-half, half*0.7,-half, half,-0, half*0.7,half, -half*0.7,half, -half,0]).fill({ color });
        break;
      case 'PoisonBomb':
        base.circle(0, 0, TILE*0.42).fill({ color });
        base.circle(0, 0, TILE*0.28).fill({ color: 0x225500 });
        // skull mark
        base.circle(0, -TILE*0.08, TILE*0.12).fill({ color: 0x000000, alpha: 0.5 });
        break;
      case 'GlueTrap': {
        // Honeycomb/sticky cross
        base.setStrokeStyle({ width: 4, color: 0xddaa00 });
        [-45,-135,45,135].forEach(a => {
          const rad = a * Math.PI/180;
          base.moveTo(0,0).lineTo(Math.cos(rad)*TILE*0.45, Math.sin(rad)*TILE*0.45);
        });
        base.stroke();
        base.circle(0,0,5).fill({ color: 0xffee88 });
        break;
      }
      case 'BugLight':
        base.roundRect(-half*0.55, -half*1.1, half*1.1, half*2.2, 3).fill({ color });
        base.roundRect(-half*0.7, half*0.5, half*1.4, half*0.8, 2).fill({ color: adjustColor(color, 0.8) });
        // light glow
        base.circle(0, -half*0.5, half*0.5).fill({ color: 0xffffaa, alpha: 0.4 });
        break;
      case 'MagGlass':
        base.circle(0, 0, TILE*0.38).fill({ color });
        base.circle(0, 0, TILE*0.25).fill({ color: 0xffffff, alpha: 0.25 });
        base.circle(0, 0, TILE*0.38).fill({ color: adjustColor(color, 0.7), alpha: 0.0 });
        base.setStrokeStyle({ width: 2.5, color: adjustColor(color, 0.6) });
        base.circle(0, 0, TILE*0.38).stroke();
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
    if (type !== 'GlueTrap' && type !== 'BugLight') {
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
      case 'Swatter':
        // Wide flat swatter head
        g.roundRect(-7, -TILE*0.38, 14, TILE*0.34, 2).fill({ color: 0xdd9944 });
        g.poly([-9, -TILE*0.38, 9, -TILE*0.38, 11, -TILE*0.50, -11, -TILE*0.50]).fill({ color: 0xeeaa55 });
        // Grid lines on swatter
        g.setStrokeStyle({ width: 1, color: 0xcc7733, alpha: 0.7 });
        g.moveTo(0, -TILE*0.38).lineTo(0, -TILE*0.50).stroke();
        break;
      case 'Zapper':
        // Long slim electric probe
        g.roundRect(-2, -TILE*0.65, 4, TILE*0.58, 1).fill({ color: 0xdddddd });
        g.circle(0, -TILE*0.65, 4).fill({ color: 0xffee00 });
        break;
      case 'Sprinkler': {
        // Multiple spray nozzles
        [-4, 0, 4].forEach(ox => {
          g.roundRect(ox-1.5, -TILE*0.44, 3, TILE*0.38, 1).fill({ color: 0x88ddbb });
        });
        break;
      }
      case 'MagGlass':
        // Handle stem
        g.poly([-3.5, -TILE*0.02, 3.5, -TILE*0.02, 5, -TILE*0.44, -5, -TILE*0.44]).fill({ color: 0xdd8844 });
        g.circle(0, -TILE*0.44, TILE*0.15).fill({ color: 0xaaddff, alpha: 0.6 });
        break;
      case 'PoisonBomb':
        // Short fat tube
        g.roundRect(-6, -TILE*0.30, 12, TILE*0.26, 3).fill({ color: 0x88cc44 });
        g.circle(0, -TILE*0.30, 6).fill({ color: 0x225500 });
        break;
      default:
        // BugSpray: slim nozzle
        g.roundRect(-3.5, -TILE*0.44, 7, TILE*0.40, 2).fill({ color: 0x88ccff });
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
      case 'Ant': {
        // Three ant segments: head, thorax, abdomen
        g.ellipse(0, r*0.55, r*0.42, r*0.52).fill({ color });        // abdomen
        g.circle(0, 0, r*0.3).fill({ color });                        // thorax
        g.circle(0, -r*0.52, r*0.35).fill({ color });                 // head
        // Antennae
        g.setStrokeStyle({ width: 1.5, color: dark });
        g.moveTo(-r*0.12, -r*0.78).lineTo(-r*0.45, -r*1.15).stroke();
        g.moveTo( r*0.12, -r*0.78).lineTo( r*0.45, -r*1.15).stroke();
        // Tiny end-balls on antennae
        g.circle(-r*0.45, -r*1.15, r*0.09).fill({ color: dark });
        g.circle( r*0.45, -r*1.15, r*0.09).fill({ color: dark });
        // Eyes
        g.circle(-r*0.18, -r*0.58, r*0.11).fill({ color: 0x000000 });
        g.circle( r*0.18, -r*0.58, r*0.11).fill({ color: 0x000000 });
        // Legs (3 pairs from thorax)
        g.setStrokeStyle({ width: 1.2, color: dark });
        [-0.5, 0, 0.5].forEach(yo => {
          g.moveTo(-r*0.3, yo*r*0.35).lineTo(-r*0.8, yo*r*0.35 + r*0.2).stroke();
          g.moveTo( r*0.3, yo*r*0.35).lineTo( r*0.8, yo*r*0.35 + r*0.2).stroke();
        });
        break;
      }
      case 'Fly': {
        // Compact body
        g.ellipse(0, r*0.1, r*0.5, r*0.75).fill({ color });
        g.circle(0, -r*0.55, r*0.38).fill({ color });
        // Large wings
        g.ellipse(-r*0.9, -r*0.2, r*0.65, r*0.28).fill({ color: 0xccddff, alpha: 0.55 });
        g.ellipse( r*0.9, -r*0.2, r*0.65, r*0.28).fill({ color: 0xccddff, alpha: 0.55 });
        // Compound eyes (big red)
        g.circle(-r*0.22, -r*0.6, r*0.18).fill({ color: 0xdd2200 });
        g.circle( r*0.22, -r*0.6, r*0.18).fill({ color: 0xdd2200 });
        g.circle(-r*0.22, -r*0.6, r*0.09).fill({ color: 0xff4422 });
        g.circle( r*0.22, -r*0.6, r*0.09).fill({ color: 0xff4422 });
        break;
      }
      case 'Roach': {
        // Wide armored oval
        g.ellipse(0, 0, r*1.1, r*0.75).fill({ color });
        // Armor segments
        g.setStrokeStyle({ width: 1.5, color: dark, alpha: 0.7 });
        g.moveTo(-r*0.8, -r*0.15).lineTo(r*0.8, -r*0.15).stroke();
        g.moveTo(-r*0.8, r*0.15).lineTo(r*0.8, r*0.15).stroke();
        // Head
        g.ellipse(0, -r*0.65, r*0.45, r*0.28).fill({ color });
        // Antennae
        g.setStrokeStyle({ width: 1, color: dark });
        g.moveTo(-r*0.2, -r*0.8).lineTo(-r*0.7, -r*1.2).stroke();
        g.moveTo( r*0.2, -r*0.8).lineTo( r*0.7, -r*1.2).stroke();
        // Legs
        g.setStrokeStyle({ width: 1.5, color: dark });
        [-0.3, 0, 0.3].forEach(yo => {
          g.moveTo(-r*1.1, yo*r).lineTo(-r*1.5, yo*r + r*0.25).stroke();
          g.moveTo( r*1.1, yo*r).lineTo( r*1.5, yo*r + r*0.25).stroke();
        });
        break;
      }
      case 'Mosquito': {
        // Slim body
        g.ellipse(0, r*0.1, r*0.35, r*0.85).fill({ color });
        g.circle(0, -r*0.65, r*0.28).fill({ color });
        // Long proboscis
        g.roundRect(-r*0.04, -r*0.95, r*0.08, r*0.55, 1).fill({ color: dark });
        // Wings (translucent)
        g.ellipse(-r*0.7, -r*0.15, r*0.55, r*0.22).fill({ color: 0xaaccff, alpha: 0.5 });
        g.ellipse( r*0.7, -r*0.15, r*0.55, r*0.22).fill({ color: 0xaaccff, alpha: 0.5 });
        // Eyes
        g.circle(-r*0.16, -r*0.7, r*0.12).fill({ color: 0x880000 });
        g.circle( r*0.16, -r*0.7, r*0.12).fill({ color: 0x880000 });
        // Legs (thin)
        g.setStrokeStyle({ width: 1, color: dark });
        [-0.2, 0.2].forEach(yo => {
          g.moveTo(-r*0.35, yo*r).lineTo(-r*0.9, yo*r + r*0.3).stroke();
          g.moveTo( r*0.35, yo*r).lineTo( r*0.9, yo*r + r*0.3).stroke();
        });
        break;
      }
      case 'Beetle': {
        // Shield-shaped elytra (wing covers)
        g.ellipse(0, r*0.1, r*0.9, r*0.8).fill({ color });
        // Center seam
        g.setStrokeStyle({ width: 1.5, color: dark, alpha: 0.8 });
        g.moveTo(0, -r*0.65).lineTo(0, r*0.85).stroke();
        // Head
        g.circle(0, -r*0.65, r*0.32).fill({ color });
        // Spots (iridescent)
        g.circle(-r*0.35, 0, r*0.16).fill({ color: adjustColor(color, 1.4), alpha: 0.6 });
        g.circle( r*0.35, 0, r*0.16).fill({ color: adjustColor(color, 1.4), alpha: 0.6 });
        // Legs
        g.setStrokeStyle({ width: 1.5, color: dark });
        [-0.2, 0.2, 0.6].forEach(yo => {
          g.moveTo(-r*0.9, yo*r).lineTo(-r*1.4, yo*r + r*0.2).stroke();
          g.moveTo( r*0.9, yo*r).lineTo( r*1.4, yo*r + r*0.2).stroke();
        });
        break;
      }
      case 'Wasp': {
        // Segmented body — thorax + tapered abdomen
        g.ellipse(0, -r*0.15, r*0.5, r*0.45).fill({ color });
        g.ellipse(0, r*0.58, r*0.32, r*0.52).fill({ color: adjustColor(color, 0.85) });
        // Black stripes on abdomen
        g.setStrokeStyle({ width: 2.5, color: 0x221100, alpha: 0.7 });
        g.moveTo(-r*0.3, r*0.35).lineTo(r*0.3, r*0.35).stroke();
        g.moveTo(-r*0.28, r*0.58).lineTo(r*0.28, r*0.58).stroke();
        // Head
        g.circle(0, -r*0.62, r*0.3).fill({ color });
        // Stinger
        g.poly([r*0.04, r*1.08, -r*0.04, r*1.08, 0, r*1.32]).fill({ color: dark });
        // Wings
        g.ellipse(-r*0.75, -r*0.22, r*0.6, r*0.2).fill({ color: 0xccddff, alpha: 0.5 });
        g.ellipse( r*0.75, -r*0.22, r*0.6, r*0.2).fill({ color: 0xccddff, alpha: 0.5 });
        // Eyes
        g.circle(-r*0.17, -r*0.68, r*0.12).fill({ color: 0x000000 });
        g.circle( r*0.17, -r*0.68, r*0.12).fill({ color: 0x000000 });
        break;
      }
      case 'Termite': {
        // Chunky pale body
        g.ellipse(0, r*0.15, r*0.7, r*0.85).fill({ color });
        g.circle(0, -r*0.6, r*0.42).fill({ color });
        // Mandibles
        g.setStrokeStyle({ width: 2, color: dark });
        g.moveTo(-r*0.3, -r*0.85).lineTo(-r*0.55, -r*1.15).stroke();
        g.moveTo( r*0.3, -r*0.85).lineTo( r*0.55, -r*1.15).stroke();
        // Warning glow (explosion)
        g.circle(0, r*0.15, r*0.55).fill({ color: 0xff6600, alpha: 0.2 });
        // Eyes
        g.circle(-r*0.2, -r*0.62, r*0.13).fill({ color: 0xff8800 });
        g.circle( r*0.2, -r*0.62, r*0.13).fill({ color: 0xff8800 });
        break;
      }
      case 'FireAnt': {
        // Mid-boss: large fire ant with glow
        g.circle(0, r*0.35, r*0.65).fill({ color: 0xdd3300 }); // abdomen
        g.circle(0, -r*0.1, r*0.5).fill({ color });            // thorax
        g.circle(0, -r*0.72, r*0.48).fill({ color });          // head
        // Fire aura
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI*2*i)/6;
          g.circle(Math.cos(a)*r*1.0, r*0.35 + Math.sin(a)*r*0.65, r*0.18).fill({ color: 0xff8800, alpha: 0.5 });
        }
        // Antennae (thicker)
        g.setStrokeStyle({ width: 2, color: 0xaa2200 });
        g.moveTo(-r*0.18, -r*1.05).lineTo(-r*0.55, -r*1.5).stroke();
        g.moveTo( r*0.18, -r*1.05).lineTo( r*0.55, -r*1.5).stroke();
        g.circle(-r*0.55, -r*1.5, r*0.12).fill({ color: 0xff4400 });
        g.circle( r*0.55, -r*1.5, r*0.12).fill({ color: 0xff4400 });
        // Big eyes
        g.circle(-r*0.24, -r*0.78, r*0.16).fill({ color: 0xff0000 });
        g.circle( r*0.24, -r*0.78, r*0.16).fill({ color: 0xff0000 });
        g.circle(-r*0.24, -r*0.78, r*0.08).fill({ color: 0xffffff });
        g.circle( r*0.24, -r*0.78, r*0.08).fill({ color: 0xffffff });
        // Legs (heavy)
        g.setStrokeStyle({ width: 2, color: 0xaa2200 });
        [-0.4, 0, 0.4].forEach(yo => {
          g.moveTo(-r*0.5, yo*r).lineTo(-r*1.1, yo*r + r*0.25).stroke();
          g.moveTo( r*0.5, yo*r).lineTo( r*1.1, yo*r + r*0.25).stroke();
        });
        break;
      }
      case 'QueenAnt': {
        // Final boss: huge queen ant with crown
        g.ellipse(0, r*0.5, r*0.8, r*0.72).fill({ color: 0xcc1100 }); // abdomen
        g.circle(0, -r*0.15, r*0.6).fill({ color });                   // thorax
        g.circle(0, -r*0.88, r*0.56).fill({ color });                  // head
        // Abdomen pattern
        g.setStrokeStyle({ width: 2.5, color: 0x880000, alpha: 0.7 });
        g.moveTo(-r*0.7, r*0.45).lineTo(r*0.7, r*0.45).stroke();
        g.moveTo(-r*0.65, r*0.7).lineTo(r*0.65, r*0.7).stroke();
        // Crown
        const crownY = -r*1.4;
        g.poly([-r*0.4, crownY+r*0.25, r*0.4, crownY+r*0.25, r*0.35, crownY, r*0.15, crownY+r*0.15, 0, crownY-r*0.1, -r*0.15, crownY+r*0.15, -r*0.35, crownY]).fill({ color: 0xffd700 });
        // Crown jewels
        g.circle(0, crownY-r*0.05, r*0.09).fill({ color: 0xff2222 });
        g.circle(-r*0.25, crownY+r*0.1, r*0.07).fill({ color: 0x4444ff });
        g.circle( r*0.25, crownY+r*0.1, r*0.07).fill({ color: 0x44ff44 });
        // Wings (large)
        g.ellipse(-r*1.05, -r*0.2, r*0.75, r*0.3).fill({ color: 0xaabbff, alpha: 0.45 });
        g.ellipse( r*1.05, -r*0.2, r*0.75, r*0.3).fill({ color: 0xaabbff, alpha: 0.45 });
        // Antennae
        g.setStrokeStyle({ width: 2.5, color: 0x880000 });
        g.moveTo(-r*0.22, -r*1.28).lineTo(-r*0.65, -r*1.75).stroke();
        g.moveTo( r*0.22, -r*1.28).lineTo( r*0.65, -r*1.75).stroke();
        g.circle(-r*0.65, -r*1.75, r*0.14).fill({ color: 0xff2222 });
        g.circle( r*0.65, -r*1.75, r*0.14).fill({ color: 0xff2222 });
        // Eyes
        g.circle(-r*0.28, -r*0.96, r*0.18).fill({ color: 0xff0000 });
        g.circle( r*0.28, -r*0.96, r*0.18).fill({ color: 0xff0000 });
        g.circle(-r*0.28, -r*0.96, r*0.09).fill({ color: 0xffaaaa });
        g.circle( r*0.28, -r*0.96, r*0.09).fill({ color: 0xffaaaa });
        // Heavy legs
        g.setStrokeStyle({ width: 2.5, color: 0x880000 });
        [-0.5, 0, 0.5].forEach(yo => {
          g.moveTo(-r*0.6, yo*r).lineTo(-r*1.3, yo*r + r*0.3).stroke();
          g.moveTo( r*0.6, yo*r).lineTo( r*1.3, yo*r + r*0.3).stroke();
        });
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
