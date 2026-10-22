import { useEffect } from 'react';
import { useSettings } from '@/stores/settings';

/** Applique thème, taille de texte, contraste et réduction des animations au document. */
export function useAppearance() {
  const { theme, fontScale, highContrast, animations } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', dark ? '#0d1120' : '#f7f6f2'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.font = fontScale;
    root.dataset.contrast = highContrast ? 'high' : 'normal';
    root.dataset.motion = animations ? 'full' : 'reduced';
  }, [fontScale, highContrast, animations]);
}
