import { useState, useRef, useEffect } from 'react';
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

const TOWER_NAMES_HE: Record<string, string> = {
  BugSpray:   'ספריי',
  Swatter:    'מחבט',
  Zapper:     'מחשמל',
  Sprinkler:  'ממטרה',
  MagGlass:   'מגדלת',
  PoisonBomb: 'פצצה',
  GlueTrap:   'דבק',
  BugLight:   'פנס',
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

const UPGRADE_FLAVOR: Record<string, [string, string, string]> = {
  BugSpray:   [
    'ריסוס כפול — עכשיו הם מריחים אותך מ-50 מטר',
    'ספריי מקצועי — הם שולחים מכתב התנגדות',
    'נשק ביולוגי — ה-EPA בוכה בפינה',
  ],
  Swatter:    [
    'מחבט מחוזק — שמע את ה-POP!',
    'מחבט כבד — יד רועדת שלוש שניות',
    'זֶבֶד-מוות! מיתולוגי.',
  ],
  Zapper:     [
    'יותר וואט — יותר ריח שרוף, פחות חרקים',
    'מחשמל בינוני — שיניים נפלות',
    'ברק זאוס — לא ממש, אבל כמעט',
  ],
  Sprinkler:  [
    'ריסוס חזק — הם שונאים מים (מי ידע?)',
    'שיטפון ממוקד — טבע עצוב מאוד',
    'גשם מונסון — הם חושבים שעברו לסיאטל',
  ],
  MagGlass:   [
    'פוקוס חד — כמו ילד קטן עם זכוכית בקיץ',
    'לייזר חצי-מקצועי — צריך רישיון',
    'קרן מוות — אל תביט ישירות. ממש.',
  ],
  PoisonBomb: [
    'ירוק יותר = רעיל יותר. זה מדע.',
    'ענן גז כבד — אסורה הכניסה',
    'אפוקליפסה כימית — גרסת גן!',
  ],
  GlueTrap:   [
    'כמו דייסה. הם לא זזים. כלל.',
    'בטון ביולוגי. ממש בטון.',
    'שחור חור דבקות. פיזיקה קרסה.',
  ],
  BugLight:   [
    'יותר ואט — עיניים כואבות לחרקים',
    'בוהק כמו אולפן — מסנוור לגמרי',
    'שמש שנייה — משקפי שמש חובה',
  ],
};

export function HUD() {
  const {
    state, selectedTower, selectedUpgradeTowerId,
    selectTower, skipBuild, sendNextWave, airStrike, empBlast,
    selectForUpgrade, upgradeTower, sellTower, setSpeed, initEngine,
  } = useGameStore();

  const [confirmRestart, setConfirmRestart] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

  const handleRestartPress = () => {
    if (confirmRestart) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmRestart(false);
      initEngine();
    } else {
      setConfirmRestart(true);
      confirmTimerRef.current = setTimeout(() => setConfirmRestart(false), 2500);
    }
  };

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
              <span style={{ color: '#66aaff', fontWeight: 700, fontSize: 9, letterSpacing: '0.08em' }}>גל</span>
              <span style={{ color: '#88ccff', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                {state.wave}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Restart button */}
            <button
              onPointerDown={handleRestartPress}
              style={{
                background: confirmRestart ? 'rgba(220,50,50,0.85)' : 'rgba(60,60,60,0.5)',
                border: `1px solid ${confirmRestart ? '#ff4444' : 'rgba(255,255,255,0.12)'}`,
                color: confirmRestart ? '#fff' : 'rgba(255,255,255,0.45)',
                borderRadius: 6, fontSize: confirmRestart ? 9 : 13, fontWeight: 700,
                padding: '4px 7px', minHeight: 28, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                boxShadow: confirmRestart ? '0 0 10px rgba(255,60,60,0.5)' : 'none',
              }}
            >
              {confirmRestart ? 'בטוח?' : '↺'}
            </button>
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
            {inWave && (
              <button
                onPointerDown={() => setSpeed(state.speed === 2 ? 1 : 2)}
                style={{
                  background: state.speed === 2 ? 'rgba(220,80,0,0.85)' : 'rgba(60,60,60,0.7)',
                  border: `1px solid ${state.speed === 2 ? '#ff6600' : 'rgba(255,255,255,0.15)'}`,
                  color: state.speed === 2 ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 6, fontSize: 11, fontWeight: 800,
                  padding: '4px 8px', minHeight: 28, cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: state.speed === 2 ? '0 0 10px rgba(255,100,0,0.5)' : 'none',
                  letterSpacing: '0.02em',
                }}
              >
                {state.speed === 2 ? '⏩ x2' : '▶ x1'}
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
                  <span style={{ color: '#e5e7eb', fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>{TOWER_NAMES_HE[def.type] ?? def.type}</span>
                  <span style={{ color: canAfford ? '#ffd700' : '#888', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>${def.cost}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tower upgrade / sell sheet ── */}
      {upgradeTowerData && (() => {
        const def = TOWER_DEFS[upgradeTowerData.type];
        if (!def) return null;
        const lvl       = upgradeTowerData.upgrades;
        const maxLvl    = 3;
        const isMaxed   = lvl >= maxLvl;
        const upgCost   = upgradeTowerData.upgradeCost;
        const canUpg    = !isMaxed && state.gold >= upgCost;
        const sellAmt   = Math.round((upgradeTowerData as any).totalSpent * 0.6);
        const accentCol = TOWER_COLORS[upgradeTowerData.type] ?? '#88ee88';
        // current stats
        const curDps    = def.dps > 0 ? Math.round(def.dps * upgradeTowerData.damageMultiplier * upgradeTowerData.fireRateMultiplier * 10) / 10 : 0;
        const curRange  = Math.round(def.range * upgradeTowerData.rangeMultiplier);
        // next level stats
        const nextDmgMult = 1 + (lvl + 1) * 0.5;
        const nextFrMult  = 1 + (lvl + 1) * 0.2;
        const nextRngMult = 1 + (lvl + 1) * 0.1;
        const nextDps   = def.dps > 0 ? Math.round(def.dps * nextDmgMult * nextFrMult * 10) / 10 : 0;
        const nextRange = Math.round(def.range * nextRngMult);

        return (
          <div
            style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 460,
              background: 'rgba(5,14,5,0.97)',
              borderTop: `2px solid ${accentCol}55`,
              borderLeft: `1px solid ${accentCol}22`,
              borderRight: `1px solid ${accentCol}22`,
              borderRadius: '18px 18px 0 0',
              padding: '14px 18px 18px',
              zIndex: 20,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 -8px 40px rgba(0,0,0,0.7), 0 -2px 0 ${accentCol}33`,
              pointerEvents: 'auto',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${accentCol}22`, border: `1.5px solid ${accentCol}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {TOWER_ICONS[upgradeTowerData.type] ?? '🗼'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f0fff0', fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>
                  {TOWER_NAMES_HE[upgradeTowerData.type] ?? upgradeTowerData.type}
                </div>
                {/* Upgrade level bar */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                  {Array.from({ length: maxLvl }).map((_, i) => (
                    <div key={i} style={{
                      height: 6, flex: 1, borderRadius: 3,
                      background: i < lvl ? accentCol : 'rgba(255,255,255,0.12)',
                      boxShadow: i < lvl ? `0 0 6px ${accentCol}88` : 'none',
                      transition: 'all 0.2s',
                    }} />
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginLeft: 4 }}>
                    {lvl}/{maxLvl}
                  </span>
                </div>
              </div>
              <button
                onPointerDown={() => selectForUpgrade(null)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '5px 12px', fontSize: 11, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >✕</button>
            </div>

            {/* Stats comparison */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 6, marginBottom: 12,
            }}>
              {/* Current stats */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>עכשיו</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {curDps > 0 && <StatRow label="DPS" val={`${curDps}`} col="#ff9944" />}
                  {curRange > 0 && <StatRow label="טווח" val={`${curRange}`} col="#44ccff" />}
                  {upgradeTowerData.type === 'GlueTrap' && <StatRow label="האטה" val="70%" col="#ddaa00" />}
                  {upgradeTowerData.type === 'BugLight' && <StatRow label="נזק×" val="+35%" col="#ffff44" />}
                </div>
              </div>
              {/* Next level or maxed */}
              <div style={{
                background: isMaxed ? 'rgba(255,200,0,0.06)' : canUpg ? 'rgba(80,200,80,0.06)' : 'rgba(255,255,255,0.03)',
                borderRadius: 10, padding: '8px 10px',
                border: `1px solid ${isMaxed ? 'rgba(255,200,0,0.2)' : canUpg ? 'rgba(80,200,80,0.18)' : 'rgba(255,255,255,0.07)'}`,
              }}>
                {isMaxed ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
                    <div style={{ fontSize: 18 }}>★</div>
                    <div style={{ color: '#ffd700', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>מקסימום</div>
                  </div>
                ) : (
                  <>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>רמה {lvl + 1}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {nextDps > 0 && <StatRow label="DPS" val={`${nextDps}`} col="#ff9944" arrow={curDps > 0 ? `+${Math.round((nextDps/curDps-1)*100)}%` : undefined} />}
                      {nextRange > 0 && <StatRow label="טווח" val={`${nextRange}`} col="#44ccff" arrow={curRange > 0 ? `+${Math.round((nextRange/curRange-1)*100)}%` : undefined} />}
                    </div>
                    {UPGRADE_FLAVOR[upgradeTowerData.type]?.[lvl] && (
                      <div style={{ marginTop: 6, color: '#aaffaa', fontSize: 9, fontStyle: 'italic', lineHeight: 1.4, opacity: 0.85 }}>
                        {UPGRADE_FLAVOR[upgradeTowerData.type][lvl]}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Upgrade button */}
              {!isMaxed && (
                <button
                  disabled={!canUpg}
                  onPointerDown={() => { if (canUpg) upgradeTower(upgradeTowerData.id); }}
                  style={{
                    flex: 2, padding: '11px 0', borderRadius: 11,
                    border: `2px solid ${canUpg ? '#ffd700' : 'rgba(255,255,255,0.08)'}`,
                    background: canUpg
                      ? 'linear-gradient(135deg, rgba(200,150,0,0.55), rgba(140,90,0,0.55))'
                      : 'rgba(255,255,255,0.03)',
                    color: canUpg ? '#ffd700' : 'rgba(255,255,255,0.2)',
                    fontSize: 13, fontWeight: 800,
                    cursor: canUpg ? 'pointer' : 'not-allowed',
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: canUpg ? '0 0 20px rgba(255,200,0,0.25)' : 'none',
                    transition: 'all 0.15s',
                    letterSpacing: '0.02em',
                  }}
                >
                  {canUpg ? `⬆ שדרג  $${upgCost}` : `צריך $${upgCost}`}
                </button>
              )}
              {/* Sell button */}
              <button
                onPointerDown={() => sellTower(upgradeTowerData.id)}
                style={{
                  flex: isMaxed ? 1 : 1, padding: '11px 0', borderRadius: 11,
                  border: '1.5px solid rgba(220,80,80,0.35)',
                  background: 'rgba(180,40,40,0.18)',
                  color: '#ff8888', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                🗑 מכור<br/>
                <span style={{ fontSize: 11, color: '#ffaaaa', fontWeight: 600 }}>+${sellAmt}</span>
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function StatRow({ label, val, col, arrow }: { label: string; val: string; col: string; arrow?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
      <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ color: col, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{val}</span>
        {arrow && <span style={{ color: '#44ee88', fontSize: 9, fontWeight: 700 }}>{arrow}</span>}
      </div>
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
