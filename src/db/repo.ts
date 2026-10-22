import { db } from './index';
import { dayKey } from '@/lib/dates';
import { newSchedule, review } from '@/engines/spaced-repetition/srs';
import type {
  AttemptContext,
  EvaluationResult,
  ExamResult,
  ExerciseProgress,
  Mistake,
  Question,
  QuizAttempt,
  ReviewGrade,
  RevisionSchedule,
} from '@/types';

export interface RecordAnswerInput {
  question: Question;
  result: EvaluationResult;
  context: AttemptContext;
  refId: string;
  /** Libellé lisible (« TD1 · AD1.3 », « QCM chapitre »…). */
  label: string;
  hintsUsed?: number;
  durationMs?: number;
  at?: number;
}

/**
 * Enregistre une réponse : tentative + éventuelle erreur.
 * Une bonne réponse ultérieure à la même question marque ses erreurs précédentes comme corrigées.
 */
export async function recordAnswer(input: RecordAnswerInput): Promise<QuizAttempt> {
  const at = input.at ?? Date.now();
  return db.transaction('rw', db.attempts, db.mistakes, async () => {
    const previous = await db.attempts
      .where('questionId')
      .equals(input.question.id)
      .filter((a) => a.refId === input.refId)
      .count();
    const attempt: QuizAttempt = {
      questionId: input.question.id,
      context: input.context,
      refId: input.refId,
      conceptIds: input.question.conceptIds,
      difficulty: input.question.difficulty,
      correct: input.result.correct,
      score: input.result.score,
      hintsUsed: input.hintsUsed ?? 0,
      attemptNumber: previous + 1,
      given: input.result.givenDisplay,
      expected: input.result.expectedDisplay,
      durationMs: input.durationMs ?? 0,
      at,
    };
    const id = await db.attempts.add(attempt);
    attempt.id = id;
    if (!attempt.correct) {
      const mistake: Mistake = {
        attemptId: id as number,
        questionId: attempt.questionId,
        context: attempt.context,
        refId: attempt.refId,
        label: input.label,
        conceptIds: attempt.conceptIds,
        given: attempt.given,
        expected: attempt.expected,
        category: input.result.errorCategory,
        at,
        resolved: false,
      };
      await db.mistakes.add(mistake);
    } else {
      await db.mistakes
        .where('questionId')
        .equals(attempt.questionId)
        .filter((m) => !m.resolved)
        .modify({ resolved: true });
    }
    return attempt;
  });
}

export async function setMistakeCategory(id: number, category: Mistake['category']) {
  await db.mistakes.update(id, { category });
}

export async function setMistakeResolved(id: number, resolved: boolean) {
  await db.mistakes.update(id, { resolved });
}

/* ------------------------------ Leçons ------------------------------ */

export async function startLesson(lessonId: string, now = Date.now()) {
  const existing = await db.lessonProgress.get(lessonId);
  if (!existing) await db.lessonProgress.put({ lessonId, status: 'en-cours', startedAt: now });
}

export async function completeLesson(lessonId: string, validatedByTest = false, now = Date.now()) {
  const existing = await db.lessonProgress.get(lessonId);
  await db.lessonProgress.put({
    lessonId,
    status: 'termine',
    startedAt: existing?.startedAt ?? now,
    completedAt: now,
    validatedByTest: validatedByTest || existing?.validatedByTest,
  });
}

export async function resetLesson(lessonId: string) {
  await db.lessonProgress.delete(lessonId);
}

/* ------------------------------ Exercices ------------------------------ */

export async function updateExercisePart(
  exerciseId: string,
  partId: string,
  patch: Partial<ExerciseProgress['parts'][string]>,
  now = Date.now(),
) {
  await db.transaction('rw', db.exerciseProgress, async () => {
    const current = (await db.exerciseProgress.get(exerciseId)) ?? {
      exerciseId,
      parts: {},
      updatedAt: now,
    };
    const prev = current.parts[partId] ?? { correct: false, hintsUsed: 0, correctionViewed: false };
    current.parts[partId] = {
      correct: prev.correct || (patch.correct ?? false),
      hintsUsed: Math.max(prev.hintsUsed, patch.hintsUsed ?? 0),
      correctionViewed: prev.correctionViewed || (patch.correctionViewed ?? false),
    };
    current.updatedAt = now;
    await db.exerciseProgress.put(current);
  });
}

/* ------------------------------ Flashcards ------------------------------ */

export async function gradeCard(cardId: string, grade: ReviewGrade, now = Date.now()) {
  const current = (await db.reviews.get(cardId)) ?? newSchedule(cardId, dayKey(now));
  const next: RevisionSchedule = review(current, grade, now);
  await db.reviews.put(next);
  const count = ((await getMeta<number>('cardsReviewed')) ?? 0) + 1;
  await setMeta('cardsReviewed', count);
  await addActivity(now);
  return next;
}

/* ------------------------------ Sessions ------------------------------ */

const SESSION_GAP_MS = 5 * 60_000;

/** Ajoute du temps actif réel (appelé par le suivi d'activité). */
export async function addActiveTime(deltaMs: number, now = Date.now()) {
  if (deltaMs <= 0) return;
  await db.transaction('rw', db.sessions, async () => {
    const day = dayKey(now);
    const last = await db.sessions.orderBy('lastActiveAt').last();
    if (last && last.day === day && now - last.lastActiveAt <= SESSION_GAP_MS) {
      await db.sessions.update(last.id!, {
        activeMs: last.activeMs + deltaMs,
        lastActiveAt: now,
      });
    } else {
      await db.sessions.add({
        day,
        startedAt: now - deltaMs,
        lastActiveAt: now,
        activeMs: deltaMs,
      });
    }
  });
}

/** Marque une activité sans temps (ex. une réponse) pour le calendrier. */
async function addActivity(now: number) {
  await setMeta(`active-${dayKey(now)}`, true);
}

/* ------------------------------ Examens ------------------------------ */

export async function saveExam(result: ExamResult) {
  return db.exams.add(result);
}

/* ------------------------------ Méta ------------------------------ */

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function unlockAchievement(id: string, at = Date.now()) {
  const existing = await db.achievements.get(id);
  if (!existing) await db.achievements.put({ id, unlockedAt: at });
}

/** Efface toute la progression (les PDF importés localement sont conservés sauf demande). */
export async function resetAllProgress(includeDocs = false) {
  await db.transaction(
    'rw',
    [
      db.attempts,
      db.mistakes,
      db.lessonProgress,
      db.exerciseProgress,
      db.reviews,
      db.sessions,
      db.exams,
      db.achievements,
      db.meta,
      db.docs,
    ],
    async () => {
      await Promise.all([
        db.attempts.clear(),
        db.mistakes.clear(),
        db.lessonProgress.clear(),
        db.exerciseProgress.clear(),
        db.reviews.clear(),
        db.sessions.clear(),
        db.exams.clear(),
        db.achievements.clear(),
        db.meta.clear(),
        includeDocs ? db.docs.clear() : Promise.resolve(),
      ]);
    },
  );
}
