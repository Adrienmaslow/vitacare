import type { AttemptContext, MasteryScore, MasteryStatus, QuizAttempt } from '@/types';

/**
 * Score de maîtrise estimé par notion — modèle documenté dans docs/ARCHITECTURE.md.
 *
 *   maîtrise = Σ (poids × crédit) / (Σ poids + PRIOR)
 *
 * - crédit = score × facteurIndices × facteurTentative (0 si faux)
 * - poids  = poidsContexte × poidsDifficulté × récence
 * - PRIOR  = 2 : quelques bonnes réponses ne suffisent pas à atteindre 100 %.
 */
export const MASTERY_PARAMS = {
  prior: 2,
  hintFactor: [1, 0.75, 0.5, 0.3] as const,
  retryFactor: 0.7,
  halfLifeDays: 21,
  minRecency: 0.25,
  contextWeight: {
    lesson: 0.8,
    quick: 0.8,
    chapter: 1,
    td: 1,
    errors: 1,
    diagnostic: 1,
    'skip-test': 1,
    generated: 1.1,
    exercise: 1.2,
    exam: 1.2,
  } satisfies Record<AttemptContext, number>,
  difficultyWeight: { 1: 0.8, 2: 1, 3: 1.25 } as Record<number, number>,
  thresholds: { learning: 0.4, mastered: 0.75, minEvidence: 4, staleDays: 21 },
};

export function attemptCredit(a: QuizAttempt): number {
  if (!a.correct && a.score <= 0) return 0;
  const hints = Math.min(a.hintsUsed, 3);
  const hf = MASTERY_PARAMS.hintFactor[hints] ?? 0.3;
  const rf = a.attemptNumber > 1 ? MASTERY_PARAMS.retryFactor : 1;
  return a.score * hf * rf;
}

export function attemptWeight(a: QuizAttempt, now: number): number {
  const p = MASTERY_PARAMS;
  const ageDays = Math.max(0, (now - a.at) / 86_400_000);
  const recency = Math.max(p.minRecency, 0.5 ** (ageDays / p.halfLifeDays));
  return p.contextWeight[a.context] * (p.difficultyWeight[a.difficulty] ?? 1) * recency;
}

export function computeMastery(
  conceptId: string,
  attempts: QuizAttempt[],
  now = Date.now(),
  lessonStudied = false,
): MasteryScore {
  const relevant = attempts.filter((a) => a.conceptIds.includes(conceptId));
  if (relevant.length === 0) {
    return {
      conceptId,
      score: 0,
      evidence: 0,
      status: lessonStudied ? 'en-apprentissage' : 'non-etudiee',
      lastAt: null,
    };
  }
  let num = 0;
  let den = MASTERY_PARAMS.prior;
  let lastAt = 0;
  for (const a of relevant) {
    const w = attemptWeight(a, now);
    num += w * attemptCredit(a);
    den += w;
    lastAt = Math.max(lastAt, a.at);
  }
  const score = Math.min(1, num / den);
  const sorted = relevant.slice().sort((x, y) => x.at - y.at);
  return {
    conceptId,
    score,
    evidence: relevant.length,
    status: masteryStatus(score, relevant.length, lastAt, sorted, now),
    lastAt,
  };
}

function masteryStatus(
  score: number,
  evidence: number,
  lastAt: number,
  sorted: QuizAttempt[],
  now: number,
): MasteryStatus {
  const t = MASTERY_PARAMS.thresholds;
  const stale = (now - lastAt) / 86_400_000 > t.staleDays;
  const lastTwo = sorted.slice(-2);
  const recentFailures = lastTwo.length === 2 && lastTwo.every((a) => !a.correct);
  if (score >= t.learning && (stale || recentFailures)) return 'a-revoir';
  if (score < t.learning) return 'en-apprentissage';
  if (score < t.mastered || evidence < t.minEvidence) return 'a-consolider';
  return 'maitrisee';
}

export const MASTERY_LABEL: Record<MasteryStatus, string> = {
  'non-etudiee': 'Non étudiée',
  'en-apprentissage': 'En apprentissage',
  'a-consolider': 'À consolider',
  maitrisee: 'Maîtrisée',
  'a-revoir': 'À revoir',
};
