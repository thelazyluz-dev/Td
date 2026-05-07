import { useEffect, useRef } from 'react';
import { Renderer, CANVAS_W, CANVAS_H, TILE } from '../game/engine/Renderer';
import { useGameStore } from '../store/gameStore';
import { isCellOnPath } from '../game/engine/PathManager';
import { useGameEvents } from '../utils/useGameEvents';
import type { GameState } from '../game/engine/GameEngine';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<Renderer | null>(null);
  const stateRef     = useRef<GameState | null>(null);

  const { state, placeTower, selectedTower } = useGameStore();
  stateRef.current = state ?? null;

  // Sound + shake + wave banner driven by state diffs
  useGameEvents(rendererRef);

  // Init PixiJS + own RAF loop (decoupled from React)
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

  // Convert screen coords → game cell, works at any CSS scale
  const toGameCell = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const gx = ((clientX - rect.left) / rect.width)  * CANVAS_W;
    const gy = ((clientY - rect.top)  / rect.height) * CANVAS_H;
    return { col: Math.floor(gx / TILE), row: Math.floor(gy / TILE) };
  };

  const tryPlace = (clientX: number, clientY: number) => {
    if (!state || state.phase !== 'build' || !selectedTower) return;
    const { col, row } = toGameCell(clientX, clientY);
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  };

  return (
    <div
      ref={containerRef}
      onClick={e => tryPlace(e.clientX, e.clientY)}
      onTouchEnd={e => { e.preventDefault(); const t = e.changedTouches[0]; if (t) tryPlace(t.clientX, t.clientY); }}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        cursor: (selectedTower && state?.phase === 'build') ? 'crosshair' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
}
