import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { GameOver } from './ui/GameOver';
import { useGameScale, GAME_W, GAME_H } from './utils/useScale';

function PortraitWarning() {
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6 z-[999]">
      <div className="text-6xl animate-bounce">📱</div>
      <div className="text-center px-8">
        <p className="text-white font-bold text-xl mb-2">Rotate your device</p>
        <p className="text-white/40 text-sm">Last Stand is best played in landscape mode</p>
      </div>
      <div className="flex items-center gap-2 text-white/20 text-xs">
        <span>◀</span>
        <span className="border border-white/10 rounded px-3 py-1">Landscape</span>
        <span>▶</span>
      </div>
    </div>
  );
}

export default function App() {
  const { state } = useGameStore();
  const { scale, isPortrait } = useGameScale();

  if (isPortrait) return <PortraitWarning />;

  if (!state) return <MainMenu />;

  // Outer div fills the viewport; inner div is the fixed 800×500 game, CSS-scaled
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', overflow: 'hidden' }}>
      {/* Atmosphere glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(120,0,0,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Scaled game container */}
      <div style={{
        width: GAME_W,
        height: GAME_H,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        position: 'relative',
        flexShrink: 0,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <GameCanvas />
        <HUD />
        <GameOver />
      </div>
    </div>
  );
}
