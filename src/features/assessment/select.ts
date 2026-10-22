import { CHAPTERS, QUIZ_QUESTIONS, conceptsOfChapter, lessonById, questionById } from '@/content';
import { mulberry32, shuffle } from '@/lib/random';
import type { Derived, LearningData } from '@/features/progress/derive';
import type { Question } from '@/types';

export type QcmMode = 'lecon' | 'chapitre' | 'td' | 'erreurs' | 'rapide' | 'concept';

export interface QcmParams {
  mode: QcmMode;
  lesson?: string;
  chapter?: string;
  td?: string;
  concepts?: string[];
  n?: number;
  difficulty?: 'auto' | 1 | 2 | 3;
}

/** Répartit les questions entre notions (round-robin) pour éviter les doublons de notion. */
function balanced(
  pool: Question[],
  n: number,
  rng: () => number,
  priority?: Map<string, number>,
): Question[] {
  const byConcept = new Map<string, Question[]>();
  for (const q of shuffle(pool, rng)) {
    const c = q.conceptIds[0]!;
    if (!byConcept.has(c)) byConcept.set(c, []);
    byConcept.get(c)!.push(q);
  }
  const concepts = [...byConcept.keys()].sort(
    (a, b) => (priority?.get(a) ?? 0.5) - (priority?.get(b) ?? 0.5) || rng() - 0.5,
  );
  const out: Question[] = [];
  const seen = new Set<string>();
  while (out.length < n) {
    let added = false;
    for (const c of concepts) {
      const list = byConcept.get(c)!;
      const q = list.shift();
      if (q && !seen.has(q.id)) {
        out.push(q);
        seen.add(q.id);
        added = true;
        if (out.length >= n) break;
      }
    }
    if (!added) break;
  }
  return shuffle(out, rng);
}

function preferDifficulty(pool: Question[], d: QcmParams['difficulty']): Question[] {
  if (!d || d === 'auto') return pool;
  const close = pool.filter((q) => Math.abs(q.difficulty - d) <= 1);
  return close.length >= Math.min(8, pool.length) ? close : pool;
}

export function selectQuestions(
  p: QcmParams,
  data: LearningData,
  derived: Derived,
  seed: number,
): { title: string; questions: Question[]; timeLimitSec?: number } {
  const rng = mulberry32(seed);
  const priority = new Map(
    [...derived.mastery.values()].map((m) => [m.conceptId, m.evidence ? m.score : 0.5]),
  );
  switch (p.mode) {
    case 'lecon': {
      const l = p.lesson ? lessonById(p.lesson) : undefined;
      const qs = (l?.quizQuestionIds ?? [])
        .map((id) => questionById(id))
        .filter((q): q is Question => !!q);
      return { title: `QCM de leçon — ${l?.title ?? ''}`, questions: shuffle(qs, rng).slice(0, 5) };
    }
    case 'chapitre': {
      const ch = CHAPTERS.find((c) => c.id === p.chapter) ?? CHAPTERS[0]!;
      const ids = new Set(conceptsOfChapter(ch.id).map((c) => c.id));
      const pool = preferDifficulty(
        QUIZ_QUESTIONS.filter((q) => q.conceptIds.some((c) => ids.has(c))),
        p.difficulty,
      );
      const n = Math.max(10, Math.min(20, p.n ?? 15));
      return {
        title: `QCM du ${ch.shortTitle} — ${ch.title}`,
        questions: balanced(pool, n, rng, priority),
      };
    }
    case 'td': {
      const td = p.td ?? 'TD1';
      const pool = QUIZ_QUESTIONS.filter((q) => q.td?.includes(td as 'TD1' | 'TD2'));
      return {
        title: `QCM méthodes du ${td}`,
        questions: balanced(pool, Math.min(pool.length, p.n ?? 12), rng, priority),
      };
    }
    case 'erreurs': {
      const unresolved = data.mistakes.filter((m) => !m.resolved).sort((a, b) => b.at - a.at);
      const direct = [...new Set(unresolved.map((m) => m.questionId))]
        .map((id) => questionById(id))
        .filter((q): q is Question => !!q);
      const conceptSet = new Set(unresolved.flatMap((m) => m.conceptIds));
      const related = QUIZ_QUESTIONS.filter(
        (q) => !direct.some((d) => d.id === q.id) && q.conceptIds.some((c) => conceptSet.has(c)),
      );
      const n = p.n ?? 10;
      const qs = [...direct.slice(0, n), ...shuffle(related, rng)].slice(
        0,
        Math.max(n, Math.min(direct.length, 15)),
      );
      return { title: 'QCM « mes erreurs »', questions: shuffle(qs, rng) };
    }
    case 'concept': {
      const set = new Set(p.concepts ?? []);
      const pool = QUIZ_QUESTIONS.filter((q) => q.conceptIds.some((c) => set.has(c)));
      return { title: 'Entraînement ciblé', questions: shuffle(pool, rng).slice(0, p.n ?? 6) };
    }
    case 'rapide':
    default: {
      const pool = preferDifficulty(QUIZ_QUESTIONS, p.difficulty);
      return {
        title: 'Session rapide (5 minutes)',
        questions: balanced(pool, 15, rng, priority),
        timeLimitSec: 300,
      };
    }
  }
}

/** Examen : questions et réponses mélangées, couvrant les trois chapitres. */
export function selectExam(n: number, seed: number): Question[] {
  const rng = mulberry32(seed);
  const pool = QUIZ_QUESTIONS.filter((q) => q.type !== 'selfcheck');
  return balanced(pool, n, rng);
}
