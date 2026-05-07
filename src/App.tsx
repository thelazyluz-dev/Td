import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { GameOver } from './ui/GameOver';
import { useGameScale, GAME_W, GAME_H } from './utils/useScale';

function PortraitWarning() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 999 }}>
      <div style={{ fontSize: 56 }} className="animate-bounce">📱</div>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: 0 }}>Rotate your device</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '6px 0 0' }}>Last Stand requires landscape mode</p>
      </div>
    </div>
  );
}

export default function App() {
  const { state } = useGameStore();
  const { scale, isPortrait } = useGameScale();

  if (isPortrait) return <PortraitWarning />;
  if (!state)     return <MainMenu />;

  return (
    // position:fixed ensures it's relative to the visual viewport, not the document —
    // critical on mobile where 100vh ≠ actual visible height
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
      overflow: 'hidden',
    }}>
      {/* Red atmosphere behind canvas */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(100,0,0,0.15) 0%, transparent 65%)',
      }} />

      {/* The entire game at computed scale */}
      <div style={{
        width: GAME_W,
        height: GAME_H,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        position: 'relative',
        flexShrink: 0,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 0 80px rgba(0,0,0,0.9)',
      }}>
        <GameCanvas />
        <HUD />
        <GameOver />
      </div>
    </div>
  );
}
