const SAVE_KEY = 'bugoff_build_v1';

export interface SavedTower { type: string; col: number; row: number }

export function saveBuild(towers: Array<{ type: string; pos: { x: number; y: number } }>, tileSize: number): void {
  const data: SavedTower[] = towers.map(t => ({
    type: t.type,
    col: Math.floor(t.pos.x / tileSize),
    row: Math.floor(t.pos.y / tileSize),
  }));
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* quota exceeded */ }
}

export function loadSavedBuild(): SavedTower[] | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SavedTower[]) : null;
  } catch { return null; }
}

export function hasSavedBuild(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
