import type { Vec2 } from '../entities/types';

// Hardcoded path for Milestone 1: 10 waypoints across an 800x500 canvas
export const PATH_WAYPOINTS: Vec2[] = [
  { x: 0, y: 120 },
  { x: 160, y: 120 },
  { x: 160, y: 280 },
  { x: 320, y: 280 },
  { x: 320, y: 120 },
  { x: 480, y: 120 },
  { x: 480, y: 360 },
  { x: 640, y: 360 },
  { x: 640, y: 200 },
  { x: 800, y: 200 },
];

/** Total path length in pixels */
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

export const PATH_SEGMENTS = computeSegments(PATH_WAYPOINTS);
export const PATH_TOTAL_LENGTH = PATH_SEGMENTS[PATH_SEGMENTS.length - 1].cumLen;

/** Given a distance along the path, return world position */
export function positionAlongPath(dist: number): Vec2 {
  if (dist <= 0) return { ...PATH_WAYPOINTS[0] };
  let prevCum = 0;
  for (let i = 0; i < PATH_SEGMENTS.length; i++) {
    const seg = PATH_SEGMENTS[i];
    if (dist <= seg.cumLen) {
      const t = (dist - prevCum) / seg.len;
      const wp = PATH_WAYPOINTS[i];
      return { x: wp.x + seg.dx * t, y: wp.y + seg.dy * t };
    }
    prevCum = seg.cumLen;
  }
  return { ...PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1] };
}

/** Check if a grid cell (col, row) at tile size is too close to the path */
export function isCellOnPath(cx: number, cy: number, tileSize: number): boolean {
  const margin = tileSize * 0.75;
  const px = cx * tileSize + tileSize / 2;
  const py = cy * tileSize + tileSize / 2;
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const ax = PATH_WAYPOINTS[i].x;
    const ay = PATH_WAYPOINTS[i].y;
    const bx = PATH_WAYPOINTS[i + 1].x;
    const by = PATH_WAYPOINTS[i + 1].y;
    const d = pointSegmentDist(px, py, ax, ay, bx, by);
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
