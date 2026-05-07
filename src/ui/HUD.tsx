import { useGameStore } from '../store/gameStore';
import { TOWER_DEFS } from '../game/data/towers';

const TOWER_ICONS: Record<string, string> = {
  BugSpray:   '🪲',
  Swatter:    '🥊',
  Zapper:     '⚡',
  Sprinkler:  '💦',
  MagGlass:   '🔆',
  PoisonBomb: '☠️',
  GlueTrap:   '🍯',
  BugLight:   '💡',
};

const TOWER_COLORS: Record<string, string> = {
  BugSpray:   '#44aaff',
  Swatter:    '#ff7722',
  Zapper:     '#ffee00',
  Sprinkler:  '#44cc88',
  MagGlass:   '#ffaa00',
  PoisonBomb: '#88cc00',
  GlueTrap:   '#ddaa00',
  BugLight:   '#ffff44',
};

export function HUD() {
  const {
    state, selectedTower, selectedUpgradeTowerId,
    selectTower, skipBuild, sendNextWave, airStrike, empBlast,
    selectForUpgrade, upgradeTower,
  } = useGameStore();
  if (!state) return null;

  const inBuild = state.phase === 'build';
  const inWave  = state.phase === 'wave';
  const showShop = inBuild || inWave;
  const hpPct   = state.baseHp / state.baseMaxHp;
  const hpColor = hpPct > 0.6 ? '#ff4444' : hpPct > 0.3 ? '#fbbf24' : '#ff2020';

  const upgradeTowerData = selectedUpgradeTowerId != null
    ? state.towers.find(t => t.id === selectedUpgradeTowerId)
    : null;

  return (
    <>
      <div
        className="flex flex-col pointer-events-none select-none"
        style={{ WebkitUserSelect: 'none', flexShrink: 0 }}
      >
        {/* ── Top bar ── */}
        <div
          className="flex items-center justify-between px-3 pointer-events-auto"
          style={{
            background: 'rgba(0,20,0,0.92)',
            borderBottom: '1px solid rgba(80,200,80,0.2)',
            backdropFilter: 'blur(6px)',
            minHeight: 38,
          }}
        >
          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span style={{ color: hpColor, fontSize: 14, lineHeight: 1 }}>♥</span>
              <span style={{ color: hpColor, fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                {state.baseHp}<span style={{ color: 'rgba(255,100,100,0.4)', fontSize: 11 }}>/{state.baseMaxHp}</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: '#ffd700', fontSize: 13 }}>$</span>
              <span style={{ color: '#ffe066', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{state.gold}</span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ color: '#66aaff', fontWeight: 700, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Wave</span>
              <span style={{ color: '#88ccff', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                {state.wave}<span style={{ color: 'rgba(100,160,255,0.4)', fontSize: 11 }}>/10</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {inBuild && (
              <span className="flex items-center gap-1" style={{ color: '#44ee88', fontWeight: 600, fontSize: 10 }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#44ee88' }} />
                בנה
              </span>
            )}
            {inWave && (
              <span className="flex items-center gap-1" style={{ color: '#ff9944', fontWeight: 600, fontSize: 10 }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#ff9944' }} />
                גל פעיל
              </span>
            )}
            {inBuild && (
              <button onPointerDown={() => skipBuild()} style={{ background: '#16a34a', border: '1px solid #22c55e', color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '4px 12px', minHeight: 28, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}>
                ▶ מוכן!
              </button>
            )}
            {inWave && state.canSendNextWave && (
              <button
                onPointerDown={() => sendNextWave()}
                style={{
                  background: 'rgba(160,100,0,0.8)',
                  border: '1px solid #cc9900',
                  color: '#ffe066',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 8px',
                  minHeight: 28,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: '0 0 8px rgba(200,150,0,0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚡ גל הבא +${state.earlyWaveBonus}
              </button>
            )}
            {state.airStrikeCharges > 0 && (
              <button onPointerDown={airStrike} style={{ background: 'rgba(180,40,20,0.7)', border: '1px solid #cc4422', color: '#ffaaaa', borderRadius: 5, fontSize: 10, padding: '3px 8px', minHeight: 26, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                ✈({state.airStrikeCharges})
              </button>
            )}
            {state.empCharges > 0 && (
              <button onPointerDown={empBlast} style={{ background: 'rgba(20,60,200,0.7)', border: '1px solid #4466cc', color: '#aabbff', borderRadius: 5, fontSize: 10, padding: '3px 8px', minHeight: 26, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                ⚡({state.empCharges})
              </button>
            )}
          </div>
        </div>

        {/* ── Tower shop (build + wave) ── */}
        {showShop && (
          <div
            className="flex gap-1 px-1.5 py-1 overflow-x-auto pointer-events-auto"
            style={{
              background: 'rgba(0,15,0,0.88)',
              borderBottom: '1px solid rgba(80,200,80,0.15)',
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
                    minWidth: 58,
                    minHeight: 48,
                    padding: '3px 6px',
                    borderRadius: 7,
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
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{TOWER_ICONS[def.type] ?? '🗼'}</span>
                  <span style={{ color: '#e5e7eb', fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>{def.type}</span>
                  <span style={{ color: canAfford ? '#ffd700' : '#888', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>${def.cost}</span>
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
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 440,
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{TOWER_ICONS[upgradeTowerData.type] ?? '🗼'}</span>
              <div>
                <div style={{ color: '#e0ffe0', fontWeight: 700, fontSize: 15 }}>{upgradeTowerData.type}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ fontSize: 12, color: i < upgradeTowerData.upgrades ? '#ffd700' : 'rgba(255,255,255,0.2)' }}>
                      {i < upgradeTowerData.upgrades ? '●' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button onPointerDown={() => selectForUpgrade(null)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              סגור
            </button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {(() => {
              const def = TOWER_DEFS[upgradeTowerData.type];
              if (!def) return null;
              const dps = def.dps > 0 ? Math.round(def.dps * upgradeTowerData.damageMultiplier * upgradeTowerData.fireRateMultiplier * 10) / 10 : 0;
              const range = Math.round(def.range * upgradeTowerData.rangeMultiplier);
              return (
                <>
                  {dps > 0 && <Stat label="DPS" value={String(dps)} color="#ff9944" />}
                  {range > 0 && <Stat label="טווח" value={String(range)} color="#44ccff" />}
                  <Stat label="רמה" value={`${upgradeTowerData.upgrades}/3`} color="#ffd700" />
                  {upgradeTowerData.type === 'GlueTrap' && <Stat label="האטה" value="70%" color="#ddaa00" />}
                  {upgradeTowerData.type === 'BugLight' && <Stat label="נזק+" value="+35%" color="#ffff44" />}
                </>
              );
            })()}
          </div>

          {upgradeTowerData.upgrades < 3 ? (
            <div style={{ background: 'rgba(80,200,80,0.08)', border: '1px solid rgba(80,200,80,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'rgba(200,255,200,0.7)' }}>
              <span style={{ color: '#88ee88', fontWeight: 700 }}>שדרוג הבא: </span>
              +50% נזק &nbsp;·&nbsp; +10% טווח &nbsp;·&nbsp; +20% קצב ירי
            </div>
          ) : (
            <div style={{ background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#ffd700', textAlign: 'center', fontWeight: 700 }}>
              ★ שודרג במלואו ★
            </div>
          )}

          {upgradeTowerData.upgrades < 3 && (() => {
            const cost = upgradeTowerData.upgradeCost;
            const canAfford = state.gold >= cost;
            return (
              <button
                disabled={!canAfford}
                onPointerDown={() => { if (canAfford) upgradeTower(upgradeTowerData.id); }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  border: `2px solid ${canAfford ? '#ffd700' : 'rgba(255,255,255,0.1)'}`,
                  background: canAfford ? 'linear-gradient(135deg, rgba(180,130,0,0.5), rgba(120,80,0,0.5))' : 'rgba(255,255,255,0.04)',
                  color: canAfford ? '#ffd700' : 'rgba(255,255,255,0.25)',
                  fontSize: 14, fontWeight: 700,
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: canAfford ? '0 0 16px rgba(255,200,0,0.2)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {canAfford ? `⬆ שדרג — $${cost}` : `צריך $${cost} (יש $${state.gold})`}
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

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
