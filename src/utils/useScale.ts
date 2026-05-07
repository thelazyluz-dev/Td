import { useState, useEffect } from 'react';

export const GAME_W = 800;
export const GAME_H = 500;

function compute() {
  // visualViewport accounts for browser chrome (address bar, nav bar) on mobile
  const vp = window.visualViewport;
  const vw = vp ? vp.width  : window.innerWidth;
  const vh = vp ? vp.height : window.innerHeight;
  return {
    // 0.97 buffer ensures no 1px overflow from sub-pixel rounding
    scale:     Math.min((vw / GAME_W) * 0.97, (vh / GAME_H) * 0.97),
    isPortrait: vw < vh,
  };
}

export function useGameScale() {
  const [state, setState] = useState(compute);

  useEffect(() => {
    const update = () => setState(compute());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}
