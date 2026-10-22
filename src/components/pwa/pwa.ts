import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  update: (() => Promise<void>) | null;
}

export const usePwa = create<PwaState>(() => ({
  needRefresh: false,
  offlineReady: false,
  installEvent: null,
  installed: false,
  update: null,
}));

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

export async function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwa.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    usePwa.setState({ installed: true, installEvent: null }),
  );
  usePwa.setState({ installed: isStandalone() });
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    onNeedRefresh() {
      usePwa.setState({ needRefresh: true });
    },
    onOfflineReady() {
      usePwa.setState({ offlineReady: true });
    },
  });
  usePwa.setState({ update: () => updateSW(true) });
}

export async function promptInstall(): Promise<boolean> {
  const ev = usePwa.getState().installEvent;
  if (!ev) return false;
  await ev.prompt();
  const choice = await ev.userChoice;
  usePwa.setState({ installEvent: null });
  return choice.outcome === 'accepted';
}
