import type { Vec2 } from '../entities/types';

export const PATH_VARIANTS: Vec2[][] = [
  // Variant 0 — original zigzag
  [
    { x: 0,   y: 120 }, { x: 160, y: 120 }, { x: 160, y: 280 },
    { x: 320, y: 280 }, { x: 320, y: 120 }, { x: 480, y: 120 },
    { x: 480, y: 360 }, { x: 640, y: 360 }, { x: 640, y: 200 }, { x: 800, y: 200 },
  ],
  // Variant 1 — wide S-curve
  [
    { x: 0,   y: 200 }, { x: 120, y: 200 }, { x: 120, y:  80 },
    { x: 320, y:  80 }, { x: 320, y: 280 }, { x: 200, y: 280 },
    { x: 200, y: 400 }, { x: 480, y: 400 }, { x: 480, y: 160 },
    { x: 680, y: 160 }, { x: 680, y: 320 }, { x: 800, y: 320 },
  ],
  // Variant 2 — tight loops
  [
    { x: 0,   y:  80 }, { x: 240, y:  80 }, { x: 240, y: 280 },
    { x: 400, y: 280 }, { x: 400, y: 120 }, { x: 560, y: 120 },
    { x: 560, y: 360 }, { x: 720, y: 360 }, { x: 720, y: 200 }, { x: 800, y: 200 },
  ],
];

function computeSegments(waypoints: Vec2[]): Array<{ dx: number; dy: number; len: number; cumLen: number }> {
  const segs = [];
  let cum = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    cum += len;
    segs.push({ dx, dy, len, cumLen: cum });
  }
  return segs;
}

export let PATH_WAYPOINTS: Vec2[]  = PATH_VARIANTS[0];
export let PATH_SEGMENTS           = computeSegments(PATH_VARIANTS[0]);
export let PATH_TOTAL_LENGTH       = PATH_SEGMENTS[PATH_SEGMENTS.length - 1].cumLen;
export let ACTIVE_PATH_VARIANT     = 0;

export function setActivePath(variantIdx: number): void {
  ACTIVE_PATH_VARIANT = variantIdx;
  PATH_WAYPOINTS      = PATH_VARIANTS[variantIdx];
  PATH_SEGMENTS       = computeSegments(PATH_VARIANTS[variantIdx]);
  PATH_TOTAL_LENGTH   = PATH_SEGMENTS[PATH_SEGMENTS.length - 1].cumLen;
}

/** Given a distance along the path, return world position */
export function positionAlongPath(dist: number): Vec2 {
  const segs = PATH_SEGMENTS;
  const pts  = PATH_WAYPOINTS;
  if (dist <= 0) return { ...pts[0] };
  let prevCum = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (dist <= seg.cumLen) {
      const t = (dist - prevCum) / seg.len;
      const wp = pts[i];
      return { x: wp.x + seg.dx * t, y: wp.y + seg.dy * t };
    }
    prevCum = seg.cumLen;
  }
  return { ...pts[pts.length - 1] };
}

/** Check if a grid cell (col, row) at tile size is too close to the path */
export function isCellOnPath(cx: number, cy: number, tileSize: number): boolean {
  const margin = tileSize * 0.75;
  const px = cx * tileSize + tileSize / 2;
  const py = cy * tileSize + tileSize / 2;
  const pts = PATH_WAYPOINTS;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegmentDist(px, py, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y);
    if (d < margin) return true;
  }
  return false;
}

function pointSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
