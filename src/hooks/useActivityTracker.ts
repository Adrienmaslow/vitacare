import { useEffect } from 'react';
import { addActiveTime } from '@/db/repo';

const TICK_MS = 30_000;
const IDLE_MS = 2 * 60_000;

/**
 * Mesure le temps de travail RÉEL : seules les périodes où la page est visible et où
 * l'utilisateur a interagi récemment (< 2 min) sont comptées, par tranches de 30 s.
 */
export function useActivityTracker() {
  useEffect(() => {
    let lastInteraction = Date.now();
    let lastTick = Date.now();
    const mark = () => {
      lastInteraction = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(now - lastTick, TICK_MS);
      lastTick = now;
      if (document.visibilityState === 'visible' && now - lastInteraction < IDLE_MS) {
        void addActiveTime(elapsed, now);
      }
    }, TICK_MS);
    const onVisibility = () => {
      lastTick = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, []);
}
