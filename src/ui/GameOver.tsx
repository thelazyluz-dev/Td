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
          <h1 className={`text-4xl font-black tracking-tight ${isWin ? 'text-emerald-300' : 'text-red-400'}`}>
            {title}
          </h1>
          <p className="text-white/60 mt-2 text-sm max-w-xs leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-6 px-6 py-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-center">
            <p className="text-white/40 text-xs tracking-wider">גלים</p>
            <p className="text-white font-bold text-xl">{state.wave}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-white/40 text-xs tracking-wider">חיי בסיס</p>
            <p className="text-white font-bold text-xl">{state.baseHp}</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-white/40 text-xs tracking-wider">זהב</p>
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
            שחק שוב
          </button>
          <button
            onClick={resetGame}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
          >
            תפריט
          </button>
        </div>
      </div>
    </div>
  );
}
