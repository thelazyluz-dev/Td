import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState = 'ready' | 'ios-manual' | 'installed' | 'unsupported';

export function usePWAInstall() {
  const [prompt, setPrompt]   = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setState] = useState<InstallState>('unsupported');

  useEffect(() => {
    // Already running in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed');
      return;
    }

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) { setState('ios-manual'); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setState('ready');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setState('installed'));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setState('installed');
    setPrompt(null);
  };

  return { installState, install };
}
