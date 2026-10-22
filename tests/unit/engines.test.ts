import { describe, expect, it } from 'vitest';
import { computeMastery, attemptCredit } from '@/engines/mastery-engine/mastery';
import { newSchedule, review, isDue } from '@/engines/spaced-repetition/srs';
import { evaluate } from '@/engines/assessment-engine/evaluate';
import { questionById } from '@/content';
import { mulberry32, shuffle } from '@/lib/random';
import { addDays, dayKey, diffDays } from '@/lib/dates';
import type { QuizAttempt } from '@/types';

const NOW = new Date(2026, 9, 22, 12).getTime();

function att(partial: Partial<QuizAttempt>): QuizAttempt {
  return {
    questionId: 'q',
    context: 'chapter',
    refId: 'x',
    conceptIds: ['c1-resistivite'],
    difficulty: 2,
    correct: true,
    score: 1,
    hintsUsed: 0,
    attemptNumber: 1,
    given: '',
    expected: '',
    durationMs: 1000,
    at: NOW,
    ...partial,
  };
}

describe('maîtrise', () => {
  it('aucune donnée ⇒ non étudiée, score 0', () => {
    const m = computeMastery('c1-resistivite', [], NOW);
    expect(m.status).toBe('non-etudiee');
    expect(m.score).toBe(0);
  });
  it('leçon lue sans réponse ⇒ en apprentissage, maîtrise toujours 0', () => {
    const m = computeMastery('c1-resistivite', [], NOW, true);
    expect(m.status).toBe('en-apprentissage');
    expect(m.score).toBe(0);
  });
  it('une seule bonne réponse ne suffit pas à « maîtriser »', () => {
    const m = computeMastery('c1-resistivite', [att({})], NOW);
    expect(m.score).toBeLessThan(0.5);
    expect(m.status).not.toBe('maitrisee');
  });
  it('plusieurs réussites autonomes ⇒ maîtrisée', () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      att({ at: NOW - i * 1000, context: 'exercise' }),
    );
    const m = computeMastery('c1-resistivite', attempts, NOW);
    expect(m.score).toBeGreaterThanOrEqual(0.75);
    expect(m.status).toBe('maitrisee');
  });
  it('une réussite après 3 indices vaut moins qu’une réussite autonome', () => {
    expect(attemptCredit(att({ hintsUsed: 3 }))).toBeLessThan(attemptCredit(att({ hintsUsed: 0 })));
    const a = computeMastery(
      'c1-resistivite',
      Array.from({ length: 5 }, () => att({ hintsUsed: 3 })),
      NOW,
    );
    const b = computeMastery(
      'c1-resistivite',
      Array.from({ length: 5 }, () => att({ hintsUsed: 0 })),
      NOW,
    );
    expect(a.score).toBeLessThan(b.score);
  });
  it('un deuxième essai réussi vaut moins qu’un premier essai', () => {
    expect(attemptCredit(att({ attemptNumber: 2 }))).toBeLessThan(
      attemptCredit(att({ attemptNumber: 1 })),
    );
  });
  it('les mauvaises réponses font baisser le score', () => {
    const good = Array.from({ length: 4 }, () => att({}));
    const mixed = [...good, att({ correct: false, score: 0 }), att({ correct: false, score: 0 })];
    expect(computeMastery('c1-resistivite', mixed, NOW).score).toBeLessThan(
      computeMastery('c1-resistivite', good, NOW).score,
    );
  });
  it('deux échecs récents après une bonne maîtrise ⇒ à revoir', () => {
    const attempts = [
      ...Array.from({ length: 8 }, (_, i) => att({ at: NOW - 10_000 - i })),
      att({ correct: false, score: 0, at: NOW - 2 }),
      att({ correct: false, score: 0, at: NOW - 1 }),
    ];
    expect(computeMastery('c1-resistivite', attempts, NOW).status).toBe('a-revoir');
  });
  it('ancienneté : notion non travaillée depuis longtemps ⇒ à revoir', () => {
    const old = NOW - 40 * 86_400_000;
    const attempts = Array.from({ length: 8 }, () => att({ at: old }));
    expect(computeMastery('c1-resistivite', attempts, NOW).status).toBe('a-revoir');
  });
  it('ignore les tentatives d’autres notions', () => {
    const m = computeMastery('c2-dopage', [att({})], NOW);
    expect(m.evidence).toBe(0);
  });
});

describe('répétition espacée', () => {
  const today = dayKey(NOW);
  it('nouvelle carte due aujourd’hui', () => {
    expect(isDue(newSchedule('c', today), today)).toBe(true);
  });
  it('progression des intervalles (Moyen) : 1, 6, puis × facilité', () => {
    let s = newSchedule('c', today);
    s = review(s, 'moyen', NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.due).toBe(addDays(today, 1));
    s = review(s, 'moyen', NOW);
    expect(s.intervalDays).toBe(6);
    s = review(s, 'moyen', NOW);
    expect(s.intervalDays).toBe(Math.round(6 * s.ease));
  });
  it('Facile espace davantage que Difficile', () => {
    const e = review(newSchedule('c', today), 'facile', NOW);
    const d = review(newSchedule('c', today), 'difficile', NOW);
    expect(e.intervalDays).toBeGreaterThan(d.intervalDays);
    expect(e.ease).toBeGreaterThan(d.ease);
  });
  it('À revoir : retour aujourd’hui, répétitions remises à zéro, facilité ≥ 1,3', () => {
    let s = newSchedule('c', today);
    for (let i = 0; i < 3; i++) s = review(s, 'moyen', NOW);
    for (let i = 0; i < 10; i++) s = review(s, 'a-revoir', NOW);
    expect(s.repetitions).toBe(0);
    expect(s.due).toBe(today);
    expect(s.lapses).toBe(10);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
  });
  it('déterministe', () => {
    const a = review(review(newSchedule('c', today), 'moyen', NOW), 'facile', NOW);
    const b = review(review(newSchedule('c', today), 'moyen', NOW), 'facile', NOW);
    expect(a).toEqual(b);
  });
});

describe('évaluation des questions', () => {
  it('QCM', () => {
    const q = questionById('q-c0-o2')!;
    expect(q.type).toBe('mcq');
    if (q.type !== 'mcq') return;
    expect(evaluate(q, { type: 'choice', choiceId: q.correctId }).correct).toBe(true);
    const wrong = q.choices.find((c) => c.id !== q.correctId)!;
    const r = evaluate(q, { type: 'choice', choiceId: wrong.id });
    expect(r.correct).toBe(false);
    expect(r.feedback).toBe(wrong.why);
  });
  it('vrai/faux', () => {
    const q = questionById('q-c0-u4')!;
    expect(evaluate(q, { type: 'boolean', value: true }).correct).toBe(true);
    expect(evaluate(q, { type: 'boolean', value: false }).correct).toBe(false);
  });
  it('numérique avec unité', () => {
    const q = questionById('ex-AD1.3')!;
    expect(evaluate(q, { type: 'text', value: '260 mΩ' }).correct).toBe(true);
    expect(evaluate(q, { type: 'text', value: '2,6 Ω' }).errorCategory).toBe('unites');
  });
  it('correspondances : score partiel', () => {
    const q = questionById('q-c2-b4')!;
    if (q.type !== 'matching') throw new Error();
    const mapping = Object.fromEntries(q.pairs.map((p) => [p.left, p.right]));
    expect(evaluate(q, { type: 'matching', mapping }).correct).toBe(true);
    const [a, b] = q.pairs;
    const swapped = { ...mapping, [a!.left]: b!.right, [b!.left]: a!.right };
    const r = evaluate(q, { type: 'matching', mapping: swapped });
    expect(r.correct).toBe(false);
    expect(r.score).toBeCloseTo(1 / 3);
  });
  it('classement', () => {
    const q = questionById('q-c0-nm4')!;
    if (q.type !== 'ordering') throw new Error();
    expect(evaluate(q, { type: 'ordering', order: q.items }).correct).toBe(true);
    expect(evaluate(q, { type: 'ordering', order: [...q.items].reverse() }).correct).toBe(false);
  });
  it('autocorrection guidée par critères', () => {
    const q = questionById('ex-AD2.6')!;
    if (q.type !== 'selfcheck') throw new Error();
    expect(
      evaluate(q, { type: 'selfcheck', criteriaMet: q.criteria.map(() => true) }).correct,
    ).toBe(true);
    const r = evaluate(q, { type: 'selfcheck', criteriaMet: q.criteria.map((_, i) => i === 0) });
    expect(r.correct).toBe(false);
    expect(r.score).toBeGreaterThan(0);
  });
});

describe('utilitaires', () => {
  it('mélange déterministe avec une graine', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(items, mulberry32(7))).toEqual(shuffle(items, mulberry32(7)));
    expect(shuffle(items, mulberry32(7)).sort()).toEqual(items);
  });
  it('dates locales', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(diffDays('2026-11-01', '2026-10-30')).toBe(2);
  });
});
