import { Application, Graphics, Container, Text } from 'pixi.js';
import type { GameState } from './GameEngine';
import { PATH_WAYPOINTS } from './PathManager';
import { BALANCE } from '../balance';

export const CANVAS_W = 800;
export const CANVAS_H = 500;
export const TILE = BALANCE.TILE_SIZE;

// ── Color tables ────────────────────────────────────────────────────────────

const EC: Record<string, number> = {
  Walker:     0x55aa55,
  Runner:     0x77dd33,
  Tank:       0x888855,
  Spitter:    0xaacc00,
  Crawler:    0x336633,
  Screamer:   0xee8800,
  Bloater:    0x8855cc,
  Alpha:      0xff5500,
  PatientZero:0xdd1111,
};

const TC: Record<string, number> = {
  Rifleman:    0x3377cc,
  Shotgunner:  0xcc5522,
  Sniper:      0x22aacc,
  MachineGun:  0xcc2222,
  Flamethrower:0xff5500,
  Mortar:      0x888888,
  BarbedWire:  0x999933,
  Watchtower:  0x22bb77,
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

  // Screen shake
  private shakeAmt  = 0;
  private shakeDur  = 0;
  private shakeMax  = 0;

  // Wave banner
  private banner: Text | null = null;
  private bannerTimer = 0;
  private bannerDur   = 0;

  async init(el: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({ width: CANVAS_W, height: CANVAS_H, backgroundColor: 0x0e0e0e, antialias: true });
    el.appendChild(this.app.canvas);
    this.app.stage.addChild(
      this.pathLayer, this.towerLayer, this.enemyLayer,
      this.projectileLayer, this.particleLayer, this.uiLayer,
    );
    this.drawPath();
  }

  // ── Static path ────────────────────────────────────────────────────────

  private drawPath(): void {
    const g = new Graphics();

    // Grid dots (subtle)
    for (let x = 0; x <= CANVAS_W; x += TILE) {
      for (let y = 0; y <= CANVAS_H; y += TILE) {
        g.circle(x, y, 0.8).fill({ color: 0x222222 });
      }
    }

    // Path layers
    const pts = PATH_WAYPOINTS;
    const stroke = (w: number, color: number, alpha = 1) => {
      g.setStrokeStyle({ width: w, color, alpha });
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };
    stroke(TILE * 1.0,  0x130f07);
    stroke(TILE * 0.82, 0x3b2810);
    stroke(TILE * 0.65, 0x4e3518);
    stroke(4,           0x6b4c26, 0.45); // centre highlight

    // Gravel: random dots on path area (static, drawn once)
    // We approximate by sprinkling dots near waypoints
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y, bx = pts[i+1].x, by = pts[i+1].y;
      const steps = Math.ceil(Math.hypot(bx-ax, by-ay) / 8);
      for (let s = 0; s <= steps; s++) {
        const t2 = s / steps;
        const cx = ax + (bx-ax)*t2 + (Math.random()-0.5)*TILE*0.5;
        const cy = ay + (by-ay)*t2 + (Math.random()-0.5)*TILE*0.5;
        const r  = 0.8 + Math.random() * 1.2;
        const luma = 0x40 + Math.floor(Math.random()*0x18);
        g.circle(cx, cy, r).fill({ color: (luma<<16)|(luma*0.9<<8)|Math.floor(luma*0.7) });
      }
    }

    // Start
    const s = pts[0];
    g.circle(s.x, s.y, 10).fill({ color: 0x22c55e });
    g.setStrokeStyle({ width: 2, color: 0x166534 }); g.circle(s.x, s.y, 10).stroke();
    g.rect(s.x - 1.5, s.y - 14, 3, 14).fill({ color: 0x166534 }); // flag pole
    g.poly([s.x+1.5, s.y-14, s.x+9, s.y-10, s.x+1.5, s.y-7]).fill({ color: 0x22c55e });

    // End (base / danger marker)
    const e = pts[pts.length - 1];
    g.circle(e.x, e.y, 10).fill({ color: 0xdc2626 });
    g.setStrokeStyle({ width: 2, color: 0x7f1d1d }); g.circle(e.x, e.y, 10).stroke();
    // X marks
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
      this.app.stage.x = (Math.random() - 0.5) * amt * 2;
      this.app.stage.y = (Math.random() - 0.5) * amt * 2;
    } else {
      this.app.stage.x = 0;
      this.app.stage.y = 0;
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
    // Fade in 0.25s, hold, fade out 0.5s
    const fadeIn  = (this.bannerDur - this.bannerTimer) / 0.25;
    const fadeOut = this.bannerTimer / 0.5;
    this.banner.alpha = Math.min(1, fadeIn, fadeOut);
    const s = 0.6 + 0.4 * Math.min(1, fadeIn);
    this.banner.scale.set(s);
    void remaining; // used indirectly
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
        // Push back then spring forward
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
    }

    for (const [id, sp] of this.towerSprites) {
      if (!ids.has(id)) { this.towerLayer.removeChild(sp.container); this.towerSprites.delete(id); }
    }
  }

  private makeTower(type: string, range: number): TowerSprite {
    const color = TC[type] ?? 0xaaaaaa;
    const cont  = new Container();

    // Range ring
    const ring = new Graphics();
    ring.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.06 });
    ring.circle(0, 0, range).stroke();
    cont.addChild(ring);

    // Base shape (varies by type)
    const base = new Graphics();
    const half = TILE * 0.38;
    switch (type) {
      case 'Sniper':
        // Tall slim hexagon
        base.poly([-half*0.7,-half, half*0.7,-half, half,-0, half*0.7,half, -half*0.7,half, -half,0]).fill({ color });
        break;
      case 'Mortar':
        // Wide heavy circle
        base.circle(0, 0, TILE*0.42).fill({ color });
        base.circle(0, 0, TILE*0.28).fill({ color: 0x555555 });
        break;
      case 'BarbedWire': {
        // X spikes — no barrel
        base.setStrokeStyle({ width: 4, color: 0xcccc44 });
        [-45,-135,45,135].forEach(a => {
          const rad = a * Math.PI/180;
          base.moveTo(0,0).lineTo(Math.cos(rad)*TILE*0.45, Math.sin(rad)*TILE*0.45);
        });
        base.stroke();
        base.circle(0,0,4).fill({ color: 0xffff66 });
        break;
      }
      case 'Watchtower':
        // Tall rectangular tower
        base.roundRect(-half*0.55, -half*1.1, half*1.1, half*2.2, 3).fill({ color });
        base.roundRect(-half*0.7, half*0.5, half*1.4, half*0.8, 2).fill({ color: adjustColor(color, 0.8) }); // platform
        break;
      case 'Flamethrower':
        // Round base
        base.circle(0, 0, TILE*0.38).fill({ color });
        base.circle(0, 0, TILE*0.23).fill({ color: adjustColor(color, 0.7) });
        break;
      default:
        base.roundRect(-half, -half, half*2, half*2, 5).fill({ color });
    }
    // Outline
    base.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.5 });
    base.circle(0, 0, half * 1.1).stroke();
    // Highlight
    base.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.12 });
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

    return { container: cont, barrel, muzzle, muzzleTimer: 0, angle: -Math.PI/2, popTimer: SPAWN_DUR, recoilTimer: 0, recoilMax: RECOIL_DUR };
  }

  private drawBarrel(g: Graphics, type: string): void {
    switch (type) {
      case 'Shotgunner':
        // Short fat barrel, fan tip
        g.roundRect(-5, -TILE*0.38, 10, TILE*0.34, 2).fill({ color: 0xdddddd });
        g.poly([-8, -TILE*0.38, 8, -TILE*0.38, 11, -TILE*0.47, -11, -TILE*0.47]).fill({ color: 0xcccccc });
        break;
      case 'Sniper':
        // Very long thin barrel
        g.roundRect(-2, -TILE*0.62, 4, TILE*0.56, 1).fill({ color: 0xdddddd });
        g.circle(0, -TILE*0.62, 3).fill({ color: 0x555555 }); // scope hint
        break;
      case 'MachineGun': {
        // 3 parallel thin barrels
        [-3.5, 0, 3.5].forEach(ox => {
          g.roundRect(ox-1.5, -TILE*0.44, 3, TILE*0.38, 1).fill({ color: 0xcccccc });
        });
        break;
      }
      case 'Flamethrower':
        // Cone nozzle
        g.poly([-4, -TILE*0.02, 4, -TILE*0.02, 7, -TILE*0.44, -7, -TILE*0.44]).fill({ color: 0xdd8844 });
        g.roundRect(-3, -TILE*0.44, 6, TILE*0.12, 2).fill({ color: 0xffaa44 });
        break;
      case 'Mortar':
        // Short stubby
        g.roundRect(-6, -TILE*0.30, 12, TILE*0.26, 3).fill({ color: 0xbbbbbb });
        g.circle(0, -TILE*0.30, 6).fill({ color: 0x444444 }); // muzzle end
        break;
      default:
        // Standard rifle barrel
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
      const hpC = ratio > 0.6 ? 0x22c55e : ratio > 0.3 ? 0xf59e0b : 0xef4444;
      sp.hpFg.clear().roundRect(-bW/2, -r2-9, bW*ratio, 4, 2).fill({ color: hpC });
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
    shadow.ellipse(1, r*0.85, r*0.85, r*0.28).fill({ color: 0x000000, alpha: 0.28 });
    cont.addChild(shadow);

    const body = new Graphics();
    this.drawEnemyBody(body, type, r, color);
    cont.addChild(body);

    // HP bar
    const bW = r * 2.8;
    const hpBg = new Graphics();
    hpBg.roundRect(-bW/2, -r-9, bW, 4, 2).fill({ color: 0x0a0a0a });
    cont.addChild(hpBg);
    const hpFg = new Graphics();
    hpFg.roundRect(-bW/2, -r-9, bW, 4, 2).fill({ color: 0x22c55e });
    cont.addChild(hpFg);

    return { container: cont, body, hpFg, prevHp: 0, flashTimer: 0, bobTimer: 0, isDying: false, deathTimer: 0 };
  }

  private drawEnemyBody(g: Graphics, type: string, r: number, color: number): void {
    const dark = adjustColor(color, 0.6);

    switch (type) {
      case 'Walker': {
        // Humanoid: head + body + zombie eyes
        g.roundRect(-r*0.48, -r*0.1, r*0.96, r*1.0, 2).fill({ color });     // body
        g.circle(0, -r*0.45, r*0.52).fill({ color });                         // head
        // eyes
        g.circle(-r*0.2, -r*0.5, r*0.13).fill({ color: 0xffffff });
        g.circle( r*0.2, -r*0.5, r*0.13).fill({ color: 0xffffff });
        g.circle(-r*0.2, -r*0.5, r*0.07).fill({ color: 0xcc0000 });
        g.circle( r*0.2, -r*0.5, r*0.07).fill({ color: 0xcc0000 });
        break;
      }
      case 'Runner': {
        // Lean ellipse, angled arms
        g.ellipse(0, 0, r*0.65, r).fill({ color });
        g.circle(0, -r*0.62, r*0.38).fill({ color });                         // head
        g.ellipse(-r*0.7, 0, r*0.18, r*0.5).fill({ color: dark });           // left arm
        break;
      }
      case 'Tank': {
        // Wide armoured block
        g.roundRect(-r, -r*0.7, r*2, r*1.4, 4).fill({ color });
        g.circle(0, -r*0.55, r*0.35).fill({ color: dark });                   // head
        // Armour lines
        g.setStrokeStyle({ width: 2, color: dark, alpha: 0.7 });
        g.moveTo(-r*0.8, 0).lineTo(r*0.8, 0).stroke();
        g.moveTo(-r*0.8, r*0.4).lineTo(r*0.8, r*0.4).stroke();
        break;
      }
      case 'Spitter': {
        g.circle(0, 0, r).fill({ color });
        // Dripping mouth
        g.circle(0, r*0.35, r*0.3).fill({ color: 0x88cc00 });
        g.ellipse(0, r*0.78, r*0.1, r*0.25).fill({ color: 0x88cc00 });       // drip
        g.circle(-r*0.3, -r*0.25, r*0.14).fill({ color: 0x000000 });         // eyes
        g.circle( r*0.3, -r*0.25, r*0.14).fill({ color: 0x000000 });
        break;
      }
      case 'Crawler': {
        // Flat wide oval + legs
        g.ellipse(0, 0, r*1.3, r*0.65).fill({ color });
        for (let i = 0; i < 3; i++) {
          const xOff = (i-1) * r * 0.7;
          g.roundRect(xOff-1.5, r*0.5, 3, r*0.5, 1).fill({ color: dark });  // leg
          g.roundRect(xOff-1.5, -r,    3, r*0.5, 1).fill({ color: dark });
        }
        break;
      }
      case 'Screamer': {
        g.circle(0, 0, r).fill({ color });
        // Open jaw
        g.ellipse(0, r*0.22, r*0.48, r*0.38).fill({ color: 0x111111 });
        // Scream lines
        g.setStrokeStyle({ width: 1.5, color: 0xffaa44, alpha: 0.6 });
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
        // Puffy circle with bumps
        g.circle(0, 0, r).fill({ color });
        for (let i = 0; i < 7; i++) {
          const a = (Math.PI*2*i)/7;
          g.circle(Math.cos(a)*r*0.72, Math.sin(a)*r*0.72, r*0.22).fill({ color: adjustColor(color, 1.2) });
        }
        g.circle(0, 0, r*0.25).fill({ color: 0x663399, alpha: 0.6 });        // core
        break;
      }
      case 'Alpha': {
        // Diamond / 4-pointed star
        g.poly([0,-r, r*0.6,-r*0.35, r*0.35,0, r*0.6,r*0.35, 0,r, -r*0.6,r*0.35, -r*0.35,0, -r*0.6,-r*0.35]).fill({ color });
        g.circle(0, 0, r*0.32).fill({ color: 0xff8800 });                     // core
        g.circle(0, 0, r*0.15).fill({ color: 0xffcc44 });
        break;
      }
      case 'PatientZero': {
        g.circle(0, 0, r).fill({ color });
        // Pulsing veins
        g.setStrokeStyle({ width: 2, color: 0x880000, alpha: 0.7 });
        g.moveTo(-r*0.6, -r*0.5).lineTo(-r*0.2, 0).lineTo(-r*0.5, r*0.5).stroke();
        g.moveTo( r*0.6, -r*0.5).lineTo( r*0.2, 0).lineTo( r*0.5, r*0.5).stroke();
        // Biohazard cross
        g.rect(-r*0.12, -r*0.6, r*0.24, r*1.2).fill({ color: 0xff0000, alpha: 0.9 });
        g.rect(-r*0.6, -r*0.12, r*1.2, r*0.24).fill({ color: 0xff0000, alpha: 0.9 });
        g.circle(0, 0, r*0.22).fill({ color: 0xff0000 });
        break;
      }
      default:
        g.circle(0, 0, r).fill({ color });
    }

    // Common shine + outline
    g.circle(-r*0.3, -r*0.3, r*0.2).fill({ color: 0xffffff, alpha: 0.14 });
    g.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.4 });
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
