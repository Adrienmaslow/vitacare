import { useSettings } from '@/stores/settings';

let ctx: AudioContext | null = null;

/** Petit retour sonore (désactivé par défaut, réglable dans Paramètres). */
export function playFeedback(kind: 'success' | 'error') {
  if (!useSettings.getState().sounds) return;
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'success' ? 880 : 220;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    /* audio indisponible */
  }
}
