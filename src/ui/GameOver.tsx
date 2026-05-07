import { useGameStore } from '../store/gameStore';

export function GameOver() {
  const { state, initEngine, resetGame } = useGameStore();
  if (!state) return null;
  if (state.phase !== 'gameover' && state.phase !== 'win') return null;

  const isWin = state.phase === 'win';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-10 flex flex-col items-center gap-6 text-white shadow-2xl">
        {isWin ? (
          <>
            <h1 className="text-4xl font-bold text-green-400">YOU SURVIVED!</h1>
            <p className="text-gray-300">All waves defeated. The last stand holds.</p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-red-400">OVERRUN</h1>
            <p className="text-gray-300">The horde broke through. Survived wave {state.wave}.</p>
          </>
        )}
        <div className="flex gap-4">
          <button
            onClick={() => initEngine()}
            className="bg-green-700 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={resetGame}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
