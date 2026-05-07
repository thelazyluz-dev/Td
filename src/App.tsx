import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { GameOver } from './ui/GameOver';
import { useGameScale } from './utils/useScale';

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
  const { isPortrait } = useGameScale();

  if (isPortrait) return <PortraitWarning />;
  if (!state) return <MainMenu />;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a2a06' }}>
      <HUD />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <GameCanvas />
        <GameOver />
      </div>
    </div>
  );
}
