import { useGameStore } from '../store/gameStore';

export function MainMenu() {
  const { initEngine } = useGameStore();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 overflow-hidden relative">
      {/* Background noise texture via radial gradients */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(120,0,0,0.18) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(0,40,0,0.12) 0%, transparent 60%)' }} />

      <div className="relative flex flex-col items-center gap-10 text-center px-8">

        {/* Title block */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-red-600 text-xs font-bold uppercase tracking-[0.4em]">Tower Defense · Roguelike</p>
          <h1 className="text-7xl font-black tracking-tighter text-white leading-none"
              style={{ textShadow: '0 0 60px rgba(220,38,38,0.6), 0 2px 4px rgba(0,0,0,0.8)' }}>
            LAST
          </h1>
          <h1 className="text-7xl font-black tracking-tighter text-red-500 leading-none -mt-4"
              style={{ textShadow: '0 0 60px rgba(220,38,38,0.8), 0 2px 4px rgba(0,0,0,0.8)' }}>
            STAND
          </h1>
          <p className="text-white/30 text-sm mt-2 max-w-xs leading-relaxed">
            Survive 10 waves of the undead.<br/>
            Build, upgrade, and hold the line.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => initEngine()}
          className="group relative bg-red-700 hover:bg-red-600 text-white font-black text-lg px-14 py-4 rounded-xl transition-all duration-150 shadow-xl hover:shadow-red-900/60 hover:scale-105 active:scale-95"
          style={{ letterSpacing: '0.08em' }}
        >
          START RUN
          <span className="absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-white/20 transition-all" />
        </button>

        {/* Quick tips */}
        <div className="grid grid-cols-3 gap-4 mt-2 max-w-lg">
          {[
            { icon: '🔫', label: 'Place Towers', desc: 'During the 10s build phase' },
            { icon: '🌊', label: '10 Waves',     desc: 'Each harder than the last' },
            { icon: '💀', label: 'Hold the Line', desc: '10 enemies through = game over' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.04] border border-white/5">
              <span className="text-2xl">{icon}</span>
              <span className="text-white text-xs font-semibold">{label}</span>
              <span className="text-white/35 text-xs leading-tight">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
