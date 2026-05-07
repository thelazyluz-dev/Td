import { create } from 'zustand';
import { GameEngine, type GameState } from '../game/engine/GameEngine';
import { BALANCE } from '../game/balance';
import type { Vec2 } from '../game/entities/types';

interface GameStore {
  engine: GameEngine | null;
  state: GameState | null;
  selectedTower: string | null;
  selectedUpgradeTowerId: number | null;
  initEngine: (baseHp?: number, startingGold?: number) => void;
  selectTower: (type: string | null) => void;
  placeTower: (pos: Vec2) => void;
  skipBuild: () => void;
  sendNextWave: () => void;
  airStrike: () => void;
  empBlast: () => void;
  resetGame: () => void;
  selectForUpgrade: (id: number | null) => void;
  upgradeTower: (id: number) => void;
  sellTower: (id: number) => void;
  setSpeed: (mult: number) => void;
  togglePause: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  state: null,
  selectedTower: null,
  selectedUpgradeTowerId: null,

  initEngine(baseHp = BALANCE.BASE_HP, startingGold = BALANCE.STARTING_GOLD) {
    const prev = get().engine;
    if (prev) prev.stop();

    const engine = new GameEngine(baseHp, startingGold);
    const unsub = engine.onStateChange((s) => set({ state: { ...s } }));
    // store unsub for cleanup
    (engine as any)._unsub = unsub;
    engine.start();
    set({ engine, state: engine.getState(), selectedTower: null, selectedUpgradeTowerId: null });
  },

  selectTower(type) {
    set({ selectedTower: type, selectedUpgradeTowerId: null });
  },

  placeTower(pos) {
    const { engine, selectedTower } = get();
    if (!engine || !selectedTower) return;
    engine.placeTower(selectedTower, pos);
  },

  skipBuild() {
    get().engine?.skipBuild();
  },

  sendNextWave() {
    get().engine?.sendNextWave();
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
    set({ engine: null, state: null, selectedTower: null, selectedUpgradeTowerId: null });
  },

  selectForUpgrade(id) {
    set({ selectedUpgradeTowerId: id, selectedTower: null });
  },

  upgradeTower(id) {
    const { engine } = get();
    if (!engine) return;
    engine.upgradeTower(id);
  },

  sellTower(id) {
    const { engine } = get();
    if (!engine) return;
    engine.sellTower(id);
    set({ selectedUpgradeTowerId: null });
  },

  setSpeed(mult) {
    get().engine?.setSpeed(mult);
  },

  togglePause() {
    get().engine?.togglePause();
  },
}));
