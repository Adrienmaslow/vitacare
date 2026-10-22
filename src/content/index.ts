import type { Exercise, Lesson, Question } from '@/types';
import {
  CHAPTERS,
  CONCEPTS,
  COURSE,
  DOCS,
  PLANNED_CHAPTERS,
  chapterById,
  conceptById,
  conceptsOfChapter,
} from './course';
import { FORMULAS, formulaById } from './formulas';
import { LESSONS_C0 } from './lessons/c0';
import { LESSONS_C1 } from './lessons/c1';
import { LESSONS_C2 } from './lessons/c2';
import { QUESTIONS_C0 } from './quizzes/c0';
import { QUESTIONS_C1 } from './quizzes/c1';
import { QUESTIONS_C2 } from './quizzes/c2';
import { TD1 } from './exercises/td1';
import { TD2 } from './exercises/td2';
import { FLASHCARDS, FLASHCARD_KIND_LABEL } from './flashcards';
import { GLOSSARY } from './glossary';
import { EXPLANATIONS } from './explain';

export {
  CHAPTERS,
  CONCEPTS,
  COURSE,
  DOCS,
  PLANNED_CHAPTERS,
  FORMULAS,
  FLASHCARDS,
  FLASHCARD_KIND_LABEL,
  GLOSSARY,
  EXPLANATIONS,
};
export { chapterById, conceptById, conceptsOfChapter, formulaById };

export const LESSONS: Lesson[] = [...LESSONS_C0, ...LESSONS_C1, ...LESSONS_C2];

/** Banque de questions des QCM (hors questions d'exercices). */
export const QUIZ_QUESTIONS: Question[] = [...QUESTIONS_C0, ...QUESTIONS_C1, ...QUESTIONS_C2];

export const EXERCISES: Exercise[] = [...TD1, ...TD2];

/** Toutes les questions, y compris celles des parties d'exercices. */
export const ALL_QUESTIONS: Question[] = [
  ...QUIZ_QUESTIONS,
  ...EXERCISES.flatMap((ex) => ex.parts.map((p) => p.question)),
];

const questionIndex = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
const lessonIndex = new Map(LESSONS.map((l) => [l.id, l]));
const exerciseIndex = new Map(EXERCISES.map((e) => [e.id, e]));

export const questionById = (id: string) => questionIndex.get(id);
export const lessonById = (id: string) => lessonIndex.get(id);
export const exerciseById = (id: string) => exerciseIndex.get(id);

export const lessonsOfChapter = (chapterId: string) =>
  LESSONS.filter((l) => l.chapterId === chapterId).sort((a, b) => a.order - b.order);

/** Leçons dans l'ordre du parcours (chapitre puis ordre). */
export const ORDERED_LESSONS: Lesson[] = CHAPTERS.flatMap((c) =>
  c.lessonIds.map((id) => lessonIndex.get(id)!).filter(Boolean),
);

export const exercisesOfTd = (td: string) => EXERCISES.filter((e) => e.td === td);

export const exercisesOfChapter = (chapterId: string) => {
  const ch = chapterById(chapterId);
  return ch ? EXERCISES.filter((e) => ch.tds.includes(e.td)) : [];
};

export const questionsOfConcepts = (conceptIds: string[]) =>
  QUIZ_QUESTIONS.filter((q) => q.conceptIds.some((c) => conceptIds.includes(c)));

export const lessonForConcept = (conceptId: string) =>
  ORDERED_LESSONS.find((l) => l.conceptIds.includes(conceptId));

/** Questions du diagnostic du cours 0 (3 par notion indispensable/utile du parcours essentiel). */
export const DIAGNOSTIC_LESSON_IDS = LESSONS_C0.filter((l) => l.essential).map((l) => l.id);

export const DOC_LABEL: Record<string, string> = {
  cours0: 'Cours 0',
  cours1: 'Cours 1',
  cours2: 'Cours 2',
  livret: 'Livret TD',
};

export function sourceLabel(s: { doc: string; pages: string; label?: string }): string {
  const unit = s.doc === 'livret' ? 'p.' : 'diapo';
  return `${DOC_LABEL[s.doc] ?? s.doc}, ${unit} ${s.pages}${s.label ? ` — ${s.label}` : ''}`;
}
