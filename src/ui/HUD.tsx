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

// Tower accent colors (CSS hex strings matching TC in Renderer)
const TOWER_COLORS: Record<string, string> = {
  Rifleman:    '#44aaff',
  Shotgunner:  '#ff7722',
  Sniper:      '#22ffee',
  MachineGun:  '#ff3344',
  Flamethrower:'#ff9900',
  Mortar:      '#8899cc',
  BarbedWire:  '#eecc22',
  Watchtower:  '#44ee88',
};

export function HUD() {
  const {
    state, selectedTower, selectedUpgradeTowerId,
    selectTower, skipBuild, airStrike, empBlast,
    selectForUpgrade, upgradeTower,
  } = useGameStore();
  if (!state) return null;

  const inBuild = state.phase === 'build';
  const inWave  = state.phase === 'wave';
  const hpPct   = state.baseHp / state.baseMaxHp;
  const hpColor = hpPct > 0.6 ? '#ff4444' : hpPct > 0.3 ? '#fbbf24' : '#ff2020';

  // Find the selected upgrade tower
  const upgradeTowerData = selectedUpgradeTowerId != null
    ? state.towers.find(t => t.id === selectedUpgradeTowerId)
    : null;

  return (
    <>
      <div
        className="absolute inset-x-0 top-0 flex flex-col pointer-events-none select-none"
        style={{ WebkitUserSelect: 'none' }}
      >
        {/* ── Top bar ── */}
        <div
          className="flex items-center justify-between px-3 py-2 pointer-events-auto"
          style={{
            background: 'rgba(0,20,0,0.82)',
            borderBottom: '2px solid rgba(80,200,80,0.2)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span style={{ color: hpColor, fontSize: 18, lineHeight: 1 }}>♥</span>
              <span style={{ color: hpColor, fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>
                {state.baseHp}
                <span style={{ color: 'rgba(255,100,100,0.4)', fontSize: 12 }}>/{state.baseMaxHp}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#ffd700', fontSize: 15 }}>$</span>
              <span style={{ color: '#ffe066', fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{state.gold}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#66aaff', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Wave</span>
              <span style={{ color: '#88ccff', fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>
                {state.wave}
                <span style={{ color: 'rgba(100,160,255,0.4)', fontSize: 12 }}>/10</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {inBuild && (
              <span className="flex items-center gap-1" style={{ color: '#44ee88', fontWeight: 600, fontSize: 11 }}>
                <span style={{
                  display: 'inline-block',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: '#44ee88',
                  animation: 'pulse 1s infinite',
                }} />
                Build {Math.ceil(state.buildTimeLeft)}s
              </span>
            )}
            {inWave && (
              <span className="flex items-center gap-1" style={{ color: '#ff9944', fontWeight: 600, fontSize: 11 }}>
                <span style={{
                  display: 'inline-block',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: '#ff9944',
                  animation: 'ping 1s infinite',
                }} />
                Active
              </span>
            )}

            {inBuild && (
              <button
                onPointerDown={() => skipBuild()}
                style={{
                  background: 'rgba(60,180,80,0.2)',
                  border: '1px solid rgba(80,220,80,0.3)',
                  color: '#88ee88',
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '4px 10px',
                  minHeight: 32,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Skip →
              </button>
            )}
            {state.airStrikeCharges > 0 && (
              <button
                onPointerDown={airStrike}
                style={{
                  background: 'rgba(180,40,20,0.7)',
                  border: '1px solid #cc4422',
                  color: '#ffaaaa',
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '4px 10px',
                  minHeight: 32,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ✈ Strike ({state.airStrikeCharges})
              </button>
            )}
            {state.empCharges > 0 && (
              <button
                onPointerDown={empBlast}
                style={{
                  background: 'rgba(20,60,200,0.7)',
                  border: '1px solid #4466cc',
                  color: '#aabbff',
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '4px 10px',
                  minHeight: 32,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                ⚡ EMP ({state.empCharges})
              </button>
            )}
          </div>
        </div>

        {/* ── Tower shop ── */}
        {inBuild && (
          <div
            className="flex gap-1.5 px-2 py-1.5 overflow-x-auto pointer-events-auto"
            style={{
              background: 'rgba(0,15,0,0.80)',
              borderBottom: '2px solid rgba(80,200,80,0.15)',
              backdropFilter: 'blur(4px)',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {Object.values(TOWER_DEFS).map((def) => {
              const sel       = selectedTower === def.type;
              const canAfford = state.gold >= def.cost;
              const accentColor = TOWER_COLORS[def.type] ?? '#aaaaaa';
              return (
                <button
                  key={def.type}
                  disabled={!canAfford}
                  onPointerDown={() => selectTower(sel ? null : def.type)}
                  style={{
                    flexShrink: 0,
                    minWidth: 66,
                    minHeight: 60,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: `1px solid ${sel ? '#ffd700' : 'rgba(255,255,255,0.12)'}`,
                    borderLeft: `3px solid ${accentColor}`,
                    background: sel
                      ? `rgba(${hexToRgb(accentColor)},0.22)`
                      : canAfford
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.02)',
                    opacity: canAfford ? 1 : 0.35,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: sel ? `0 0 12px ${accentColor}44` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{TOWER_ICONS[def.type] ?? '🗼'}</span>
                  <span style={{ color: '#e5e7eb', fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{def.type}</span>
                  <span style={{ color: canAfford ? '#ffd700' : '#888', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>${def.cost}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, lineHeight: 1 }}>{TOWER_DESC[def.type]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upgrade bottom sheet ── */}
      {upgradeTowerData && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 440,
            background: 'rgba(0,18,0,0.96)',
            borderTop: '2px solid rgba(80,220,80,0.35)',
            borderLeft: '1px solid rgba(80,220,80,0.15)',
            borderRight: '1px solid rgba(80,220,80,0.15)',
            borderRadius: '16px 16px 0 0',
            padding: '16px 20px 20px',
            zIndex: 20,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{TOWER_ICONS[upgradeTowerData.type] ?? '🗼'}</span>
              <div>
                <div style={{ color: '#e0ffe0', fontWeight: 700, fontSize: 15 }}>{upgradeTowerData.type}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ fontSize: 12, color: i < upgradeTowerData.upgrades ? '#ffd700' : 'rgba(255,255,255,0.2)' }}>
                      {i < upgradeTowerData.upgrades ? '●' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onPointerDown={() => selectForUpgrade(null)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Close
            </button>
          </div>

          {/* Current stats */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {(() => {
              const def = TOWER_DEFS[upgradeTowerData.type];
              if (!def) return null;
              const dps = def.dps > 0
                ? Math.round(def.dps * upgradeTowerData.damageMultiplier * upgradeTowerData.fireRateMultiplier * 10) / 10
                : 0;
              const range = Math.round(def.range * upgradeTowerData.rangeMultiplier);
              return (
                <>
                  <Stat label="DPS" value={dps > 0 ? String(dps) : '—'} color="#ff9944" />
                  <Stat label="Range" value={range > 0 ? String(range) : '—'} color="#44ccff" />
                  <Stat label="Level" value={`${upgradeTowerData.upgrades} / 3`} color="#ffd700" />
                </>
              );
            })()}
          </div>

          {/* Next level info */}
          {upgradeTowerData.upgrades < 3 ? (
            <div style={{
              background: 'rgba(80,200,80,0.08)',
              border: '1px solid rgba(80,200,80,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: 11,
              color: 'rgba(200,255,200,0.7)',
            }}>
              <span style={{ color: '#88ee88', fontWeight: 700 }}>Next level gives: </span>
              +50% DPS &nbsp;·&nbsp; +10% Range &nbsp;·&nbsp; +20% Fire Rate
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,200,0,0.08)',
              border: '1px solid rgba(255,200,0,0.25)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 12,
              fontSize: 11,
              color: '#ffd700',
              textAlign: 'center',
              fontWeight: 700,
            }}>
              ★ Fully Upgraded ★
            </div>
          )}

          {/* Upgrade button */}
          {upgradeTowerData.upgrades < 3 && (() => {
            const cost = upgradeTowerData.upgradeCost;
            const canAfford = state.gold >= cost;
            return (
              <button
                disabled={!canAfford}
                onPointerDown={() => {
                  if (canAfford) {
                    upgradeTower(upgradeTowerData.id);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: 10,
                  border: `2px solid ${canAfford ? '#ffd700' : 'rgba(255,255,255,0.1)'}`,
                  background: canAfford
                    ? 'linear-gradient(135deg, rgba(180,130,0,0.5), rgba(120,80,0,0.5))'
                    : 'rgba(255,255,255,0.04)',
                  color: canAfford ? '#ffd700' : 'rgba(255,255,255,0.25)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: canAfford ? '0 0 16px rgba(255,200,0,0.2)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {canAfford ? `⬆ Upgrade — $${cost}` : `Need $${cost} (have $${state.gold})`}
              </button>
            );
          })()}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ color, fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

/** Convert CSS hex color like '#ff7722' to 'r,g,b' string for rgba() usage */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
