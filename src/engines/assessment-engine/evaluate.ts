import { checkNumeric, formatAnswer } from '@/engines/units/quantity';
import type { EvaluationResult, GivenAnswer, Question } from '@/types';

const stripMath = (s: string) => s.replace(/\$/g, '');

/** Texte de la bonne réponse, pour l'historique et la correction. */
export function expectedDisplay(q: Question): string {
  switch (q.type) {
    case 'mcq':
    case 'formula':
      return stripMath(q.choices.find((c) => c.id === q.correctId)?.text ?? '');
    case 'truefalse':
      return q.answer ? 'Vrai' : 'Faux';
    case 'numeric':
      return formatAnswer(q.answer);
    case 'matching':
      return q.pairs.map((p) => `${stripMath(p.left)} → ${stripMath(p.right)}`).join(' ; ');
    case 'ordering':
      return q.items.map(stripMath).join(' → ');
    case 'selfcheck':
      return stripMath(q.modelAnswer);
  }
}

function givenDisplay(q: Question, a: GivenAnswer): string {
  switch (a.type) {
    case 'choice':
      return q.type === 'mcq' || q.type === 'formula'
        ? stripMath(q.choices.find((c) => c.id === a.choiceId)?.text ?? a.choiceId)
        : a.choiceId;
    case 'boolean':
      return a.value ? 'Vrai' : 'Faux';
    case 'text':
      return a.value;
    case 'matching':
      return Object.entries(a.mapping)
        .map(([l, r]) => `${stripMath(l)} → ${stripMath(r)}`)
        .join(' ; ');
    case 'ordering':
      return a.order.map(stripMath).join(' → ');
    case 'selfcheck':
      return `${a.criteriaMet.filter(Boolean).length}/${a.criteriaMet.length} critères validés`;
  }
}

/**
 * Évalue une réponse. Aucune bonne réponse n'est révélée par l'interface avant cet appel.
 * Les questions de type « selfcheck » reposent sur une autocorrection guidée par critères explicites.
 */
export function evaluate(q: Question, a: GivenAnswer): EvaluationResult {
  const base = { expectedDisplay: expectedDisplay(q), givenDisplay: givenDisplay(q, a) };
  switch (q.type) {
    case 'mcq':
    case 'formula': {
      if (a.type !== 'choice') break;
      const ok = a.choiceId === q.correctId;
      const chosen = q.choices.find((c) => c.id === a.choiceId);
      return {
        ...base,
        correct: ok,
        score: ok ? 1 : 0,
        feedback: chosen?.why ?? '',
        errorCategory: null,
      };
    }
    case 'truefalse': {
      if (a.type !== 'boolean') break;
      const ok = a.value === q.answer;
      return { ...base, correct: ok, score: ok ? 1 : 0, feedback: '', errorCategory: null };
    }
    case 'numeric': {
      if (a.type !== 'text') break;
      const r = checkNumeric(a.value, q.answer);
      return {
        ...base,
        correct: r.correct,
        score: r.correct ? 1 : 0,
        feedback: r.feedback,
        errorCategory: r.category,
      };
    }
    case 'matching': {
      if (a.type !== 'matching') break;
      const good = q.pairs.filter((p) => a.mapping[p.left] === p.right).length;
      const score = good / q.pairs.length;
      return {
        ...base,
        correct: score === 1,
        score,
        feedback: `${good}/${q.pairs.length} associations correctes.`,
        errorCategory: null,
      };
    }
    case 'ordering': {
      if (a.type !== 'ordering') break;
      const good = q.items.filter((it, i) => a.order[i] === it).length;
      const score = good / q.items.length;
      return {
        ...base,
        correct: score === 1,
        score,
        feedback: `${good}/${q.items.length} éléments à la bonne place.`,
        errorCategory: null,
      };
    }
    case 'selfcheck': {
      if (a.type !== 'selfcheck') break;
      const met = a.criteriaMet.filter(Boolean).length;
      const score = q.criteria.length ? met / q.criteria.length : 0;
      return {
        ...base,
        correct: score === 1,
        score,
        feedback: `Autocorrection : ${met}/${q.criteria.length} critères remplis.`,
        errorCategory: null,
      };
    }
  }
  throw new Error(`Réponse de type ${a.type} incompatible avec une question ${q.type}`);
}
