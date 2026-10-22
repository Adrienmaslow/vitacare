import { describe, expect, it } from 'vitest';
import {
  ALL_QUESTIONS,
  CHAPTERS,
  CONCEPTS,
  EXERCISES,
  FLASHCARDS,
  FORMULAS,
  LESSONS,
  QUIZ_QUESTIONS,
  formulaById,
  lessonById,
  questionById,
} from '@/content';
import { EXPLANATIONS } from '@/content/explain';
import { GENERATORS, generatorById } from '@/engines/generators';
import { parseUnit } from '@/engines/units/units';
import { checkNumeric, formatAnswer } from '@/engines/units/quantity';

const conceptIds = new Set(CONCEPTS.map((c) => c.id));

describe('intégrité du contenu', () => {
  it('identifiants uniques', () => {
    for (const list of [ALL_QUESTIONS, LESSONS, EXERCISES, FORMULAS, FLASHCARDS, CONCEPTS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size, `doublons : ${ids.filter((x, i) => ids.indexOf(x) !== i)}`).toBe(ids.length);
    }
  });

  it('les chapitres référencent des leçons existantes', () => {
    for (const ch of CHAPTERS) for (const id of ch.lessonIds) expect(lessonById(id), id).toBeDefined();
    expect(LESSONS.length).toBe(CHAPTERS.flatMap((c) => c.lessonIds).length);
  });

  it('chaque leçon a 3 à 6 questions existantes et des blocs valides', () => {
    for (const l of LESSONS) {
      expect(l.quizQuestionIds.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.quizQuestionIds.length, l.id).toBeLessThanOrEqual(6);
      for (const q of [...l.quizQuestionIds, ...(l.skipTestQuestionIds ?? [])])
        expect(questionById(q), `${l.id} → ${q}`).toBeDefined();
      for (const p of l.prerequisiteLessonIds) expect(lessonById(p), `${l.id} prérequis ${p}`).toBeDefined();
      for (const c of l.conceptIds) expect(conceptIds.has(c), `${l.id} concept ${c}`).toBe(true);
      for (const b of l.blocks) {
        if (b.kind === 'formula') expect(formulaById(b.formulaId), b.formulaId).toBeDefined();
        if (b.kind === 'check') expect(questionById(b.questionId), b.questionId).toBeDefined();
      }
    }
  });

  it('les concepts des questions, formules et flashcards existent', () => {
    for (const q of ALL_QUESTIONS) for (const c of q.conceptIds) expect(conceptIds.has(c), `${q.id}: ${c}`).toBe(true);
    for (const f of FORMULAS) for (const c of f.conceptIds) expect(conceptIds.has(c), `${f.id}: ${c}`).toBe(true);
    for (const f of FLASHCARDS) for (const c of f.conceptIds) expect(conceptIds.has(c), `${f.id}: ${c}`).toBe(true);
    for (const c of CONCEPTS) for (const p of c.prerequisiteIds) expect(conceptIds.has(p), `${c.id}: ${p}`).toBe(true);
  });

  it('chaque notion a une explication « Explique-moi » et une leçon', () => {
    for (const c of CONCEPTS) {
      expect(EXPLANATIONS[c.id], c.id).toBeDefined();
      expect(LESSONS.some((l) => l.conceptIds.includes(c.id)), `leçon pour ${c.id}`).toBe(true);
    }
  });

  it('toutes les unités attendues sont reconnues et la bonne réponse est acceptée', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'numeric') continue;
      expect(parseUnit(q.answer.unit), `${q.id}: ${q.answer.unit}`).not.toBeNull();
      const res = checkNumeric(formatAnswer(q.answer), q.answer);
      expect(res.correct, `${q.id}: ${formatAnswer(q.answer)} → ${res.feedback}`).toBe(true);
    }
  });

  it('les QCM ont une bonne réponse existante et au moins 3 choix', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'mcq' && q.type !== 'formula') continue;
      expect(q.choices.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.choices.some((c) => c.id === q.correctId), q.id).toBe(true);
    }
  });

  it('exercices : 3 indices, une correction, un générateur similaire valide', () => {
    for (const ex of EXERCISES) {
      expect(ex.parts.length, ex.id).toBeGreaterThan(0);
      for (const p of ex.parts) {
        expect(p.hints).toHaveLength(3);
        expect(p.correction.length, `${ex.id} ${p.id}`).toBeGreaterThan(0);
        if (p.similarGeneratorId) expect(generatorById(p.similarGeneratorId), p.similarGeneratorId).toBeDefined();
      }
      for (const l of ex.prerequisiteLessonIds) expect(lessonById(l), `${ex.id}: ${l}`).toBeDefined();
    }
  });

  it('inventaire TD1/TD2 conforme au livret', () => {
    const numbers = EXERCISES.map((e) => `${e.td}:${e.number}`);
    expect(numbers).toEqual([
      'TD1:1.1', 'TD1:1.2', 'TD1:1.3', 'TD1:1.4', 'TD1:1.5', 'TD1:1.6',
      'TD2:2.1', 'TD2:2.2', 'TD2:2.3', 'TD2:2.4', 'TD2:2.5', 'TD2:2.6', 'TD2:2.7', 'TD2:2.8', 'TD2:2.9',
    ]);
    const partIds = EXERCISES.flatMap((e) => e.parts.map((p) => p.id.split(' ')[0]));
    for (const id of ['AD1.1', 'AD1.2', 'AD1.3', 'AD1.4', 'AD1.5', 'AD1.6', 'AD1.7', 'Q1.1', 'Q1.2', 'Q1.3', 'Q1.4', 'Q1.5', 'Q1.6', 'Q1.7', 'Q1.8',
      'AD2.1', 'AD2.2', 'AD2.3', 'AD2.4', 'AD2.5', 'AD2.6', 'AD2.7', 'AD2.8', 'AD2.9', 'AD2.10', 'AD2.11', 'AD2.12', 'AD2.13',
      'Q2.1', 'Q2.2', 'Q2.3', 'Q2.4', 'Q2.5', 'Q2.6', 'Q2.7', 'Q2.8', 'Q2.9', 'Q2.10', 'Q2.11', 'Q2.12',
      'ES2.1', 'ES2.2', 'ES2.3', 'ES2.4', 'ES2.5', 'ES2.6', 'ES2.7', 'ES2.8'])
      expect(partIds, id).toContain(id);
  });

  it('la banque QCM couvre chaque chapitre', () => {
    for (const ch of CHAPTERS) {
      const n = QUIZ_QUESTIONS.filter((q) => q.conceptIds.some((c) => c.startsWith(ch.id))).length;
      expect(n, ch.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('les générateurs sont déterministes et produisent des réponses finies et acceptées', () => {
    for (const g of GENERATORS) {
      for (const seed of [1, 42, 1234, 99999]) {
        const a = g.make(seed);
        const b = g.make(seed);
        expect(a.statement).toBe(b.statement);
        expect(Number.isFinite(a.question.answer.value), g.id).toBe(true);
        expect(a.question.answer.value, g.id).toBeGreaterThan(0);
        expect(checkNumeric(formatAnswer(a.question.answer), a.question.answer).correct, `${g.id}/${seed}`).toBe(true);
      }
    }
  });
});
