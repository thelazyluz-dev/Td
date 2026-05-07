import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useGameStore } from '../store/gameStore';
import { audioManager } from '../audio/AudioManager';
import type { Renderer } from '../game/engine/Renderer';
import type { GameState } from '../game/engine/GameEngine';

/** Watches state diffs and fires sounds + renderer effects (shake, banner). */
export function useGameEvents(rendererRef: RefObject<Renderer | null>) {
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    return useGameStore.subscribe((store) => {
      const state = store.state;
      const prev  = prevRef.current;
      const rend  = rendererRef.current;

      if (!state) { prevRef.current = null; return; }

      if (prev) {
        // ── Wave transition ──────────────────────────────────────────────
        if (state.phase === 'wave' && prev.phase === 'build') {
          audioManager.waveStart(state.wave);
          rend?.showWaveBanner(state.wave);
        }

        // ── New projectile (tower fired) ─────────────────────────────────
        const prevProjIds = new Set(prev.projectiles.map(p => p.id));
        for (const proj of state.projectiles) {
          if (!prevProjIds.has(proj.id)) {
            const tower = state.towers.find(t => t.id === proj.towerId);
            if (tower) audioManager.shoot(tower.type);
          }
        }

        // ── Enemy died ───────────────────────────────────────────────────
        const prevAlive = new Set(prev.enemies.filter(e => !e.isDead).map(e => e.id));
        for (const en of state.enemies) {
          if (en.isDead && prevAlive.has(en.id)) {
            audioManager.enemyDeath(en.type);
            if (en.type === 'Alpha' || en.type === 'PatientZero') rend?.shake(7, 0.4);
          }
        }

        // ── Boss spawned ─────────────────────────────────────────────────
        const prevEnemyIds = new Set(prev.enemies.map(e => e.id));
        for (const en of state.enemies) {
          if (!prevEnemyIds.has(en.id) && (en.type === 'Alpha' || en.type === 'PatientZero')) {
            audioManager.bossSpawn();
            rend?.shake(12, 0.7);
          }
        }

        // ── Base took damage ─────────────────────────────────────────────
        if (state.baseHp < prev.baseHp) {
          audioManager.baseHit();
          rend?.shake(5, 0.3);
        }

        // ── Tower placed ─────────────────────────────────────────────────
        if (state.towers.length > prev.towers.length) {
          audioManager.towerPlaced();
        }

        // ── Phase end ────────────────────────────────────────────────────
        if (state.phase === 'gameover' && prev.phase !== 'gameover') audioManager.gameOver();
        if (state.phase === 'win'      && prev.phase !== 'win')      audioManager.win();
      }

      prevRef.current = state;
    });
  }, [rendererRef]);
}
