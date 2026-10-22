import { addDays, dayKey } from '@/lib/dates';
import type { ReviewGrade, RevisionSchedule } from '@/types';

/**
 * Répétition espacée déterministe, dérivée de SM-2 (Wozniak, 1987).
 * Notes : « À revoir » (échec), « Difficile », « Moyen », « Facile ».
 * - Échec : la carte revient aujourd'hui (intervalle 0), répétitions remises à zéro, facilité −0,2.
 * - Réussite : 1er passage 1 j (Facile : 4 j), 2e passage 6 j (Difficile : 3 j, Facile : 8 j),
 *   ensuite intervalle × facilité (× 0,8 si Difficile, × 1,3 si Facile).
 * - Facilité mise à jour selon SM-2, bornée à 1,3 minimum.
 */
const Q: Record<ReviewGrade, number> = { 'a-revoir': 1, difficile: 3, moyen: 4, facile: 5 };

export function newSchedule(cardId: string, today = dayKey()): RevisionSchedule {
  return {
    cardId,
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    due: today,
    lastReviewedAt: null,
    lastGrade: null,
  };
}

export function review(
  s: RevisionSchedule,
  grade: ReviewGrade,
  now = Date.now(),
): RevisionSchedule {
  const today = dayKey(now);
  const q = Q[grade];
  if (grade === 'a-revoir') {
    return {
      ...s,
      repetitions: 0,
      lapses: s.lapses + 1,
      intervalDays: 0,
      ease: Math.max(1.3, round2(s.ease - 0.2)),
      due: today,
      lastReviewedAt: now,
      lastGrade: grade,
    };
  }
  const ease = Math.max(1.3, round2(s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  const repetitions = s.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = grade === 'facile' ? 4 : 1;
  else if (repetitions === 2) interval = grade === 'difficile' ? 3 : grade === 'facile' ? 8 : 6;
  else {
    const mult = grade === 'difficile' ? 0.8 : grade === 'facile' ? 1.3 : 1;
    interval = Math.max(s.intervalDays + 1, Math.round(s.intervalDays * ease * mult));
  }
  return {
    ...s,
    ease,
    repetitions,
    intervalDays: interval,
    due: addDays(today, interval),
    lastReviewedAt: now,
    lastGrade: grade,
  };
}

export function isDue(s: RevisionSchedule, today = dayKey()): boolean {
  return s.due <= today;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
