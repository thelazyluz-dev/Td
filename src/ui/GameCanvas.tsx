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

  const { state, placeTower, selectedTower, selectedUpgradeTowerId, selectForUpgrade } = useGameStore();
  stateRef.current = state ?? null;

  // Keep refs so callbacks in PixiJS closures always see latest values
  const selectForUpgradeRef = useRef(selectForUpgrade);
  selectForUpgradeRef.current = selectForUpgrade;
  const selectedTowerRef = useRef(selectedTower);
  selectedTowerRef.current = selectedTower;

  // Sound + shake + wave banner driven by state diffs
  useGameEvents(rendererRef);

  // Init PixiJS + own RAF loop (decoupled from React)
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current).then(() => {
      // Wire PixiJS tower interaction after init completes
      renderer.setTowerTapHandler((id) => selectForUpgradeRef.current(id));
      renderer.setEmptyTapHandler(() => selectForUpgradeRef.current(null));
    });

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

  // Sync selected tower highlight ring
  useEffect(() => {
    rendererRef.current?.setSelectedTower(selectedUpgradeTowerId ?? null);
  }, [selectedUpgradeTowerId]);

  // Sync placement mode so PixiJS stage tap doesn't deselect while placing
  useEffect(() => {
    rendererRef.current?.setPlacementMode(selectedTower !== null);
  }, [selectedTower]);

  // handleClick only handles tower placement — tower selection is via PixiJS
  const handleClick = (clientX: number, clientY: number) => {
    if (!selectedTowerRef.current) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const currentState = stateRef.current;
    if (!currentState) return;
    if (currentState.phase !== 'build' && currentState.phase !== 'wave') return;

    const { x, y } = renderer.toGameCoords(clientX, clientY);
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
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
        cursor: selectedTower ? 'crosshair' : 'default',
      }}
    />
  );
}
