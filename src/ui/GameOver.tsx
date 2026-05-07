import { useGameStore } from '../store/gameStore';

function getLoseMessage(wave: number, gold: number): [string, string] {
  if (wave <= 1) return ['🐜 נכשלת!', 'גל אחד?! אפילו הנמלים לא האמינו לעצמן...'];
  if (wave === 2) return ['🐜 נכשלת!', 'שניים גלים. ניסית לפחות. בערך.'];
  if (wave === 3) return ['🐜 נכשלת!', 'שלושה גלים. המטבח שלך עכשיו שלהם.'];
  if (wave === 4) return ['🐜 נכשלת!', 'רבעת... ואז נפלת. כמעט לא.'];
  if (wave === 5) return ['🔥 הבוס הפיל אותך!', 'נמלת האש ניצחה. קשה להתווכח עם אמא.'];
  if (wave === 6) return ['🪳 מקקים ניצחו!', 'הם תמיד מנצחים. ידוע מדע.'];
  if (wave === 7) return ['🐝 הצרעות ניצחו!', 'כועסות? תאמר. כרגיל.'];
  if (wave === 8) return ['🪲 הטרמיטים פרצו!', `אוהבים עץ. ועכשיו גם את הזהב שלך. ($${gold} נשאר)`];
  if (wave === 9) return ['😤 כמעט!!!', 'גל 9 מתוך 10. כמעט. ממש ממש כמעט. לא.'];
  return ['🐜 נכשלת!', `הנמלים פרצו לבית בגל ${wave}.`];
}

export function GameOver() {
  const { state, initEngine, resetGame } = useGameStore();
  if (!state) return null;
  if (state.phase !== 'gameover' && state.phase !== 'win') return null;

  const isWin = state.phase === 'win';
  const [title, subtitle] = isWin
    ? ['🏠 הבית ניצל!', 'כל 10 גלי הנמלים נעצרו. אתה האלוף. הנמלים? פחות.']
    : getLoseMessage(state.wave, state.gold);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: isWin ? 'rgba(0,20,0,0.88)' : 'rgba(20,0,0,0.88)', padding: '12px' }}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: '16px 20px',
          borderRadius: 18,
          border: `1px solid ${isWin ? 'rgba(52,211,153,0.35)' : 'rgba(239,68,68,0.35)'}`,
          background: isWin ? 'rgba(6,78,59,0.75)' : 'rgba(69,10,10,0.75)',
          backdropFilter: 'blur(12px)',
          boxShadow: isWin ? '0 20px 60px rgba(16,185,129,0.25)' : '0 20px 60px rgba(239,68,68,0.25)',
          maxWidth: 340, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 40 }}>{isWin ? '🏆' : '☠️'}</div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(18px, 5vw, 28px)', fontWeight: 900, margin: 0,
            color: isWin ? '#6ee7b7' : '#fca5a5', letterSpacing: '-0.02em',
          }}>
            {title}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: '6px 0 0', fontSize: 12, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        </div>

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
              {i > 0 && <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', marginRight: 0 }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{label}</div>
                <div style={{ color, fontWeight: 800, fontSize: 18, fontFamily: 'monospace' }}>{val}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button
            onClick={() => initEngine()}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, fontWeight: 800, fontSize: 13,
              border: 'none', cursor: 'pointer',
              background: isWin ? '#059669' : '#dc2626',
              color: '#fff',
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
