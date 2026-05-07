import { create } from 'zustand';
import { GameEngine, type GameState } from '../game/engine/GameEngine';
import { BALANCE } from '../game/balance';
import type { Vec2 } from '../game/entities/types';

interface GameStore {
  engine: GameEngine | null;
  state: GameState | null;
  selectedTower: string | null;
  initEngine: (baseHp?: number, startingGold?: number) => void;
  selectTower: (type: string | null) => void;
  placeTower: (pos: Vec2) => void;
  skipBuild: () => void;
  airStrike: () => void;
  empBlast: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  state: null,
  selectedTower: null,

  initEngine(baseHp = BALANCE.BASE_HP, startingGold = BALANCE.STARTING_GOLD) {
    const prev = get().engine;
    if (prev) prev.stop();

    const engine = new GameEngine(baseHp, startingGold);
    const unsub = engine.onStateChange((s) => set({ state: { ...s } }));
    // store unsub for cleanup
    (engine as any)._unsub = unsub;
    engine.start();
    set({ engine, state: engine.getState(), selectedTower: null });
  },

  selectTower(type) {
    set({ selectedTower: type });
  },

  placeTower(pos) {
    const { engine, selectedTower } = get();
    if (!engine || !selectedTower) return;
    engine.placeTower(selectedTower, pos);
  },

  skipBuild() {
    get().engine?.skipBuild();
  },

  airStrike() {
    get().engine?.airStrike();
  },

  empBlast() {
    get().engine?.empBlast();
  },

  resetGame() {
    const { engine } = get();
    if (engine) {
      engine.stop();
      (engine as any)._unsub?.();
    }
    set({ engine: null, state: null, selectedTower: null });
  },
}));
