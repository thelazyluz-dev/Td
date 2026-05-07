import { useEffect, useRef } from 'react';
import { Renderer, CANVAS_W, CANVAS_H, TILE } from '../game/engine/Renderer';
import { useGameStore } from '../store/gameStore';
import { isCellOnPath } from '../game/engine/PathManager';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const { state, placeTower, selectedTower } = useGameStore();

  // Init PixiJS renderer once
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current);
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Re-render on state changes
  useEffect(() => {
    if (state && rendererRef.current) {
      rendererRef.current.render(state);
    }
  }, [state]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state || state.phase !== 'build' || !selectedTower) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Snap to grid
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);

    if (isCellOnPath(col, row, TILE)) return; // can't place on path

    const centerX = col * TILE + TILE / 2;
    const centerY = row * TILE + TILE / 2;
    placeTower({ x: centerX, y: centerY });
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ width: CANVAS_W, height: CANVAS_H, cursor: selectedTower && state?.phase === 'build' ? 'crosshair' : 'default' }}
      className="relative"
    />
  );
}
