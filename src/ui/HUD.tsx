import { useGameStore } from '../store/gameStore';
import { TOWER_DEFS } from '../game/data/towers';

const TOWER_ICONS: Record<string, string> = {
  Rifleman:    '🔫',
  Shotgunner:  '💥',
  Sniper:      '🎯',
  MachineGun:  '⚡',
  Flamethrower:'🔥',
  Mortar:      '💣',
  BarbedWire:  '🪝',
  Watchtower:  '👁',
};

const TOWER_DESC: Record<string, string> = {
  Rifleman:    '15dps·150r',
  Shotgunner:  '25dps·90r',
  Sniper:      '45dps·300r',
  MachineGun:  '30dps·130r',
  Flamethrower:'8dps·DoT',
  Mortar:      '60dps·AoE',
  BarbedWire:  'slow·40r',
  Watchtower:  'reveal+rng',
};

export function HUD() {
  const { state, selectedTower, selectTower, skipBuild, airStrike, empBlast } = useGameStore();
  if (!state) return null;

  const inBuild = state.phase === 'build';
  const inWave  = state.phase === 'wave';
  const hpPct   = state.baseHp / state.baseMaxHp;
  const hpColor = hpPct > 0.6 ? 'text-emerald-400' : hpPct > 0.3 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="absolute inset-x-0 top-0 flex flex-col pointer-events-none select-none">

      {/* ── Top status bar ── */}
      <div className="flex items-center justify-between bg-black/80 backdrop-blur-sm border-b border-white/5 px-4 py-2 pointer-events-auto">

        {/* Stats */}
        <div className="flex items-center gap-5">
          {/* HP */}
          <div className="flex items-center gap-1.5">
            <span className={`font-bold text-sm ${hpColor}`}>♥</span>
            <span className="text-white font-mono text-sm font-semibold">
              {state.baseHp}<span className="text-white/30">/{state.baseMaxHp}</span>
            </span>
          </div>

          {/* Gold */}
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-bold text-sm">$</span>
            <span className="text-amber-100 font-mono text-sm font-semibold">{state.gold}</span>
          </div>

          {/* Wave */}
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Wave</span>
            <span className="text-white font-mono text-sm font-semibold">
              {state.wave}<span className="text-white/30">/10</span>
            </span>
          </div>
        </div>

        {/* Phase indicator + actions */}
        <div className="flex items-center gap-2">
          {inBuild && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Build {Math.ceil(state.buildTimeLeft)}s
            </div>
          )}
          {inWave && (
            <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              Wave Active
            </div>
          )}

          {inBuild && (
            <button
              onClick={skipBuild}
              className="ml-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs px-3 py-1 rounded transition-all"
            >
              Skip →
            </button>
          )}
          {state.airStrikeCharges > 0 && (
            <button onClick={airStrike}
              className="bg-red-900/80 hover:bg-red-800 border border-red-700 text-red-200 text-xs px-3 py-1 rounded transition-all">
              ✈ Strike ({state.airStrikeCharges})
            </button>
          )}
          {state.empCharges > 0 && (
            <button onClick={empBlast}
              className="bg-blue-900/80 hover:bg-blue-800 border border-blue-700 text-blue-200 text-xs px-3 py-1 rounded transition-all">
              ⚡ EMP ({state.empCharges})
            </button>
          )}
        </div>
      </div>

      {/* ── Tower shop (build phase only) ── */}
      {inBuild && (
        <div className="flex gap-1.5 px-3 py-2 bg-black/70 backdrop-blur-sm border-b border-white/5 overflow-x-auto pointer-events-auto">
          {Object.values(TOWER_DEFS).map((def) => {
            const selected  = selectedTower === def.type;
            const canAfford = state.gold >= def.cost;
            return (
              <button
                key={def.type}
                disabled={!canAfford}
                onClick={() => selectTower(selected ? null : def.type)}
                className={`
                  flex-shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-md text-xs
                  border transition-all duration-100
                  ${selected
                    ? 'border-amber-400 bg-amber-900/40 text-amber-100 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                    : canAfford
                      ? 'border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10'
                      : 'border-white/5 bg-white/[0.02] text-white/25 cursor-not-allowed'
                  }
                `}
              >
                <span className="text-base leading-none">{TOWER_ICONS[def.type] ?? '🗼'}</span>
                <span className="font-semibold leading-none">{def.type}</span>
                <span className={`leading-none ${canAfford ? 'text-amber-400' : 'text-white/25'}`}>${def.cost}</span>
                <span className="text-white/30 leading-none" style={{ fontSize: 9 }}>{TOWER_DESC[def.type]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
