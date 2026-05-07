import { useGameStore } from '../store/gameStore';

export function MainMenu() {
  const { initEngine } = useGameStore();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-6xl font-black text-red-500 tracking-tight">LAST STAND</h1>
          <p className="text-gray-400 mt-2 text-lg">Tower Defense Roguelike</p>
        </div>
        <button
          onClick={() => initEngine()}
          className="bg-red-700 hover:bg-red-600 text-white font-bold text-xl px-12 py-4 rounded-xl transition-colors shadow-lg"
        >
          Start Run
        </button>
        <div className="text-gray-600 text-sm text-center max-w-xs">
          <p>Survive 10 waves of the undead.</p>
          <p>Place towers during build phase. Choose upgrades between waves.</p>
        </div>
      </div>
    </div>
  );
}
