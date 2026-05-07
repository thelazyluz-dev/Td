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
  private bannerSub: Text | null = null;
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
    const rng = mulberry32(42);

    // ── Garden floor: light stone tiles ─────────────────────────────────────
    const TILE_SZ = 80;
    for (let ty = 0; ty < CANVAS_H; ty += TILE_SZ) {
      for (let tx = 0; tx < CANVAS_W; tx += TILE_SZ) {
        const checker = ((tx / TILE_SZ) + (ty / TILE_SZ)) % 2 === 0;
        const base = checker ? 0x4a8a20 : 0x3e7a18;
        g.rect(tx, ty, TILE_SZ, TILE_SZ).fill({ color: base });
        // Subtle noise
        g.rect(tx+4, ty+4, TILE_SZ-8, TILE_SZ-8).fill({ color: checker ? 0x52982a : 0x458520, alpha: 0.3 });
        // Grout lines
        g.setStrokeStyle({ width: 1, color: 0x2a5510, alpha: 0.35 });
        g.rect(tx, ty, TILE_SZ, TILE_SZ).stroke();
      }
    }

    // ── Grass tufts ──────────────────────────────────────────────────────────
    for (let i = 0; i < 80; i++) {
      const px = rng() * CANVAS_W;
      const py = rng() * CANVAS_H;
      const sz = 6 + rng() * 18;
      g.circle(px, py, sz).fill({ color: rng() > 0.5 ? 0x3a8e14 : 0x266010, alpha: 0.55 });
    }

    // ── Decorative garden plants ─────────────────────────────────────────────
    const plantRng = mulberry32(99);
    const plants = [
      {x:55, y:38}, {x:195, y:38}, {x:375, y:38}, {x:548, y:38}, {x:718, y:38},
      {x:55, y:462},{x:195, y:462},{x:375, y:462},{x:548, y:462},{x:718, y:462},
      {x:742, y:300},{x:58, y:300},{x:402, y:200},{x:258, y:400},
    ];
    for (const pos of plants) {
      const sz = 12 + plantRng() * 8;
      // Pot
      g.roundRect(pos.x - sz*0.45, pos.y + sz*0.4, sz*0.9, sz*0.6, 2).fill({ color: 0xcc6633 });
      // Main foliage
      g.circle(pos.x, pos.y, sz).fill({ color: 0x1a5508 });
      g.circle(pos.x - sz*0.4, pos.y - sz*0.2, sz*0.7).fill({ color: 0x246e10 });
      g.circle(pos.x + sz*0.35, pos.y - sz*0.15, sz*0.6).fill({ color: 0x1f6008 });
      g.circle(pos.x, pos.y - sz*0.5, sz*0.55).fill({ color: 0x2a7a12 });
      // Highlights
      g.circle(pos.x - sz*0.2, pos.y - sz*0.55, sz*0.25).fill({ color: 0x44aa22, alpha: 0.55 });
      // Flowers
      const fc = [0xff6688, 0xffcc44, 0xff88aa, 0x88ddff][Math.floor(plantRng()*4)];
      g.circle(pos.x + sz*0.2, pos.y - sz*0.15, sz*0.18).fill({ color: fc });
      g.circle(pos.x - sz*0.25, pos.y + sz*0.05, sz*0.15).fill({ color: fc });
    }

    // ── Ant trail path ───────────────────────────────────────────────────────
    const pts = PATH_WAYPOINTS;
    const pathStroke = (w: number, color: number, alpha = 1) => {
      g.setStrokeStyle({ width: w, color, alpha, cap: 'round', join: 'round' });
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };

    // Multi-layer path: shadow → earthy edge → main → worn center
    pathStroke(TILE * 1.25, 0x3a2208, 0.55);  // deep shadow
    pathStroke(TILE * 1.08, 0x7a4812);          // dark earthy border
    pathStroke(TILE * 0.92, 0xb8840a);          // warm sand
    pathStroke(TILE * 0.72, 0xd4a022);          // lighter mid
    pathStroke(TILE * 0.42, 0xe8c040);          // worn center stripe
    pathStroke(4,            0xf0d060, 0.45);   // highlight shimmer

    // Packed earth texture dots
    const earthRng = mulberry32(7);
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y, bx = pts[i+1].x, by = pts[i+1].y;
      const steps = Math.ceil(Math.hypot(bx-ax, by-ay) / 6);
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const cx = ax + (bx-ax)*t2 + (earthRng()-0.5)*TILE*0.5;
        const cy = ay + (by-ay)*t2 + (earthRng()-0.5)*TILE*0.5;
        const r2 = 0.7 + earthRng() * 1.4;
        const luma = 0x88 + Math.floor(earthRng()*0x30);
        const col2 = (Math.floor(luma*0.9)<<16) | (Math.floor(luma*0.72)<<8) | Math.floor(luma*0.38);
        g.circle(cx, cy, r2).fill({ color: col2 });
      }
    }

    // Pheromone trail dots (subtle)
    const pheroRng = mulberry32(13);
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y, bx = pts[i+1].x, by = pts[i+1].y;
      const steps = Math.ceil(Math.hypot(bx-ax, by-ay) / 18);
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const cx = ax + (bx-ax)*t2 + (pheroRng()-0.5)*8;
        const cy = ay + (by-ay)*t2 + (pheroRng()-0.5)*8;
        g.circle(cx, cy, 1.2).fill({ color: 0xffcc44, alpha: 0.25 });
      }
    }

    // ── Ant hill (start) ─────────────────────────────────────────────────────
    const sp = pts[0];
    // Shadow
    g.ellipse(sp.x + 2, sp.y + 4, 20, 8).fill({ color: 0x000000, alpha: 0.25 });
    // Mound layers
    g.circle(sp.x, sp.y, 20).fill({ color: 0x6b3a10 });
    g.circle(sp.x, sp.y - 3, 16).fill({ color: 0x8a4e18 });
    g.circle(sp.x - 7, sp.y + 2, 10).fill({ color: 0x7a4414 });
    g.circle(sp.x + 6, sp.y + 3, 9).fill({ color: 0x7a4414 });
    g.circle(sp.x, sp.y - 7, 10).fill({ color: 0x8a4e18 });
    // Top highlight
    g.circle(sp.x - 4, sp.y - 8, 6).fill({ color: 0xa06030, alpha: 0.6 });
    // Entry tunnels
    g.circle(sp.x, sp.y + 2, 5).fill({ color: 0x2a1204 });
    g.circle(sp.x - 7, sp.y + 6, 3).fill({ color: 0x2a1204 });
    g.circle(sp.x + 5, sp.y + 7, 2.5).fill({ color: 0x2a1204 });
    // Loose soil around base
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const d = 18 + i % 3 * 3;
      g.circle(sp.x + Math.cos(a)*d, sp.y + Math.sin(a)*d*0.55, 1.5).fill({ color: 0x9a6030, alpha: 0.6 });
    }

    // ── House (end) ──────────────────────────────────────────────────────────
    const ep = pts[pts.length - 1];
    const hx = ep.x, hy = ep.y;
    // Drop shadow
    g.ellipse(hx+3, hy+26, 28, 7).fill({ color: 0x000000, alpha: 0.3 });
    // Foundation
    g.roundRect(hx-20, hy+12, 40, 6, 1).fill({ color: 0x998866 });
    // Walls
    g.roundRect(hx-18, hy-12, 36, 26, 2).fill({ color: 0xf5e8c8 });
    g.setStrokeStyle({ width: 1.5, color: 0xccaa77 }); g.roundRect(hx-18, hy-12, 36, 26, 2).stroke();
    // Side wall shading
    g.roundRect(hx+12, hy-10, 6, 24, 1).fill({ color: 0xddcc99, alpha: 0.5 });
    // Roof (gabled)
    g.poly([hx-22, hy-12, hx+22, hy-12, hx, hy-34]).fill({ color: 0xcc3311 });
    g.setStrokeStyle({ width: 1.5, color: 0x991100 });
    g.poly([hx-22, hy-12, hx+22, hy-12, hx, hy-34]).stroke();
    // Roof shingles
    g.poly([hx, hy-34, hx+22, hy-12, hx+2, hy-12]).fill({ color: 0xaa2200, alpha: 0.35 });
    // Chimney
    g.roundRect(hx+8, hy-40, 7, 14, 1).fill({ color: 0xaa7755 });
    g.setStrokeStyle({ width: 1, color: 0x886644 }); g.roundRect(hx+8, hy-40, 7, 14, 1).stroke();
    // Door
    g.roundRect(hx-5, hy+2, 10, 16, 2).fill({ color: 0x7a4010 });
    g.circle(hx+3, hy+10, 1.5).fill({ color: 0xffcc44 }); // doorknob
    // Window left
    g.roundRect(hx-16, hy-8, 9, 9, 1).fill({ color: 0x88ccff });
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
    g.moveTo(hx-11.5, hy-8).lineTo(hx-11.5, hy+1).stroke();
    g.moveTo(hx-16, hy-3.5).lineTo(hx-7, hy-3.5).stroke();
    // Light in window
    g.roundRect(hx-16, hy-8, 9, 9, 1).fill({ color: 0xffff88, alpha: 0.2 });
    // Window right
    g.roundRect(hx+7, hy-8, 9, 9, 1).fill({ color: 0x88ccff });
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
    g.moveTo(hx+11.5, hy-8).lineTo(hx+11.5, hy+1).stroke();
    g.moveTo(hx+7, hy-3.5).lineTo(hx+16, hy-3.5).stroke();
    // Warning label
    g.circle(hx, hy-44, 7).fill({ color: 0xffdd00 });
    g.setStrokeStyle({ width: 1.5, color: 0xcc8800 }); g.circle(hx, hy-44, 7).stroke();
    // "!" mark
    g.roundRect(hx-1, hy-49, 2, 6, 1).fill({ color: 0xcc5500 });
    g.circle(hx, hy-41, 1.2).fill({ color: 0xcc5500 });

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
    if (this.banner)    { this.uiLayer.removeChild(this.banner);    this.banner    = null; }
    if (this.bannerSub) { this.uiLayer.removeChild(this.bannerSub); this.bannerSub = null; }

    const WAVE_TEXT: Record<number, [string, string, number]> = {
      1:  ['גל 1 🐜',          'הנמלים יצאו לסיור... בלי רשות',       0xffffff],
      2:  ['גל 2 🐜🐜',        'הביאו חברים. שוב, בלי רשות.',          0xffffff],
      3:  ['גל 3 🦟',          'יתושים? לפחות הם קטנים.',              0xffffff],
      4:  ['גל 4 🦟🪲',        'כמה שיש פה חרקים... שגעון',           0xffffff],
      5:  ['🔥 הבוס הגיע! 🔥', 'נמלת האש. אמא שלהם. מגיעה.',          0xff6600],
      6:  ['גל 6 🪳',          'מקקים?! לא בבית שלנו!!',               0xffffff],
      7:  ['גל 7 🐝',          'הצרעות כועסות. מאוד.',                 0xffcc00],
      8:  ['גל 8 🪲💥',        'טרמיטים. הם אוהבים עץ. והכל.',        0xffffff],
      9:  ['גל 9 😤',          'כמעט... כמעט... אל תיכנע!!!',          0xff9944],
      10: ['👑 המלכה הגיעה! 👑','עכשיו זה אישי. קרב אחרון!',           0xff2020],
    };
    const [label, sub, color] = WAVE_TEXT[waveNum] ?? [`גל ${waveNum}`, '', 0xffffff];

    const t = new Text({ text: label, style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 40,
      fontWeight: '900',
      fill: color,
      dropShadow: { alpha: 0.9, angle: Math.PI/2, blur: 8, color: 0x000000, distance: 3 },
    }});
    t.anchor.set(0.5);
    t.position.set(CANVAS_W / 2, CANVAS_H / 2 - 28);
    t.alpha = 0;
    this.uiLayer.addChild(t);
    this.banner = t;

    if (sub) {
      const ts = new Text({ text: sub, style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fontWeight: '700',
        fill: 0xffffff,
        dropShadow: { alpha: 0.8, angle: Math.PI/2, blur: 4, color: 0x000000, distance: 2 },
      }});
      ts.anchor.set(0.5);
      ts.position.set(CANVAS_W / 2, CANVAS_H / 2 + 18);
      ts.alpha = 0;
      this.uiLayer.addChild(ts);
      this.bannerSub = ts;
    }

    this.bannerDur = 2.8;
    this.bannerTimer = this.bannerDur;
  }

  private tickBanner(dt: number): void {
    if (!this.banner) return;
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) {
      this.uiLayer.removeChild(this.banner); this.banner = null;
      if (this.bannerSub) { this.uiLayer.removeChild(this.bannerSub); this.bannerSub = null; }
      return;
    }
    const fadeIn  = (this.bannerDur - this.bannerTimer) / 0.28;
    const fadeOut = this.bannerTimer / 0.55;
    const a = Math.min(1, fadeIn, fadeOut);
    this.banner.alpha = a;
    if (this.bannerSub) this.bannerSub.alpha = a * 0.88;
    const s = 0.55 + 0.45 * Math.min(1, fadeIn);
    this.banner.scale.set(s);
    if (this.bannerSub) this.bannerSub.scale.set(0.75 + 0.25 * Math.min(1, fadeIn));
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

    const base = new Graphics();
    const R = TILE * 0.42;
    switch (type) {
      case 'BugSpray': {
        // Aerosol can: tall cylindrical body
        base.roundRect(-R*0.55, -R*0.9, R*1.1, R*1.8, 5).fill({ color });
        // Label band
        base.roundRect(-R*0.55, -R*0.15, R*1.1, R*0.5, 0).fill({ color: adjustColor(color, 0.7) });
        // Nozzle tip
        base.roundRect(-R*0.2, -R*1.05, R*0.4, R*0.18, 3).fill({ color: 0x888888 });
        // Cap
        base.roundRect(-R*0.35, -R*1.02, R*0.7, R*0.14, 3).fill({ color: 0x444444 });
        break;
      }
      case 'Swatter': {
        // Flat paddle base
        base.roundRect(-R*0.75, -R*0.2, R*1.5, R*0.6, 5).fill({ color });
        // Grid holes
        base.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.25 });
        for (let xi = -1; xi <= 1; xi++) {
          base.moveTo(xi * R*0.35, -R*0.1).lineTo(xi * R*0.35, R*0.3).stroke();
          base.moveTo(-R*0.55, xi*R*0.1 + R*0.1).lineTo(R*0.55, xi*R*0.1 + R*0.1).stroke();
        }
        break;
      }
      case 'Zapper': {
        // Electric racket base — round lamp housing
        base.circle(0, 0, R*0.7).fill({ color: 0x333344 });
        base.circle(0, 0, R*0.55).fill({ color });
        // Electric arcs around
        base.setStrokeStyle({ width: 1.5, color: 0xffee00, alpha: 0.8 });
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          base.moveTo(Math.cos(a)*R*0.58, Math.sin(a)*R*0.58)
              .lineTo(Math.cos(a)*R*0.72, Math.sin(a)*R*0.72).stroke();
        }
        break;
      }
      case 'Sprinkler': {
        // Round water tank
        base.circle(0, 0, R*0.65).fill({ color: 0x224433 });
        base.circle(0, 0, R*0.5).fill({ color });
        // Water droplets around
        base.setStrokeStyle({ width: 1, color: 0x88ffcc, alpha: 0.5 });
        base.circle(0, 0, R*0.65).stroke();
        break;
      }
      case 'MagGlass': {
        // Magnifying glass — round lens + handle stub
        base.circle(0, -R*0.1, R*0.55).fill({ color: 0x222222 });
        base.circle(0, -R*0.1, R*0.44).fill({ color: 0xaaddff, alpha: 0.35 });
        base.setStrokeStyle({ width: 3.5, color });
        base.circle(0, -R*0.1, R*0.5).stroke();
        // Handle
        base.setStrokeStyle({ width: 5, color: adjustColor(color, 0.7) });
        base.moveTo(R*0.32, R*0.32).lineTo(R*0.62, R*0.62).stroke();
        break;
      }
      case 'PoisonBomb': {
        // Round bomb
        base.circle(0, R*0.08, R*0.62).fill({ color: 0x222222 });
        base.circle(0, R*0.08, R*0.55).fill({ color });
        // Skull
        base.circle(0, R*0.05, R*0.22).fill({ color: 0x000000, alpha: 0.4 });
        base.circle(-R*0.1, R*0.18, R*0.07).fill({ color: 0x000000, alpha: 0.4 });
        base.circle( R*0.1, R*0.18, R*0.07).fill({ color: 0x000000, alpha: 0.4 });
        // Fuse
        base.setStrokeStyle({ width: 2, color: 0xdd8833 });
        base.moveTo(R*0.18, -R*0.5).lineTo(R*0.05, -R*0.7).stroke();
        base.circle(R*0.05, -R*0.72, 3).fill({ color: 0xff8800 });
        break;
      }
      case 'GlueTrap': {
        // Honeycomb flat pad
        base.roundRect(-R*0.85, -R*0.45, R*1.7, R*0.9, 6).fill({ color: 0xcc8800 });
        base.roundRect(-R*0.78, -R*0.38, R*1.56, R*0.76, 5).fill({ color });
        // Honeycomb cells
        base.setStrokeStyle({ width: 1.2, color: 0x885500, alpha: 0.6 });
        for (let xi = -1; xi <= 1; xi++) {
          for (let yi = 0; yi <= 0; yi++) {
            const cx = xi * R*0.52, cy = yi * R*0.35;
            base.moveTo(cx, cy - R*0.22).lineTo(cx+R*0.19, cy-R*0.11).stroke();
            base.moveTo(cx+R*0.19, cy-R*0.11).lineTo(cx+R*0.19, cy+R*0.11).stroke();
            base.moveTo(cx+R*0.19, cy+R*0.11).lineTo(cx, cy+R*0.22).stroke();
          }
        }
        break;
      }
      case 'BugLight': {
        // Lantern: rectangular body with glowing center
        base.roundRect(-R*0.45, -R*0.8, R*0.9, R*1.6, 6).fill({ color: 0x333322 });
        base.roundRect(-R*0.32, -R*0.65, R*0.64, R*1.3, 4).fill({ color: 0xffffaa, alpha: 0.25 });
        base.circle(0, 0, R*0.3).fill({ color: 0xffff88, alpha: 0.9 });
        base.circle(0, 0, R*0.18).fill({ color: 0xffffff });
        // Glow corona
        base.circle(0, 0, R*0.52).fill({ color: 0xffff44, alpha: 0.12 });
        // Top cap
        base.roundRect(-R*0.3, -R*0.9, R*0.6, R*0.14, 3).fill({ color: 0x555544 });
        break;
      }
      default:
        base.roundRect(-R, -R, R*2, R*2, 5).fill({ color });
    }
    // Outline
    base.setStrokeStyle({ width: 2, color: 0x000000, alpha: 0.5 });
    base.roundRect(-R*0.9, -R*0.9, R*1.8, R*1.8, 6).stroke();
    // Highlight
    base.circle(-R*0.28, -R*0.28, R*0.22).fill({ color: 0xffffff, alpha: 0.14 });
    cont.addChild(base);

    // Barrel container (rotates)
    const barrel = new Container();
    if (type !== 'GlueTrap' && type !== 'BugLight' && type !== 'MagGlass') {
      const bG = new Graphics();
      this.drawBarrel(bG, type);
      barrel.addChild(bG);
    }

    // Muzzle flash
    const muzzle = new Graphics();
    muzzle.circle(0, -TILE * 0.48, 9).fill({ color: 0xffee88 });
    muzzle.circle(0, -TILE * 0.48, 5).fill({ color: 0xffffff });
    muzzle.alpha = 0;
    barrel.addChild(muzzle);
    cont.addChild(barrel);

    // Stars container
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
      case 'BugSpray':
        // Spray nozzle tube
        g.roundRect(-3, -TILE*0.52, 6, TILE*0.46, 2).fill({ color: 0x88ccff });
        g.circle(0, -TILE*0.52, 4.5).fill({ color: 0x44aaff });
        break;
      case 'Swatter': {
        // Handle + paddle head
        g.roundRect(-2.5, -TILE*0.22, 5, TILE*0.18, 2).fill({ color: 0xddaa66 });
        g.roundRect(-10, -TILE*0.44, 20, TILE*0.24, 3).fill({ color: 0xdd9944 });
        // Grid on paddle
        g.setStrokeStyle({ width: 1, color: 0x885500, alpha: 0.6 });
        [-5, 0, 5].forEach(x => {
          g.moveTo(x, -TILE*0.44).lineTo(x, -TILE*0.22).stroke();
        });
        g.moveTo(-9, -TILE*0.35).lineTo(9, -TILE*0.35).stroke();
        break;
      }
      case 'Zapper':
        // Electric pole with zapper grid at tip
        g.roundRect(-2.5, -TILE*0.62, 5, TILE*0.5, 1).fill({ color: 0xcccccc });
        g.roundRect(-7, -TILE*0.72, 14, TILE*0.12, 2).fill({ color: 0xffee00 });
        g.setStrokeStyle({ width: 1.5, color: 0xffee00, alpha: 0.8 });
        g.moveTo(-5, -TILE*0.68).lineTo(5, -TILE*0.6).stroke();
        break;
      case 'Sprinkler': {
        // Rotating head with 3 nozzles
        g.roundRect(-2, -TILE*0.18, 4, TILE*0.14, 1).fill({ color: 0x55aa77 });
        [-5, 0, 5].forEach(ox => {
          g.roundRect(ox-1.5, -TILE*0.44, 3, TILE*0.28, 1).fill({ color: 0x44cc88 });
        });
        break;
      }
      case 'PoisonBomb':
        // Short mortar tube
        g.roundRect(-5.5, -TILE*0.3, 11, TILE*0.26, 3).fill({ color: 0x88cc44 });
        g.circle(0, -TILE*0.3, 5.5).fill({ color: 0x336600 });
        break;
      default:
        g.roundRect(-3, -TILE*0.44, 6, TILE*0.38, 2).fill({ color: 0xdddddd });
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
    const dark  = adjustColor(color, 0.5);
    const light = adjustColor(color, 1.45);

    switch (type) {
      /* ── ANT ─────────────────────────────────────────────────────── */
      case 'Ant': {
        // 6 legs first (behind body)
        g.setStrokeStyle({ width: 1.2, color: dark, alpha: 0.9 });
        [[-0.55, -0.15], [0.55, -0.15], [-0.62, 0.05], [0.62, 0.05], [-0.5, 0.25], [0.5, 0.25]].forEach(([ex, ey]) => {
          const sx = ex > 0 ? r*0.28 : -r*0.28;
          g.moveTo(sx, ey*r).lineTo(ex*r, ey*r + r*0.3).stroke();
          g.moveTo(ex*r, ey*r + r*0.3).lineTo(ex*r + (ex>0?r*0.18:-r*0.18), ey*r + r*0.15).stroke();
        });
        // Abdomen (biggest)
        g.ellipse(0, r*0.58, r*0.45, r*0.56).fill({ color });
        g.setStrokeStyle({ width: 1.5, color: dark, alpha: 0.6 });
        g.ellipse(0, r*0.58, r*0.45, r*0.56).stroke();
        // Petiole (tiny waist)
        g.ellipse(0, r*0.06, r*0.12, r*0.14).fill({ color: dark });
        // Thorax
        g.circle(0, -r*0.18, r*0.3).fill({ color });
        // Head
        g.circle(0, -r*0.58, r*0.36).fill({ color });
        // Compound eyes
        g.circle(-r*0.2, -r*0.63, r*0.12).fill({ color: 0x220000 });
        g.circle( r*0.2, -r*0.63, r*0.12).fill({ color: 0x220000 });
        g.circle(-r*0.2, -r*0.63, r*0.06).fill({ color: 0xff2222, alpha: 0.8 });
        g.circle( r*0.2, -r*0.63, r*0.06).fill({ color: 0xff2222, alpha: 0.8 });
        // Mandibles
        g.setStrokeStyle({ width: 1.5, color: dark });
        g.moveTo(-r*0.22, -r*0.82).lineTo(-r*0.38, -r*0.98).stroke();
        g.moveTo( r*0.22, -r*0.82).lineTo( r*0.38, -r*0.98).stroke();
        // Antennae (elbowed)
        g.setStrokeStyle({ width: 1.2, color: dark });
        g.moveTo(-r*0.15, -r*0.85).lineTo(-r*0.35, -r*1.18).stroke();
        g.moveTo(-r*0.35, -r*1.18).lineTo(-r*0.22, -r*1.42).stroke();
        g.moveTo( r*0.15, -r*0.85).lineTo( r*0.35, -r*1.18).stroke();
        g.moveTo( r*0.35, -r*1.18).lineTo( r*0.22, -r*1.42).stroke();
        g.circle(-r*0.22, -r*1.42, r*0.07).fill({ color: dark });
        g.circle( r*0.22, -r*1.42, r*0.07).fill({ color: dark });
        break;
      }
      /* ── FLY ─────────────────────────────────────────────────────── */
      case 'Fly': {
        // Wings (behind body, large + transparent)
        g.ellipse(-r*1.0, -r*0.25, r*0.75, r*0.26).fill({ color: 0xddeeff, alpha: 0.5 });
        g.ellipse( r*1.0, -r*0.25, r*0.75, r*0.26).fill({ color: 0xddeeff, alpha: 0.5 });
        g.setStrokeStyle({ width: 0.8, color: 0x8899aa, alpha: 0.5 });
        g.ellipse(-r*1.0, -r*0.25, r*0.75, r*0.26).stroke();
        g.ellipse( r*1.0, -r*0.25, r*0.75, r*0.26).stroke();
        // Vein lines on wings
        g.setStrokeStyle({ width: 0.6, color: 0x6688aa, alpha: 0.4 });
        g.moveTo(-r*0.42, -r*0.18).lineTo(-r*1.5, -r*0.28).stroke();
        g.moveTo( r*0.42, -r*0.18).lineTo( r*1.5, -r*0.28).stroke();
        // Abdomen (striped)
        g.ellipse(0, r*0.28, r*0.45, r*0.6).fill({ color });
        g.setStrokeStyle({ width: 2, color: 0x334422, alpha: 0.55 });
        [-0.05, 0.18, 0.4].forEach(y => {
          g.moveTo(-r*0.42, r*y).lineTo(r*0.42, r*y).stroke();
        });
        // Thorax
        g.ellipse(0, -r*0.22, r*0.42, r*0.38).fill({ color: adjustColor(color, 0.85) });
        // Big round head
        g.circle(0, -r*0.68, r*0.38).fill({ color });
        // Huge compound eyes
        g.ellipse(-r*0.28, -r*0.7, r*0.25, r*0.22).fill({ color: 0xcc1100 });
        g.ellipse( r*0.28, -r*0.7, r*0.25, r*0.22).fill({ color: 0xcc1100 });
        // Facets
        g.setStrokeStyle({ width: 0.8, color: 0x440000, alpha: 0.6 });
        [-0.5, 0, 0.5].forEach(a => {
          const rad = a * Math.PI/6;
          g.moveTo(-r*0.28 + Math.cos(rad)*r*0.12, -r*0.7 + Math.sin(rad)*r*0.1)
           .lineTo(-r*0.28 + Math.cos(rad)*r*0.22, -r*0.7 + Math.sin(rad)*r*0.18).stroke();
          g.moveTo( r*0.28 + Math.cos(rad)*r*0.12, -r*0.7 + Math.sin(rad)*r*0.1)
           .lineTo( r*0.28 + Math.cos(rad)*r*0.22, -r*0.7 + Math.sin(rad)*r*0.18).stroke();
        });
        // Proboscis
        g.roundRect(-r*0.04, -r*0.52, r*0.08, r*0.22, 1).fill({ color: dark });
        // 6 spindly legs
        g.setStrokeStyle({ width: 1, color: dark });
        [[-r*0.4, 0.02], [-r*0.44, 0.18], [-r*0.38, 0.38]].forEach(([sx, sy]) => {
          g.moveTo(sx, r*sy).lineTo(sx - r*0.35, r*sy + r*0.32).stroke();
          g.moveTo(-sx, r*sy).lineTo(-sx + r*0.35, r*sy + r*0.32).stroke();
        });
        break;
      }
      /* ── ROACH ───────────────────────────────────────────────────── */
      case 'Roach': {
        // Legs (behind)
        g.setStrokeStyle({ width: 1.5, color: dark });
        [[-r*1.05, -r*0.28], [-r*1.12, r*0.0], [-r*0.98, r*0.28]].forEach(([ex, ey]) => {
          g.moveTo(ex > 0 ? r*0.75 : -r*0.75, ey).lineTo(ex, ey).stroke();
          g.moveTo(ex, ey).lineTo(ex + (ex > 0 ? r*0.32 : -r*0.32), ey + r*0.22).stroke();
          g.moveTo(-ex > 0 ? r*0.75 : -r*0.75, ey).lineTo(-ex, ey).stroke();
          g.moveTo(-ex, ey).lineTo(-ex + (-ex > 0 ? r*0.32 : -r*0.32), ey + r*0.22).stroke();
        });
        // Main body (wide, flat, armored)
        g.ellipse(0, r*0.08, r*1.05, r*0.82).fill({ color });
        // Pronotum (shield over thorax)
        g.ellipse(0, -r*0.42, r*0.72, r*0.48).fill({ color: adjustColor(color, 1.15) });
        g.setStrokeStyle({ width: 1.2, color: dark, alpha: 0.6 });
        g.ellipse(0, -r*0.42, r*0.72, r*0.48).stroke();
        // Armor segments on abdomen
        g.setStrokeStyle({ width: 1.2, color: dark, alpha: 0.45 });
        [-r*0.05, r*0.2, r*0.45].forEach(y => {
          g.moveTo(-r*0.9, y).lineTo(r*0.9, y).stroke();
        });
        // Head
        g.ellipse(0, -r*0.82, r*0.38, r*0.24).fill({ color: adjustColor(color, 0.8) });
        // Long antennae
        g.setStrokeStyle({ width: 1, color: dark });
        g.moveTo(-r*0.2, -r*0.95).lineTo(-r*0.65, -r*1.4).stroke();
        g.moveTo( r*0.2, -r*0.95).lineTo( r*0.65, -r*1.4).stroke();
        // Eyes
        g.circle(-r*0.25, -r*0.86, r*0.1).fill({ color: 0x000000 });
        g.circle( r*0.25, -r*0.86, r*0.1).fill({ color: 0x000000 });
        // Shine on pronotum
        g.ellipse(-r*0.18, -r*0.55, r*0.22, r*0.12).fill({ color: 0xffffff, alpha: 0.12 });
        break;
      }
      /* ── MOSQUITO ────────────────────────────────────────────────── */
      case 'Mosquito': {
        // Slim wings
        g.ellipse(-r*0.82, -r*0.3, r*0.6, r*0.18).fill({ color: 0xbbccdd, alpha: 0.45 });
        g.ellipse( r*0.82, -r*0.3, r*0.6, r*0.18).fill({ color: 0xbbccdd, alpha: 0.45 });
        // Thin tapered abdomen
        g.ellipse(0, r*0.38, r*0.28, r*0.72).fill({ color });
        // Thorax hump
        g.ellipse(0, -r*0.12, r*0.38, r*0.35).fill({ color });
        // Head
        g.circle(0, -r*0.55, r*0.26).fill({ color });
        // Long proboscis
        g.roundRect(-r*0.04, -r*0.72, r*0.08, r*0.62, 1).fill({ color: dark });
        g.circle(0, -r*1.26, r*0.05).fill({ color: dark });
        // Eyes (red)
        g.circle(-r*0.16, -r*0.6, r*0.12).fill({ color: 0x880000 });
        g.circle( r*0.16, -r*0.6, r*0.12).fill({ color: 0x880000 });
        g.circle(-r*0.16, -r*0.6, r*0.06).fill({ color: 0xdd2222, alpha: 0.7 });
        g.circle( r*0.16, -r*0.6, r*0.06).fill({ color: 0xdd2222, alpha: 0.7 });
        // Antennae (feathery)
        g.setStrokeStyle({ width: 1, color: dark });
        g.moveTo(-r*0.1, -r*0.72).lineTo(-r*0.3, -r*1.05).stroke();
        g.moveTo( r*0.1, -r*0.72).lineTo( r*0.3, -r*1.05).stroke();
        // Long thin legs
        g.setStrokeStyle({ width: 0.9, color: dark });
        [[-r*0.32, -r*0.1, -r*0.85, -r*0.2], [-r*0.36, r*0.1, -r*0.92, r*0.12],
         [-r*0.3, r*0.3, -r*0.78, r*0.55], [ r*0.32, -r*0.1, r*0.85, -r*0.2],
         [ r*0.36, r*0.1, r*0.92, r*0.12], [ r*0.3, r*0.3, r*0.78, r*0.55]].forEach(([sx,sy,ex,ey]) => {
          g.moveTo(sx, sy).lineTo(ex, ey).stroke();
        });
        break;
      }
      /* ── BEETLE ──────────────────────────────────────────────────── */
      case 'Beetle': {
        // Legs
        g.setStrokeStyle({ width: 1.5, color: dark });
        [[-r*1.0, -r*0.18], [-r*1.08, r*0.08], [-r*0.95, r*0.35]].forEach(([ex, ey]) => {
          g.moveTo(-r*0.75, ey).lineTo(ex, ey).stroke();
          g.moveTo(ex, ey).lineTo(ex - r*0.25, ey + r*0.2).stroke();
          g.moveTo( r*0.75, ey).lineTo(-ex, ey).stroke();
          g.moveTo(-ex, ey).lineTo(-ex + r*0.25, ey + r*0.2).stroke();
        });
        // Rounded shield body (elytra)
        g.ellipse(0, r*0.12, r*0.82, r*0.88).fill({ color });
        // Elytra center seam
        g.setStrokeStyle({ width: 1.5, color: dark, alpha: 0.7 });
        g.moveTo(0, -r*0.7).lineTo(0, r*0.95).stroke();
        // Iridescent spots
        g.circle(-r*0.3, r*0.05, r*0.18).fill({ color: light, alpha: 0.55 });
        g.circle( r*0.3, r*0.05, r*0.18).fill({ color: light, alpha: 0.55 });
        g.circle(-r*0.28, r*0.5, r*0.14).fill({ color: light, alpha: 0.4 });
        g.circle( r*0.28, r*0.5, r*0.14).fill({ color: light, alpha: 0.4 });
        // Pronotum
        g.ellipse(0, -r*0.58, r*0.55, r*0.38).fill({ color: adjustColor(color, 1.2) });
        // Head
        g.circle(0, -r*0.85, r*0.3).fill({ color: adjustColor(color, 0.85) });
        // Short antennae
        g.setStrokeStyle({ width: 1.2, color: dark });
        g.moveTo(-r*0.16, -r*1.02).lineTo(-r*0.35, -r*1.28).stroke();
        g.moveTo( r*0.16, -r*1.02).lineTo( r*0.35, -r*1.28).stroke();
        // Eyes
        g.circle(-r*0.2, -r*0.9, r*0.1).fill({ color: 0x000000 });
        g.circle( r*0.2, -r*0.9, r*0.1).fill({ color: 0x000000 });
        // Overall shine
        g.ellipse(-r*0.22, -r*0.12, r*0.28, r*0.16).fill({ color: 0xffffff, alpha: 0.15 });
        break;
      }
      /* ── WASP ────────────────────────────────────────────────────── */
      case 'Wasp': {
        // Transparent wings
        g.ellipse(-r*0.88, -r*0.28, r*0.68, r*0.22).fill({ color: 0xeeeeff, alpha: 0.48 });
        g.ellipse( r*0.88, -r*0.28, r*0.68, r*0.22).fill({ color: 0xeeeeff, alpha: 0.48 });
        g.ellipse(-r*0.82, -r*0.08, r*0.52, r*0.15).fill({ color: 0xdddeff, alpha: 0.35 });
        g.ellipse( r*0.82, -r*0.08, r*0.52, r*0.15).fill({ color: 0xdddeff, alpha: 0.35 });
        g.setStrokeStyle({ width: 0.7, color: 0x8888aa, alpha: 0.4 });
        g.ellipse(-r*0.88, -r*0.28, r*0.68, r*0.22).stroke();
        g.ellipse( r*0.88, -r*0.28, r*0.68, r*0.22).stroke();
        // Tapered striped abdomen
        g.ellipse(0, r*0.62, r*0.35, r*0.58).fill({ color });
        // Black stripes
        g.setStrokeStyle({ width: 3, color: 0x111100, alpha: 0.75 });
        [r*0.3, r*0.54, r*0.78].forEach(y => {
          g.moveTo(-r*0.32, y).lineTo(r*0.32, y).stroke();
        });
        // Narrow waist (petiole)
        g.ellipse(0, r*0.1, r*0.14, r*0.16).fill({ color: 0x221100 });
        // Thorax
        g.ellipse(0, -r*0.18, r*0.46, r*0.38).fill({ color: adjustColor(color, 0.9) });
        // Head
        g.circle(0, -r*0.65, r*0.34).fill({ color });
        // Large eyes
        g.ellipse(-r*0.22, -r*0.68, r*0.18, r*0.22).fill({ color: 0x1a1100 });
        g.ellipse( r*0.22, -r*0.68, r*0.18, r*0.22).fill({ color: 0x1a1100 });
        // Short antennae
        g.setStrokeStyle({ width: 1.5, color: dark });
        g.moveTo(-r*0.12, -r*0.88).lineTo(-r*0.28, -r*1.18).stroke();
        g.moveTo( r*0.12, -r*0.88).lineTo( r*0.28, -r*1.18).stroke();
        g.circle(-r*0.28, -r*1.18, r*0.06).fill({ color: dark });
        g.circle( r*0.28, -r*1.18, r*0.06).fill({ color: dark });
        // Stinger
        g.poly([-r*0.06, r*1.18, r*0.06, r*1.18, 0, r*1.42]).fill({ color: dark });
        // Legs
        g.setStrokeStyle({ width: 1.2, color: dark });
        [[-r*0.42, -r*0.1], [-r*0.46, r*0.08], [-r*0.38, r*0.28]].forEach(([ex, ey]) => {
          g.moveTo(-r*0.4, ey).lineTo(ex, ey).stroke();
          g.moveTo(ex, ey).lineTo(ex - r*0.28, ey + r*0.3).stroke();
          g.moveTo( r*0.4, ey).lineTo(-ex, ey).stroke();
          g.moveTo(-ex, ey).lineTo(-ex + r*0.28, ey + r*0.3).stroke();
        });
        break;
      }
      /* ── TERMITE ─────────────────────────────────────────────────── */
      case 'Termite': {
        // Explosion warning aura
        g.circle(0, r*0.2, r*0.72).fill({ color: 0xff6600, alpha: 0.15 });
        // Soft pale abdomen
        g.ellipse(0, r*0.25, r*0.65, r*0.82).fill({ color });
        // Thorax
        g.circle(0, -r*0.28, r*0.4).fill({ color });
        // Large head with mandibles
        g.circle(0, -r*0.72, r*0.46).fill({ color: adjustColor(color, 1.1) });
        // Big mandibles
        g.setStrokeStyle({ width: 3, color: adjustColor(color, 0.6) });
        g.moveTo(-r*0.28, -r*0.98).lineTo(-r*0.58, -r*1.28).stroke();
        g.moveTo(-r*0.58, -r*1.28).lineTo(-r*0.42, -r*1.12).stroke();
        g.moveTo( r*0.28, -r*0.98).lineTo( r*0.58, -r*1.28).stroke();
        g.moveTo( r*0.58, -r*1.28).lineTo( r*0.42, -r*1.12).stroke();
        // Eyes (orange glow)
        g.circle(-r*0.22, -r*0.76, r*0.14).fill({ color: 0xff8800 });
        g.circle( r*0.22, -r*0.76, r*0.14).fill({ color: 0xff8800 });
        g.circle(-r*0.22, -r*0.76, r*0.07).fill({ color: 0xffcc44 });
        g.circle( r*0.22, -r*0.76, r*0.07).fill({ color: 0xffcc44 });
        // Short antennae
        g.setStrokeStyle({ width: 1.2, color: dark });
        g.moveTo(-r*0.15, -r*1.05).lineTo(-r*0.28, -r*1.35).stroke();
        g.moveTo( r*0.15, -r*1.05).lineTo( r*0.28, -r*1.35).stroke();
        // Stubby legs
        g.setStrokeStyle({ width: 1.5, color: dark });
        [r*-0.12, r*0.1, r*0.35].forEach(ey => {
          g.moveTo(-r*0.6, ey).lineTo(-r*1.0, ey + r*0.18).stroke();
          g.moveTo( r*0.6, ey).lineTo( r*1.0, ey + r*0.18).stroke();
        });
        break;
      }
      /* ── FIRE ANT (mid-boss) ─────────────────────────────────────── */
      case 'FireAnt': {
        // Fire aura
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI*2*i)/8 + 0.2;
          g.ellipse(Math.cos(a)*r*0.95, r*0.4 + Math.sin(a)*r*0.7, r*0.22, r*0.14).fill({ color: 0xff6600, alpha: 0.4 });
        }
        // Heavy legs
        g.setStrokeStyle({ width: 2, color: 0x881100 });
        [[-r*0.55, -r*0.12], [-r*0.6, r*0.12], [-r*0.52, r*0.38]].forEach(([ex, ey]) => {
          g.moveTo(ex > 0 ? r*0.45 : -r*0.45, ey).lineTo(ex, ey).stroke();
          g.moveTo(ex, ey).lineTo(ex + (ex > 0 ? r*0.32 : -r*0.32), ey + r*0.28).stroke();
          g.moveTo(-ex > 0 ? r*0.45 : -r*0.45, ey).lineTo(-ex, ey).stroke();
          g.moveTo(-ex, ey).lineTo(-ex + (-ex > 0 ? r*0.32 : -r*0.32), ey + r*0.28).stroke();
        });
        // Abdomen (glowing)
        g.ellipse(0, r*0.55, r*0.58, r*0.65).fill({ color: 0xcc2200 });
        g.ellipse(0, r*0.55, r*0.44, r*0.5).fill({ color: 0xff4400, alpha: 0.7 });
        // Waist
        g.ellipse(0, r*0.05, r*0.16, r*0.18).fill({ color: 0x881100 });
        // Thorax
        g.circle(0, -r*0.18, r*0.42).fill({ color });
        // Head
        g.circle(0, -r*0.72, r*0.52).fill({ color });
        // Eyes (glowing red)
        g.circle(-r*0.26, -r*0.78, r*0.18).fill({ color: 0xff0000 });
        g.circle( r*0.26, -r*0.78, r*0.18).fill({ color: 0xff0000 });
        g.circle(-r*0.26, -r*0.78, r*0.09).fill({ color: 0xffffff });
        g.circle( r*0.26, -r*0.78, r*0.09).fill({ color: 0xffffff });
        // Mandibles (big)
        g.setStrokeStyle({ width: 2.5, color: 0x881100 });
        g.moveTo(-r*0.3, -r*1.05).lineTo(-r*0.58, -r*1.35).stroke();
        g.moveTo( r*0.3, -r*1.05).lineTo( r*0.58, -r*1.35).stroke();
        // Antennae
        g.setStrokeStyle({ width: 2, color: 0x881100 });
        g.moveTo(-r*0.18, -r*1.1).lineTo(-r*0.42, -r*1.55).stroke();
        g.moveTo(-r*0.42, -r*1.55).lineTo(-r*0.28, -r*1.82).stroke();
        g.moveTo( r*0.18, -r*1.1).lineTo( r*0.42, -r*1.55).stroke();
        g.moveTo( r*0.42, -r*1.55).lineTo( r*0.28, -r*1.82).stroke();
        g.circle(-r*0.28, -r*1.82, r*0.1).fill({ color: 0xff4400 });
        g.circle( r*0.28, -r*1.82, r*0.1).fill({ color: 0xff4400 });
        break;
      }
      /* ── QUEEN ANT (final boss) ──────────────────────────────────── */
      case 'QueenAnt': {
        // Crown (drawn first, behind head)
        const cy = -r*1.55;
        g.poly([-r*0.46, cy+r*0.3, r*0.46, cy+r*0.3, r*0.42, cy, r*0.22, cy+r*0.18,
                0, cy-r*0.16, -r*0.22, cy+r*0.18, -r*0.42, cy]).fill({ color: 0xffd700 });
        g.circle(0, cy-r*0.14, r*0.1).fill({ color: 0xff2222 });
        g.circle(-r*0.3, cy+r*0.12, r*0.08).fill({ color: 0x4444ff });
        g.circle( r*0.3, cy+r*0.12, r*0.08).fill({ color: 0x44ff44 });
        g.setStrokeStyle({ width: 1.5, color: 0xcc9900 });
        g.poly([-r*0.46, cy+r*0.3, r*0.46, cy+r*0.3, r*0.42, cy, r*0.22, cy+r*0.18,
                0, cy-r*0.16, -r*0.22, cy+r*0.18, -r*0.42, cy]).stroke();

        // Large wings
        g.ellipse(-r*1.12, -r*0.28, r*0.82, r*0.3).fill({ color: 0xaabbff, alpha: 0.42 });
        g.ellipse( r*1.12, -r*0.28, r*0.82, r*0.3).fill({ color: 0xaabbff, alpha: 0.42 });
        g.ellipse(-r*1.0, r*0.02, r*0.62, r*0.2).fill({ color: 0xaabbff, alpha: 0.3 });
        g.ellipse( r*1.0, r*0.02, r*0.62, r*0.2).fill({ color: 0xaabbff, alpha: 0.3 });
        g.setStrokeStyle({ width: 0.8, color: 0x6677cc, alpha: 0.4 });
        g.ellipse(-r*1.12, -r*0.28, r*0.82, r*0.3).stroke();
        g.ellipse( r*1.12, -r*0.28, r*0.82, r*0.3).stroke();

        // Heavy legs
        g.setStrokeStyle({ width: 2.5, color: 0x770000 });
        [[-r*0.65, -r*0.18], [-r*0.72, r*0.1], [-r*0.62, r*0.42]].forEach(([ex, ey]) => {
          g.moveTo(-r*0.55, ey).lineTo(ex, ey).stroke();
          g.moveTo(ex, ey).lineTo(ex - r*0.38, ey + r*0.35).stroke();
          g.moveTo( r*0.55, ey).lineTo(-ex, ey).stroke();
          g.moveTo(-ex, ey).lineTo(-ex + r*0.38, ey + r*0.35).stroke();
        });

        // Large abdomen with pattern
        g.ellipse(0, r*0.6, r*0.88, r*0.78).fill({ color: 0xcc1100 });
        g.setStrokeStyle({ width: 2.5, color: 0x880000, alpha: 0.6 });
        [r*0.35, r*0.6, r*0.85].forEach(y => {
          g.moveTo(-r*0.8, y).lineTo(r*0.8, y).stroke();
        });
        // Abdomen shine
        g.ellipse(-r*0.3, r*0.3, r*0.35, r*0.2).fill({ color: 0xff3322, alpha: 0.35 });

        // Waist
        g.ellipse(0, r*0.05, r*0.18, r*0.2).fill({ color: 0x880000 });
        // Thorax
        g.circle(0, -r*0.2, r*0.52).fill({ color });
        // Large head
        g.circle(0, -r*0.85, r*0.62).fill({ color });
        // Glowing eyes
        g.circle(-r*0.3, -r*0.92, r*0.2).fill({ color: 0xff0000 });
        g.circle( r*0.3, -r*0.92, r*0.2).fill({ color: 0xff0000 });
        g.circle(-r*0.3, -r*0.92, r*0.1).fill({ color: 0xffffff });
        g.circle( r*0.3, -r*0.92, r*0.1).fill({ color: 0xffffff });
        // Mandibles
        g.setStrokeStyle({ width: 3, color: 0x880000 });
        g.moveTo(-r*0.35, -r*1.22).lineTo(-r*0.65, -r*1.52).stroke();
        g.moveTo(-r*0.65, -r*1.52).lineTo(-r*0.48, -r*1.35).stroke();
        g.moveTo( r*0.35, -r*1.22).lineTo( r*0.65, -r*1.52).stroke();
        g.moveTo( r*0.65, -r*1.52).lineTo( r*0.48, -r*1.35).stroke();
        // Elbowed antennae
        g.setStrokeStyle({ width: 2.5, color: 0x880000 });
        g.moveTo(-r*0.25, -r*1.32).lineTo(-r*0.58, -r*1.82).stroke();
        g.moveTo(-r*0.58, -r*1.82).lineTo(-r*0.38, -r*2.1).stroke();
        g.moveTo( r*0.25, -r*1.32).lineTo( r*0.58, -r*1.82).stroke();
        g.moveTo( r*0.58, -r*1.82).lineTo( r*0.38, -r*2.1).stroke();
        g.circle(-r*0.38, -r*2.1, r*0.14).fill({ color: 0xff2222 });
        g.circle( r*0.38, -r*2.1, r*0.14).fill({ color: 0xff2222 });
        break;
      }
      default:
        g.circle(0, 0, r).fill({ color });
    }

    // Highlight (all types)
    g.circle(-r*0.32, -r*0.32, r*0.18).fill({ color: 0xffffff, alpha: 0.15 });
    // Cartoon outline
    g.setStrokeStyle({ width: 1.8, color: 0x000000, alpha: 0.45 });
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
    this.banner = null;
    this.bannerSub = null;
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
