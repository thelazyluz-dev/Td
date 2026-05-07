import { useEffect, useRef } from 'react';
import { Renderer, CANVAS_W, CANVAS_H, TILE } from '../game/engine/Renderer';
import { useGameStore } from '../store/gameStore';
import { isCellOnPath } from '../game/engine/PathManager';
import type { GameState } from '../game/engine/GameEngine';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<Renderer | null>(null);
  const stateRef     = useRef<GameState | null>(null);

  const { state, placeTower, selectedTower } = useGameStore();
  stateRef.current = state ?? null;

  // Init PixiJS once + own RAF loop
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current);

    let rafId: number;
    let lastTs = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;
      if (stateRef.current) renderer.update(stateRef.current, dt);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => { cancelAnimationFrame(rafId); renderer.destroy(); rendererRef.current = null; };
  }, []);

  // Convert any client {x,y} → game grid cell.
  // getBoundingClientRect already reflects CSS scale applied by parent,
  // so normalizing by rect dimensions always yields correct game coords.
  const toGameCell = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const gameX = ((clientX - rect.left) / rect.width)  * CANVAS_W;
    const gameY = ((clientY - rect.top)  / rect.height) * CANVAS_H;
    return { col: Math.floor(gameX / TILE), row: Math.floor(gameY / TILE) };
  };

  const tryPlace = (clientX: number, clientY: number) => {
    if (!state || state.phase !== 'build' || !selectedTower) return;
    const { col, row } = toGameCell(clientX, clientY);
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  };

  const handleClick = (e: React.MouseEvent) => tryPlace(e.clientX, e.clientY);

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault(); // prevent ghost click + scroll
    const t = e.changedTouches[0];
    if (t) tryPlace(t.clientX, t.clientY);
  };

  const canPlace = selectedTower && state?.phase === 'build';

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        cursor: canPlace ? 'crosshair' : 'default',
        touchAction: 'none',   // prevent browser scroll/zoom on touch
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
}
