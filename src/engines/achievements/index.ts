import { EXERCISES, LESSONS } from '@/content';
import type { Derived, LearningData } from '@/features/progress/derive';
import type { Achievement } from '@/types';

/** Badges : chacun récompense un apprentissage réel, jamais une simple visite. */
export const ACHIEVEMENTS: (Achievement & {
  check: (data: LearningData, d: Derived, extra: { cardsReviewed: number }) => boolean;
})[] = [
  {
    id: 'first-lesson',
    title: 'Première leçon',
    description: 'Terminer une leçon et répondre à son QCM.',
    check: (data) =>
      data.lessonProgress.some((p) => p.status === 'termine') &&
      data.attempts.some((a) => a.context === 'lesson'),
  },
  {
    id: 'autonomous-5',
    title: 'Autonome',
    description: '5 questions d’exercices de TD réussies du premier coup, sans indice.',
    check: (data) =>
      data.attempts.filter(
        (a) => a.context === 'exercise' && a.correct && a.hintsUsed === 0 && a.attemptNumber === 1,
      ).length >= 5,
  },
  {
    id: 'td1-complete',
    title: 'TD1 bouclé',
    description: 'Réussir toutes les questions du TD1.',
    check: (data) => tdComplete(data, 'TD1'),
  },
  {
    id: 'td2-complete',
    title: 'TD2 bouclé',
    description: 'Réussir toutes les questions du TD2.',
    check: (data) => tdComplete(data, 'TD2'),
  },
  {
    id: 'exam-14',
    title: 'Prêt pour l’examen',
    description: 'Obtenir au moins 14/20 à un examen blanc.',
    check: (data) => data.exams.some((e) => e.score20 >= 14),
  },
  {
    id: 'streak-3',
    title: 'Régulier',
    description: '3 jours de travail consécutifs.',
    check: (_data, d) => d.streak >= 3,
  },
  {
    id: 'streak-7',
    title: 'Une semaine entière',
    description: '7 jours de travail consécutifs.',
    check: (_data, d) => d.streak >= 7,
  },
  {
    id: 'cards-50',
    title: 'Mémoire entraînée',
    description: '50 révisions de flashcards.',
    check: (_d, _x, extra) => extra.cardsReviewed >= 50,
  },
  {
    id: 'mistakes-10',
    title: 'Apprendre de ses erreurs',
    description: 'Corriger 10 erreurs (bonne réponse après une erreur sur la même question).',
    check: (data) => data.mistakes.filter((m) => m.resolved).length >= 10,
  },
  {
    id: 'mastery-5',
    title: 'Fondations solides',
    description: '5 notions au statut « Maîtrisée ».',
    check: (_data, d) =>
      [...d.mastery.values()].filter((m) => m.status === 'maitrisee').length >= 5,
  },
  {
    id: 'all-lessons',
    title: 'Parcours complet',
    description: 'Terminer toutes les leçons des cours 0, 1 et 2.',
    check: (data) =>
      LESSONS.every((l) =>
        data.lessonProgress.some((p) => p.lessonId === l.id && p.status === 'termine'),
      ),
  },
];

function tdComplete(data: LearningData, td: string) {
  return EXERCISES.filter((e) => e.td === td).every((e) => {
    const p = data.exerciseProgress.find((x) => x.exerciseId === e.id);
    return p && e.parts.every((part) => p.parts[part.id]?.correct);
  });
}
