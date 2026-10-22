import type { CorrectionStep, ExercisePart, Question } from '@/types';

export function part(p: {
  id: string;
  prompt: string;
  question: Question;
  hints: [string, string, string];
  steps: (string | CorrectionStep)[];
  origin: 'livret' | 'ece-study';
  erratum?: string;
  similar?: string;
}): ExercisePart {
  return {
    id: p.id,
    prompt: p.prompt,
    question: p.question,
    hints: [
      { level: 1, md: p.hints[0] },
      { level: 2, md: p.hints[1] },
      { level: 3, md: p.hints[2] },
    ],
    correction: p.steps.map((s) => (typeof s === 'string' ? { md: s } : s)),
    correctionOrigin: p.origin,
    erratum: p.erratum,
    similarGeneratorId: p.similar,
  };
}
