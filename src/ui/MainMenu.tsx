import { useGameStore } from '../store/gameStore';

export function MainMenu() {
  const { initEngine } = useGameStore();

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gray-950 overflow-hidden relative"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(120,0,0,0.18) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(0,40,0,0.12) 0%, transparent 60%)' }}
      />

      <div className="relative flex flex-col items-center gap-8 text-center px-8">
        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-red-600 font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.4em' }}>
            Tower Defense · Roguelike
          </p>
          <h1 className="font-black tracking-tighter text-white leading-none"
              style={{ fontSize: 'clamp(48px, 12vw, 80px)', textShadow: '0 0 60px rgba(220,38,38,0.6), 0 2px 4px rgba(0,0,0,0.8)' }}>
            LAST
          </h1>
          <h1 className="font-black tracking-tighter text-red-500 leading-none -mt-3"
              style={{ fontSize: 'clamp(48px, 12vw, 80px)', textShadow: '0 0 60px rgba(220,38,38,0.8), 0 2px 4px rgba(0,0,0,0.8)' }}>
            STAND
          </h1>
          <p className="text-white/30 leading-relaxed mt-1" style={{ fontSize: 13, maxWidth: 280 }}>
            Survive 10 waves of the undead.<br />
            Build, upgrade, and hold the line.
          </p>
        </div>

        {/* CTA — large touch target */}
        <button
          onPointerDown={() => initEngine()}
          className="bg-red-700 active:bg-red-500 text-white font-black rounded-xl transition-transform active:scale-95"
          style={{
            fontSize: 18,
            letterSpacing: '0.1em',
            padding: '16px 52px',
            minHeight: 56,
            boxShadow: '0 8px 32px rgba(180,0,0,0.5)',
            WebkitTapHighlightColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          START RUN
        </button>

        {/* Tips grid */}
        <div className="grid grid-cols-3 gap-3" style={{ maxWidth: 420 }}>
          {[
            { icon: '🔫', label: 'Place Towers', desc: '10s build phase' },
            { icon: '🌊', label: '10 Waves',     desc: 'Increasing difficulty' },
            { icon: '💀', label: 'Hold the Line', desc: '10 through = over' },
          ].map(({ icon, label, desc }) => (
            <div key={label}
                 className="flex flex-col items-center gap-1.5 rounded-xl"
                 style={{ padding: '12px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 24 }}>{icon}</span>
              <span className="text-white font-semibold" style={{ fontSize: 11 }}>{label}</span>
              <span className="text-white/35 leading-tight" style={{ fontSize: 10 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
