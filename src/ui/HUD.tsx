import { useGameStore } from '../store/gameStore';
import { TOWER_DEFS } from '../game/data/towers';

export function HUD() {
  const { state, selectedTower, selectTower, skipBuild, airStrike, empBlast } = useGameStore();
  if (!state) return null;

  const phase = state.phase;
  const inBuild = phase === 'build';

  return (
    <div className="absolute inset-x-0 top-0 flex flex-col pointer-events-none">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-black/70 px-4 py-2 text-white text-sm pointer-events-auto">
        <div className="flex gap-6">
          <span>
            <span className="text-red-400 font-bold">HP</span> {state.baseHp}/{state.baseMaxHp}
          </span>
          <span>
            <span className="text-yellow-400 font-bold">$</span> {state.gold}
          </span>
          <span>
            <span className="text-blue-300 font-bold">Wave</span> {state.wave}/10
          </span>
        </div>
        <div className="flex gap-2 items-center">
          {phase === 'build' && (
            <span className="text-green-400">
              Build: {Math.ceil(state.buildTimeLeft)}s
            </span>
          )}
          {phase === 'wave' && <span className="text-orange-400 animate-pulse">WAVE ACTIVE</span>}
          {inBuild && (
            <button
              className="ml-4 bg-orange-700 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded"
              onClick={skipBuild}
            >
              Skip Build
            </button>
          )}
          {state.airStrikeCharges > 0 && (
            <button
              className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
              onClick={airStrike}
            >
              Air Strike ({state.airStrikeCharges})
            </button>
          )}
          {state.empCharges > 0 && (
            <button
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
              onClick={empBlast}
            >
              EMP ({state.empCharges})
            </button>
          )}
        </div>
      </div>

      {/* Tower shop - only show during build */}
      {inBuild && (
        <div className="flex gap-2 p-2 bg-black/60 pointer-events-auto overflow-x-auto">
          {Object.values(TOWER_DEFS).map((def) => (
            <button
              key={def.type}
              onClick={() => selectTower(selectedTower === def.type ? null : def.type)}
              className={`flex flex-col items-center px-3 py-1 rounded text-xs border transition-colors ${
                selectedTower === def.type
                  ? 'border-yellow-400 bg-yellow-900/60 text-yellow-200'
                  : 'border-gray-600 bg-gray-800/60 text-gray-200 hover:border-gray-400'
              } ${state.gold < def.cost ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={state.gold < def.cost}
            >
              <span className="font-bold">{def.type}</span>
              <span className="text-yellow-400">${def.cost}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
