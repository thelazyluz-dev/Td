import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { saveScore, getScores } from '../game/leaderboard';

function getLoseMessage(wave: number, gold: number): [string, string] {
  if (wave <= 1) return ['🐜 נכשלת!', 'גל אחד?! אפילו הנמלים לא האמינו לעצמן...'];
  if (wave === 2) return ['🐜 נכשלת!', 'שניים גלים. ניסית לפחות. בערך.'];
  if (wave === 3) return ['🐜 נכשלת!', 'שלושה גלים. המטבח שלך עכשיו שלהם.'];
  if (wave === 4) return ['🐜 נכשלת!', 'רבעת... ואז נפלת. כמעט לא.'];
  if (wave === 5) return ['🔥 הבוס הפיל אותך!', 'נמלת האש ניצחה. קשה להתווכח עם אמא.'];
  if (wave === 6) return ['🪳 מקקים ניצחו!', 'הם תמיד מנצחים. ידוע מדע.'];
  if (wave === 7) return ['🐝 הצרעות ניצחו!', 'כועסות? תאמר. כרגיל.'];
  if (wave === 8) return ['🪲 הטרמיטים פרצו!', `אוהבים עץ. ועכשיו גם את הזהב שלך. ($${gold} נשאר)`];
  if (wave === 9) return ['😤 כמעט!!!', 'גל 9. כמעט. ממש ממש כמעט. לא.'];
  if (wave === 10) return ['👑 המלכה ניצחה!', 'QueenAnt שלחה לך מכתב תודה. היא תיכנס לדירה.'];
  if (wave <= 15) return ['🔥 ותיק!', `${wave} גלים. לא רע. הם עוד חוזרים.`];
  if (wave <= 20) return ['💪 גיבור מטבח!', `${wave} גלים?! קנית להם כבוד.`];
  if (wave <= 30) return ['🏅 אגדה!', `גל ${wave}. הנמלים כתבו שיר על הקרב הזה.`];
  return ['🐜👑 אלוף עולם!', `גל ${wave}! אפילו המלכה ויתרה. כמעט.`];
}

export function GameOver() {
  const { state, initEngine, resetGame } = useGameStore();
  const savedRef = useRef(false);

  useEffect(() => {
    if (state?.phase === 'gameover' && !savedRef.current) {
      savedRef.current = true;
      saveScore(state.wave, state.gold);
    }
    if (state?.phase !== 'gameover') {
      savedRef.current = false;
    }
  }, [state?.phase, state?.wave, state?.gold]);

  if (!state) return null;
  if (state.phase !== 'gameover') return null;

  const [title, subtitle] = getLoseMessage(state.wave, state.gold);
  const scores = getScores();

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(20,0,0,0.88)', padding: '12px', overflowY: 'auto' }}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: '16px 20px',
          borderRadius: 18,
          border: '1px solid rgba(239,68,68,0.35)',
          background: 'rgba(69,10,10,0.75)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 20px 60px rgba(239,68,68,0.25)',
          maxWidth: 340, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 40 }}>☠️</div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 900, margin: 0,
            color: '#fca5a5', letterSpacing: '-0.02em',
          }}>
            {title}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: '6px 0 0', fontSize: 12, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>

        {/* Current run stats */}
        <div style={{
          display: 'flex', gap: 16, padding: '8px 16px',
          borderRadius: 12, background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {[
            { label: 'גלים',     val: String(state.wave),    color: '#fff' },
            { label: 'חיי בסיס', val: String(state.baseHp),  color: '#fff' },
            { label: 'זהב',      val: String(state.gold),    color: '#fbbf24' },
          ].map(({ label, val, color }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: i > 0 ? 16 : 0 }}>
              {i > 0 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{label}</div>
                <div style={{ color, fontWeight: 800, fontSize: 18, fontFamily: 'monospace' }}>{val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        {scores.length > 0 && (
          <div style={{ width: '100%' }}>
            <div style={{
              textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.35)', marginBottom: 6,
            }}>
              🏆 טופ 10 שיאים
            </div>
            <div style={{
              borderRadius: 10, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              {scores.map((s, i) => {
                const isCurrent = s.wave === state.wave && s.gold === state.gold;
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 10px',
                    background: isCurrent
                      ? 'rgba(239,68,68,0.18)'
                      : i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{
                      color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#c97c3a' : 'rgba(255,255,255,0.35)',
                      fontSize: 10, width: 18, fontWeight: 700,
                    }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                      גל {s.wave}
                    </span>
                    <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 11 }}>
                      💰{s.gold}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{s.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button
            onClick={() => initEngine()}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 800, fontSize: 13,
              border: 'none', cursor: 'pointer',
              background: '#dc2626', color: '#fff',
            }}
          >
            שחק שוב
          </button>
          <button
            onClick={resetGame}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 700, fontSize: 13,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
            }}
          >
            תפריט
          </button>
        </div>
      </div>
    </div>
  );
}
