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

  // Stable refs so PixiJS closures always see the latest values
  const selectForUpgradeRef = useRef(selectForUpgrade);
  selectForUpgradeRef.current = selectForUpgrade;
  const selectedTowerRef = useRef(selectedTower);
  selectedTowerRef.current = selectedTower;

  // Set to true for a short window after a tower is tapped, so the DOM
  // placement handler ignores the same gesture.
  const towerJustTappedRef = useRef(false);
  const towerTapTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useGameEvents(rendererRef);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current).then(() => {
      renderer.setTowerTapHandler((id) => {
        // Block the DOM placement handler for this gesture
        towerJustTappedRef.current = true;
        if (towerTapTimerRef.current) clearTimeout(towerTapTimerRef.current);
        towerTapTimerRef.current = setTimeout(() => { towerJustTappedRef.current = false; }, 200);
        selectForUpgradeRef.current(id);
      });
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

    return () => {
      cancelAnimationFrame(rafId);
      renderer.destroy();
      rendererRef.current = null;
      if (towerTapTimerRef.current) clearTimeout(towerTapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setSelectedTower(selectedUpgradeTowerId ?? null);
  }, [selectedUpgradeTowerId]);

  useEffect(() => {
    rendererRef.current?.setPlacementMode(selectedTower !== null);
  }, [selectedTower]);

  const handlePlacement = (clientX: number, clientY: number) => {
    // Skip if a tower sprite was just tapped (same gesture would otherwise place a new tower)
    if (towerJustTappedRef.current) return;
    if (!selectedTowerRef.current) return;
    const renderer = rendererRef.current;
    const s = stateRef.current;
    if (!renderer || !s) return;
    if (s.phase !== 'build' && s.phase !== 'wave') return;
    const { x, y } = renderer.toGameCoords(clientX, clientY);
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  };

  return (
    <div
      ref={containerRef}
      onClick={e => handlePlacement(e.clientX, e.clientY)}
      onTouchEnd={e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (t) handlePlacement(t.clientX, t.clientY);
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
