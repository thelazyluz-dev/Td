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
  Rifleman:    '15dps 150r',
  Shotgunner:  '25dps 90r',
  Sniper:      '45dps 300r',
  MachineGun:  '30dps 130r',
  Flamethrower:'8dps DoT',
  Mortar:      '60dps AoE',
  BarbedWire:  'slow',
  Watchtower:  '+range',
};

export function HUD() {
  const { state, selectedTower, selectTower, skipBuild, airStrike, empBlast } = useGameStore();
  if (!state) return null;

  const inBuild = state.phase === 'build';
  const inWave  = state.phase === 'wave';
  const hpPct   = state.baseHp / state.baseMaxHp;
  const hpColor = hpPct > 0.6 ? '#34d399' : hpPct > 0.3 ? '#fbbf24' : '#f87171';

  return (
    <div
      className="absolute inset-x-0 top-0 flex flex-col pointer-events-none select-none"
      style={{ WebkitUserSelect: 'none' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between bg-black/85 border-b border-white/5 px-3 py-2 pointer-events-auto"
           style={{ backdropFilter: 'blur(6px)' }}>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span style={{ color: hpColor, fontSize: 15 }}>♥</span>
            <span className="text-white font-mono font-bold" style={{ fontSize: 14 }}>
              {state.baseHp}<span className="text-white/30" style={{ fontSize: 12 }}>/{state.baseMaxHp}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-amber-400 font-bold" style={{ fontSize: 14 }}>$</span>
            <span className="text-amber-100 font-mono font-bold" style={{ fontSize: 14 }}>{state.gold}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-400 font-bold uppercase" style={{ fontSize: 10, letterSpacing: '0.1em' }}>Wave</span>
            <span className="text-white font-mono font-bold" style={{ fontSize: 14 }}>
              {state.wave}<span className="text-white/30" style={{ fontSize: 12 }}>/10</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {inBuild && (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold" style={{ fontSize: 11 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Build {Math.ceil(state.buildTimeLeft)}s
            </span>
          )}
          {inWave && (
            <span className="flex items-center gap-1 text-orange-400 font-semibold" style={{ fontSize: 11 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping inline-block" />
              Active
            </span>
          )}

          {inBuild && (
            <button
              onPointerDown={() => skipBuild()}
              className="bg-white/5 active:bg-white/15 border border-white/10 text-white/60 rounded"
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 32, WebkitTapHighlightColor: 'transparent' }}
            >
              Skip →
            </button>
          )}
          {state.airStrikeCharges > 0 && (
            <button
              onPointerDown={airStrike}
              className="bg-red-900/80 active:bg-red-700 border border-red-700 text-red-200 rounded"
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 32, WebkitTapHighlightColor: 'transparent' }}
            >
              ✈ Strike ({state.airStrikeCharges})
            </button>
          )}
          {state.empCharges > 0 && (
            <button
              onPointerDown={empBlast}
              className="bg-blue-900/80 active:bg-blue-700 border border-blue-700 text-blue-200 rounded"
              style={{ fontSize: 11, padding: '4px 10px', minHeight: 32, WebkitTapHighlightColor: 'transparent' }}
            >
              ⚡ EMP ({state.empCharges})
            </button>
          )}
        </div>
      </div>

      {/* ── Tower shop ── */}
      {inBuild && (
        <div
          className="flex gap-1 px-2 py-1.5 bg-black/75 border-b border-white/5 overflow-x-auto pointer-events-auto"
          style={{
            backdropFilter: 'blur(4px)',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {Object.values(TOWER_DEFS).map((def) => {
            const sel       = selectedTower === def.type;
            const canAfford = state.gold >= def.cost;
            return (
              <button
                key={def.type}
                disabled={!canAfford}
                onPointerDown={() => selectTower(sel ? null : def.type)}
                style={{
                  flexShrink: 0,
                  minWidth: 64,
                  minHeight: 58,
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: `1px solid ${sel ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`,
                  background: sel
                    ? 'rgba(120,70,0,0.45)'
                    : canAfford
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.02)',
                  opacity: canAfford ? 1 : 0.35,
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: sel ? '0 0 10px rgba(251,191,36,0.25)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{TOWER_ICONS[def.type] ?? '🗼'}</span>
                <span style={{ color: '#e5e7eb', fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>{def.type}</span>
                <span style={{ color: canAfford ? '#fbbf24' : '#888', fontSize: 10, lineHeight: 1 }}>${def.cost}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, lineHeight: 1 }}>{TOWER_DESC[def.type]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
