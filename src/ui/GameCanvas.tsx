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

  // Keep stateRef current so the RAF loop always reads the latest
  stateRef.current = state ?? null;

  // Init PixiJS once
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current);

    // Own animation loop — decoupled from React renders
    let rafId: number;
    let lastTs = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;
      if (stateRef.current) renderer.update(stateRef.current, dt);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state || state.phase !== 'build' || !selectedTower) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / TILE);
    const row = Math.floor((e.clientY - rect.top)  / TILE);
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  };

  const cursor = selectedTower && state?.phase === 'build' ? 'crosshair' : 'default';

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: CANVAS_W, height: CANVAS_H, cursor }}
      className="relative rounded-sm overflow-hidden shadow-2xl"
    />
  );
}
