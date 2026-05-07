import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { GameCanvas } from './ui/GameCanvas';
import { HUD } from './ui/HUD';
import { GameOver } from './ui/GameOver';

export default function App() {
  const { state } = useGameStore();

  if (!state) {
    return <MainMenu />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="relative" style={{ width: 800, height: 500 }}>
        <GameCanvas />
        <HUD />
        <GameOver />
      </div>
    </div>
  );
}
