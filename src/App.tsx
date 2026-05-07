import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { GameOver } from './ui/GameOver';

export default function App() {
  const { state } = useGameStore();

  if (!state) return <MainMenu />;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      {/* Subtle vignette glow behind canvas */}
      <div className="relative" style={{ width: 800 }}>
        <div className="absolute -inset-4 rounded-3xl pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center, rgba(120,0,0,0.15) 0%, transparent 70%)' }} />
        <div className="relative rounded-lg overflow-hidden shadow-2xl border border-white/5"
             style={{ width: 800, height: 500 }}>
          <GameCanvas />
          <HUD />
          <GameOver />
        </div>
      </div>
    </div>
  );
}
