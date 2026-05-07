import { useEffect, useRef } from 'react';
import { Renderer, TILE } from '../game/engine/Renderer';
import { useGameStore } from '../store/gameStore';
import { isCellOnPath } from '../game/engine/PathManager';
import { useGameEvents } from '../utils/useGameEvents';
import type { GameState } from '../game/engine/GameEngine';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<Renderer | null>(null);
  const stateRef     = useRef<GameState | null>(null);

  const { state, placeTower, selectedTower, selectForUpgrade } = useGameStore();
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

  const handleClick = (clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const currentState = stateRef.current;
    if (!currentState || currentState.phase !== 'build') return;

    const { x, y } = renderer.toGameCoords(clientX, clientY);

    if (selectedTower) {
      // Place tower mode
      const col = Math.floor(x / TILE);
      const row = Math.floor(y / TILE);
      if (isCellOnPath(col, row, TILE)) return;
      placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
    } else {
      // Check if clicking on an existing tower for upgrade
      const clickRadius = TILE * 0.5;
      let found = false;
      for (const tower of currentState.towers) {
        const dx = x - tower.pos.x;
        const dy = y - tower.pos.y;
        if (Math.hypot(dx, dy) <= clickRadius) {
          selectForUpgrade(tower.id);
          found = true;
          break;
        }
      }
      if (!found) {
        // Clicked empty space — deselect upgrade panel
        selectForUpgrade(null);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={e => handleClick(e.clientX, e.clientY)}
      onTouchEnd={e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (t) handleClick(t.clientX, t.clientY);
      }}
      style={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: (selectedTower && state?.phase === 'build') ? 'crosshair' : 'default',
      }}
    />
  );
}
