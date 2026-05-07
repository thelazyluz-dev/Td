import { useEffect, useRef } from 'react';
import type { GameState } from '../game/engine/GameEngine';
import { soundManager } from '../game/audio/SoundManager';

export function useSoundEffects(state: GameState | null) {
  const prevState = useRef<GameState | null>(null);

  useEffect(() => {
    if (!state) { prevState.current = null; return; }
    const prev = prevState.current;

    if (prev) {
      // Base hit
      if (state.baseHp < prev.baseHp) soundManager.baseHit();

      // Wave clear (wave phase → build phase)
      if (prev.phase === 'wave' && state.phase === 'build') {
        if (state.lastPerfectBonus > 0) soundManager.perfectBonus();
        else soundManager.waveClear();
      }

      // Build countdown beeps (last 3 seconds)
      if (state.phase === 'build' && prev.phase === 'build') {
        const prevCeil = Math.ceil(prev.buildTimeLeft);
        const curCeil = Math.ceil(state.buildTimeLeft);
        if (curCeil !== prevCeil && curCeil <= 3 && curCeil > 0) soundManager.buildCountdown();
      }

      // Wave start
      if (prev.phase === 'build' && state.phase === 'wave') soundManager.waveStart();
    }

    prevState.current = state;
  }, [state]);
}
