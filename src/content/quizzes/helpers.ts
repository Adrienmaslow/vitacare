import type {
  ContentOrigin,
  Difficulty,
  MatchingQuestion,
  McqQuestion,
  NumericQuestion,
  OrderingQuestion,
  SelfCheckQuestion,
  SourceReference,
  TdId,
  TrueFalseQuestion,
} from '@/types';

interface Common {
  id: string;
  concepts: string[];
  difficulty?: Difficulty;
  explanation: string;
  td?: TdId[];
  origin?: ContentOrigin;
  source?: SourceReference;
}

function base(c: Common) {
  return {
    id: c.id,
    conceptIds: c.concepts,
    difficulty: c.difficulty ?? 1,
    explanation: c.explanation,
    td: c.td,
    origin: c.origin ?? 'ece-study',
    source: c.source,
  };
}

/**
 * QCM. Les choix sont donnés sous forme [texte, justification] ; `correct` est l'indice de la bonne
 * réponse. L'ordre est mélangé à l'affichage.
 */
export function mcq(
  c: Common & { prompt: string; choices: [string, string][]; correct: number; formula?: boolean },
): McqQuestion {
  return {
    ...base(c),
    type: c.formula ? 'formula' : 'mcq',
    prompt: c.prompt,
    choices: c.choices.map(([text, why], i) => ({ id: String.fromCharCode(97 + i), text, why })),
    correctId: String.fromCharCode(97 + c.correct),
  };
}

export function tf(c: Common & { prompt: string; answer: boolean }): TrueFalseQuestion {
  return { ...base(c), type: 'truefalse', prompt: c.prompt, answer: c.answer };
}

export function num(
  c: Common & {
    prompt: string;
    value: number;
    unit: string;
    tolerance?: number;
    unitRequired?: boolean;
  },
): NumericQuestion {
  return {
    ...base(c),
    type: 'numeric',
    prompt: c.prompt,
    answer: {
      value: c.value,
      unit: c.unit,
      tolerance: c.tolerance ?? 0.02,
      unitRequired: c.unitRequired ?? c.unit !== '',
    },
  };
}

export function match(
  c: Common & { prompt: string; pairs: [string, string][] },
): MatchingQuestion {
  return {
    ...base(c),
    type: 'matching',
    prompt: c.prompt,
    pairs: c.pairs.map(([left, right]) => ({ left, right })),
  };
}

export function order(c: Common & { prompt: string; items: string[] }): OrderingQuestion {
  return { ...base(c), type: 'ordering', prompt: c.prompt, items: c.items };
}

export function selfcheck(
  c: Common & { prompt: string; model: string; criteria: string[] },
): SelfCheckQuestion {
  return {
    ...base(c),
    type: 'selfcheck',
    prompt: c.prompt,
    modelAnswer: c.model,
    criteria: c.criteria,
  };
}
