import { useGameStore } from '../store/gameStore';

export function GameOver() {
  const { state, initEngine, resetGame } = useGameStore();
  if (!state) return null;
  if (state.phase !== 'gameover' && state.phase !== 'win') return null;

  const isWin = state.phase === 'win';

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
         style={{ background: isWin ? 'rgba(0,20,0,0.88)' : 'rgba(20,0,0,0.88)' }}>
      <div className={`
        flex flex-col items-center gap-6 p-10 rounded-2xl
        border shadow-2xl backdrop-blur-md
        ${isWin
          ? 'border-emerald-800 bg-emerald-950/60 shadow-emerald-900/40'
          : 'border-red-900 bg-red-950/60 shadow-red-900/40'
        }
      `}>
        {/* Icon */}
        <div className="text-6xl">{isWin ? '🏆' : '☠️'}</div>

        {/* Title */}
        <div className="text-center">
          <h1 className={`text-5xl font-black tracking-tight ${isWin ? 'text-emerald-300' : 'text-red-400'}`}>
            {isWin ? 'SURVIVED' : 'OVERRUN'}
          </h1>
          <p className="text-white/50 mt-2 text-sm">
            {isWin
              ? 'All 10 waves defeated. The last stand holds.'
              : `The horde broke through on wave ${state.wave}.`}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-6 px-6 py-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-center">
            <p className="text-white/40 text-xs uppercase tracking-wider">Waves</p>
            <p className="text-white font-bold text-xl">{state.wave}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-white/40 text-xs uppercase tracking-wider">Base HP</p>
            <p className="text-white font-bold text-xl">{state.baseHp}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-white/40 text-xs uppercase tracking-wider">Gold</p>
            <p className="text-amber-400 font-bold text-xl">{state.gold}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => initEngine()}
            className={`
              flex-1 py-3 rounded-xl font-bold text-sm transition-all
              ${isWin
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'bg-red-700 hover:bg-red-600 text-white'
              }
            `}
          >
            Play Again
          </button>
          <button
            onClick={resetGame}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
