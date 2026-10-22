import {
  CHAPTERS,
  CONCEPTS,
  EXERCISES,
  FLASHCARDS,
  LESSONS,
  ORDERED_LESSONS,
  conceptsOfChapter,
} from '@/content';
import { computeMastery } from '@/engines/mastery-engine/mastery';
import { addDays, dayKey, diffDays } from '@/lib/dates';
import type {
  Chapter,
  ExamResult,
  ExerciseProgress,
  LearningSession,
  Lesson,
  LessonStatus,
  MasteryScore,
  Mistake,
  QuizAttempt,
  RevisionSchedule,
  UserProgress,
} from '@/types';

/** Toutes les données utilisateur nécessaires aux calculs (lues depuis IndexedDB). */
export interface LearningData {
  attempts: QuizAttempt[];
  mistakes: Mistake[];
  lessonProgress: UserProgress[];
  exerciseProgress: ExerciseProgress[];
  reviews: RevisionSchedule[];
  sessions: LearningSession[];
  exams: ExamResult[];
  activeDays: string[];
}

export const EMPTY_DATA: LearningData = {
  attempts: [],
  mistakes: [],
  lessonProgress: [],
  exerciseProgress: [],
  reviews: [],
  sessions: [],
  exams: [],
  activeDays: [],
};

export interface Derived {
  mastery: Map<string, MasteryScore>;
  lessonStatus: Map<string, LessonStatus>;
  /** Leçons comptées dans le parcours (selon le mode du cours 0). */
  pathLessons: Lesson[];
  pathProgress: number;
  lessonsDone: number;
  exercisePartsDone: number;
  exercisePartsTotal: number;
  totalActiveMs: number;
  todayActiveMs: number;
  dueCards: number;
  streak: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  isEmpty: boolean;
}

export function isLessonInPath(lesson: Lesson, cours0Mode: 'essentiel' | 'complet'): boolean {
  return lesson.chapterId !== 'c0' || cours0Mode === 'complet' || !!lesson.essential;
}

export function computeLessonStatus(
  lesson: Lesson,
  progress: UserProgress | undefined,
  mastery: Map<string, MasteryScore>,
): LessonStatus {
  if (!progress) return 'a-decouvrir';
  if (progress.status === 'en-cours') return 'en-cours';
  const needsReview = lesson.conceptIds.some((c) => mastery.get(c)?.status === 'a-revoir');
  return needsReview ? 'a-revoir' : 'termine';
}

/** Niveau : seuils croissants (100, 250, 450, 700…). */
export function levelFromXp(xp: number) {
  let level = 1;
  let threshold = 100;
  let base = 0;
  while (xp >= base + threshold) {
    base += threshold;
    level += 1;
    threshold += 50;
  }
  return { level, xpIntoLevel: xp - base, xpForNextLevel: threshold };
}

/**
 * XP : récompense l'apprentissage réel.
 * - bonne réponse : 10 × (1 − 0,25 × indices) (minimum 2) ; 2ᵉ essai et suivants : moitié ;
 * - leçon terminée : 20 ; carte révisée : 2 ; examen : 5 × note/20.
 */
export function computeXp(data: LearningData, cardsReviewed: number): number {
  let xp = 0;
  for (const a of data.attempts) {
    if (!a.correct) continue;
    const base = Math.max(2, 10 * (1 - 0.25 * Math.min(a.hintsUsed, 3)));
    xp += a.attemptNumber > 1 ? base / 2 : base;
  }
  xp += data.lessonProgress.filter((p) => p.status === 'termine').length * 20;
  xp += cardsReviewed * 2;
  xp += data.exams.reduce((s, e) => s + Math.round(e.score20 * 5), 0);
  return Math.round(xp);
}

export function activeDaySet(data: LearningData): Set<string> {
  const days = new Set<string>(data.activeDays);
  for (const s of data.sessions) if (s.activeMs >= 60_000) days.add(s.day);
  for (const a of data.attempts) days.add(dayKey(a.at));
  return days;
}

/** Série de jours travaillés consécutifs (aujourd'hui ou hier inclus). */
export function computeStreak(days: Set<string>, today = dayKey()): number {
  let start = today;
  if (!days.has(today)) {
    start = addDays(today, -1);
    if (!days.has(start)) return 0;
  }
  let n = 0;
  let d = start;
  while (days.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

export function derive(
  data: LearningData,
  opts: { cours0Mode: 'essentiel' | 'complet'; cardsReviewed?: number; now?: number },
): Derived {
  const now = opts.now ?? Date.now();
  const today = dayKey(now);
  const progressMap = new Map(data.lessonProgress.map((p) => [p.lessonId, p]));

  const studiedConcepts = new Set(
    data.lessonProgress.flatMap((p) => LESSONS.find((l) => l.id === p.lessonId)?.conceptIds ?? []),
  );
  const mastery = new Map<string, MasteryScore>();
  for (const c of CONCEPTS)
    mastery.set(c.id, computeMastery(c.id, data.attempts, now, studiedConcepts.has(c.id)));

  const lessonStatus = new Map<string, LessonStatus>();
  for (const l of LESSONS)
    lessonStatus.set(l.id, computeLessonStatus(l, progressMap.get(l.id), mastery));

  const pathLessons = ORDERED_LESSONS.filter((l) => isLessonInPath(l, opts.cours0Mode));
  const lessonsDone = pathLessons.filter((l) => progressMap.get(l.id)?.status === 'termine').length;

  const exercisePartsTotal = EXERCISES.reduce((s, e) => s + e.parts.length, 0);
  const exercisePartsDone = data.exerciseProgress.reduce(
    (s, p) => s + Object.values(p.parts).filter((x) => x.correct).length,
    0,
  );

  const totalActiveMs = data.sessions.reduce((s, x) => s + x.activeMs, 0);
  const todayActiveMs = data.sessions
    .filter((s) => s.day === today)
    .reduce((s, x) => s + x.activeMs, 0);
  const reviewMap = new Map(data.reviews.map((r) => [r.cardId, r]));
  const dueCards = FLASHCARDS.filter((c) => {
    const r = reviewMap.get(c.id);
    return r !== undefined && r.due <= today;
  }).length;

  const xp = computeXp(data, opts.cardsReviewed ?? 0);
  const lvl = levelFromXp(xp);

  return {
    mastery,
    lessonStatus,
    pathLessons,
    pathProgress: pathLessons.length ? lessonsDone / pathLessons.length : 0,
    lessonsDone,
    exercisePartsDone,
    exercisePartsTotal,
    totalActiveMs,
    todayActiveMs,
    dueCards,
    streak: computeStreak(activeDaySet(data), today),
    xp,
    level: lvl.level,
    xpIntoLevel: lvl.xpIntoLevel,
    xpForNextLevel: lvl.xpForNextLevel,
    isEmpty:
      data.attempts.length === 0 &&
      data.lessonProgress.length === 0 &&
      data.sessions.length === 0 &&
      data.reviews.length === 0,
  };
}

export interface ChapterStats {
  chapter: Chapter;
  lessonsTotal: number;
  lessonsDone: number;
  pathProgress: number;
  /** Moyenne des scores de maîtrise des notions du chapitre (0–1). */
  mastery: number;
  /** Nombre de notions avec au moins une réponse. */
  conceptsStudied: number;
  correctAnswers: number;
  totalAnswers: number;
  fragile: MasteryScore[];
}

export function chapterStats(
  chapter: Chapter,
  data: LearningData,
  d: Derived,
  cours0Mode: 'essentiel' | 'complet',
): ChapterStats {
  const lessons = d.pathLessons.filter((l) => l.chapterId === chapter.id);
  const lessonsAll =
    chapter.id === 'c0' && cours0Mode === 'essentiel'
      ? lessons
      : LESSONS.filter((l) => l.chapterId === chapter.id);
  const done = lessonsAll.filter(
    (l) => d.lessonStatus.get(l.id) === 'termine' || d.lessonStatus.get(l.id) === 'a-revoir',
  ).length;
  const concepts = conceptsOfChapter(chapter.id);
  const scores = concepts.map((c) => d.mastery.get(c.id)!);
  const ids = new Set(concepts.map((c) => c.id));
  const answers = data.attempts.filter((a) => a.conceptIds.some((c) => ids.has(c)));
  return {
    chapter,
    lessonsTotal: lessonsAll.length,
    lessonsDone: done,
    pathProgress: lessonsAll.length ? done / lessonsAll.length : 0,
    mastery: scores.length ? scores.reduce((s, m) => s + m.score, 0) / scores.length : 0,
    conceptsStudied: scores.filter((m) => m.evidence > 0).length,
    correctAnswers: answers.filter((a) => a.correct).length,
    totalAnswers: answers.length,
    fragile: scores
      .filter(
        (m) => m.evidence >= 2 && (m.status === 'en-apprentissage' || m.status === 'a-revoir'),
      )
      .sort((a, b) => a.score - b.score),
  };
}

export function allChapterStats(
  data: LearningData,
  d: Derived,
  cours0Mode: 'essentiel' | 'complet',
) {
  return CHAPTERS.map((c) => chapterStats(c, data, d, cours0Mode));
}

/** Notions les plus fragiles (au moins 2 réponses), triées par score. */
export function weakestConcepts(d: Derived, limit = 5): MasteryScore[] {
  return [...d.mastery.values()]
    .filter((m) => m.evidence >= 2 && m.status !== 'maitrisee')
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function daysSince(ts: number, now = Date.now()) {
  return diffDays(dayKey(now), dayKey(ts));
}
