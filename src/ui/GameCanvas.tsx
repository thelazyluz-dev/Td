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

  // Stable refs so PixiJS closures always see the latest values without stale captures
  const selectForUpgradeRef = useRef(selectForUpgrade);
  selectForUpgradeRef.current = selectForUpgrade;
  const placeTowerRef = useRef(placeTower);
  placeTowerRef.current = placeTower;

  useGameEvents(rendererRef);

  // Init PixiJS + own RAF loop (decoupled from React)
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current).then(() => {
      // Tower sprite tap → open upgrade panel
      renderer.setTowerTapHandler((id) => selectForUpgradeRef.current(id));

      // Empty stage tap (no placement mode) → deselect
      renderer.setEmptyTapHandler(() => selectForUpgradeRef.current(null));

      // Stage tap in placement mode → place tower.
      // Because tower sprites call e.stopPropagation(), this handler is NEVER
      // reached when tapping an existing tower — eliminating the double-action bug.
      renderer.setStagePlacementHandler((gx, gy) => {
        const s = stateRef.current;
        if (!s || (s.phase !== 'build' && s.phase !== 'wave')) return;
        const col = Math.floor(gx / TILE);
        const row = Math.floor(gy / TILE);
        if (isCellOnPath(col, row, TILE)) return;
        placeTowerRef.current({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
      });
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

  // Tell renderer which mode it's in so stage tap routes correctly
  useEffect(() => {
    rendererRef.current?.setPlacementMode(selectedTower !== null);
  }, [selectedTower]);

  return (
    <div
      ref={containerRef}
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
