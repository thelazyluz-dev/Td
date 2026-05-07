import { useState, useEffect } from 'react';

export const GAME_W = 800;
export const GAME_H = 500;

function compute() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    scale:     Math.min(vw / GAME_W, vh / GAME_H),
    isPortrait: vw < vh,
  };
}

export function useGameScale() {
  const [state, setState] = useState(compute);
  useEffect(() => {
    const update = () => setState(compute());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return state;
}
