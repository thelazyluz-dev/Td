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

  const selectForUpgradeRef = useRef(selectForUpgrade);
  selectForUpgradeRef.current = selectForUpgrade;
  const selectedTowerRef = useRef(selectedTower);
  selectedTowerRef.current = selectedTower;

  useGameEvents(rendererRef);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new Renderer();
    rendererRef.current = renderer;
    renderer.init(containerRef.current).then(() => {
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

  useEffect(() => {
    rendererRef.current?.setSelectedTower(selectedUpgradeTowerId ?? null);
  }, [selectedUpgradeTowerId]);

  useEffect(() => {
    rendererRef.current?.setPlacementMode(selectedTower !== null);
  }, [selectedTower]);

  const handleTap = (clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const s = stateRef.current;
    if (!renderer || !s) return;
    if (s.phase !== 'build' && s.phase !== 'wave') return;

    const { x, y } = renderer.toGameCoords(clientX, clientY);
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);

    // If there is already a tower in this grid cell, open its upgrade panel
    const hit = s.towers.find(
      t => Math.floor(t.pos.x / TILE) === col && Math.floor(t.pos.y / TILE) === row
    );
    if (hit) {
      selectForUpgradeRef.current(hit.id);
      return;
    }

    // Otherwise place a new tower (only if one is selected from the shop)
    if (!selectedTowerRef.current) return;
    if (isCellOnPath(col, row, TILE)) return;
    placeTower({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  };

  return (
    <div
      ref={containerRef}
      onClick={e => handleTap(e.clientX, e.clientY)}
      onTouchEnd={e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (t) handleTap(t.clientX, t.clientY);
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
