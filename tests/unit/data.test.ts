import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import {
  addActiveTime,
  completeLesson,
  gradeCard,
  recordAnswer,
  resetAllProgress,
  startLesson,
  updateExercisePart,
} from '@/db/repo';
import { exportData, importData, ImportError, validateExport } from '@/db/backup';
import { evaluate } from '@/engines/assessment-engine/evaluate';
import { questionById, LESSONS } from '@/content';
import {
  derive,
  EMPTY_DATA,
  computeStreak,
  levelFromXp,
  type LearningData,
} from '@/features/progress/derive';
import { recommend } from '@/engines/recommendation-engine/recommend';
import { score20 } from '@/features/assessment/scoring';
import { addDays, dayKey } from '@/lib/dates';

async function load(): Promise<LearningData> {
  const meta = await db.meta.toArray();
  return {
    attempts: await db.attempts.toArray(),
    mistakes: await db.mistakes.toArray(),
    lessonProgress: await db.lessonProgress.toArray(),
    exerciseProgress: await db.exerciseProgress.toArray(),
    reviews: await db.reviews.toArray(),
    sessions: await db.sessions.toArray(),
    exams: await db.exams.toArray(),
    activeDays: meta.filter((m) => m.key.startsWith('active-')).map((m) => m.key.slice(7)),
  };
}

beforeEach(async () => {
  await resetAllProgress(true);
});

describe('enregistrement des réponses', () => {
  it('une mauvaise réponse crée une tentative et une erreur ; une bonne réponse la corrige', async () => {
    const q = questionById('ex-AD1.3')!;
    await recordAnswer({
      question: q,
      result: evaluate(q, { type: 'text', value: '2,6 Ω' }),
      context: 'exercise',
      refId: 'td1-ex1-2',
      label: 'AD1.3',
    });
    let mistakes = await db.mistakes.toArray();
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]!.category).toBe('unites');
    expect(mistakes[0]!.resolved).toBe(false);
    const a2 = await recordAnswer({
      question: q,
      result: evaluate(q, { type: 'text', value: '260 mΩ' }),
      context: 'exercise',
      refId: 'td1-ex1-2',
      label: 'AD1.3',
      hintsUsed: 2,
    });
    expect(a2.attemptNumber).toBe(2);
    expect(a2.hintsUsed).toBe(2);
    mistakes = await db.mistakes.toArray();
    expect(mistakes[0]!.resolved).toBe(true);
  });

  it('progression des parties d’exercice : indices conservés au maximum, réussite définitive', async () => {
    await updateExercisePart('td1-ex1-2', 'AD1.2', { hintsUsed: 1 });
    await updateExercisePart('td1-ex1-2', 'AD1.2', { correct: true, hintsUsed: 0 });
    const p = await db.exerciseProgress.get('td1-ex1-2');
    expect(p!.parts['AD1.2']).toEqual({ correct: true, hintsUsed: 1, correctionViewed: false });
  });
});

describe('progression du parcours vs maîtrise', () => {
  it('lire une leçon fait progresser le parcours mais pas la maîtrise', async () => {
    await startLesson('c1-l4');
    await completeLesson('c1-l4');
    const d = derive(await load(), { cours0Mode: 'complet' });
    expect(d.lessonsDone).toBe(1);
    expect(d.pathProgress).toBeCloseTo(1 / LESSONS.length);
    expect(d.mastery.get('c1-resistivite')!.score).toBe(0);
    expect(d.mastery.get('c1-resistivite')!.status).toBe('en-apprentissage');
    expect(d.lessonStatus.get('c1-l4')).toBe('termine');
    expect(d.lessonStatus.get('c1-l5')).toBe('a-decouvrir');
  });

  it('mode essentiel du cours 0 : le parcours ne compte que les outils utiles aux TD', () => {
    const e = derive(EMPTY_DATA, { cours0Mode: 'essentiel' });
    const c = derive(EMPTY_DATA, { cours0Mode: 'complet' });
    expect(e.pathLessons.length).toBeLessThan(c.pathLessons.length);
    expect(e.pathLessons.filter((l) => l.chapterId === 'c0').every((l) => l.essential)).toBe(true);
  });

  it('temps actif réel : sessions regroupées', async () => {
    const now = Date.now();
    await addActiveTime(30_000, now);
    await addActiveTime(30_000, now + 30_000);
    await addActiveTime(30_000, now + 30 * 60_000); // nouvelle session après une pause
    const s = await db.sessions.toArray();
    expect(s).toHaveLength(2);
    expect(
      derive(await load(), { cours0Mode: 'essentiel', now: now + 31 * 60_000 }).totalActiveMs,
    ).toBe(90_000);
  });

  it('série de jours et niveaux', () => {
    const t = dayKey();
    expect(computeStreak(new Set([t, addDays(t, -1), addDays(t, -2)]), t)).toBe(3);
    expect(computeStreak(new Set([addDays(t, -1)]), t)).toBe(1);
    expect(computeStreak(new Set([addDays(t, -3)]), t)).toBe(0);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
  });

  it('flashcards : notation persistée et carte due le lendemain', async () => {
    const s = await gradeCard('fc-c1-8', 'moyen');
    expect(s.due).toBe(addDays(dayKey(), 1));
    const d = derive(await load(), { cours0Mode: 'essentiel' });
    expect(d.dueCards).toBe(0);
  });
});

describe('recommandations', () => {
  it('premier lancement : diagnostic puis première leçon', () => {
    const d = derive(EMPTY_DATA, { cours0Mode: 'essentiel' });
    const recs = recommend(EMPTY_DATA, d, { diagnosticDone: false, dailyGoalMin: 30 });
    expect(recs[0]!.kind).toBe('diagnostic');
    expect(recs.some((r) => r.to === '/lecons/c0-l0')).toBe(true);
  });

  it('erreurs d’unités répétées : mini-QCM unités proposé avec sa raison', async () => {
    const q = questionById('q-c0-u3')!;
    for (let i = 0; i < 3; i++)
      await recordAnswer({
        question: q,
        result: evaluate(q, { type: 'text', value: '5e14 m^-3' }),
        context: 'quick',
        refId: `x${i}`,
        label: 'test',
      });
    const data = await load();
    const recs = recommend(data, derive(data, { cours0Mode: 'essentiel' }), {
      diagnosticDone: true,
      dailyGoalMin: 30,
    });
    const r = recs.find((x) => x.id === 'units-drill');
    expect(r).toBeDefined();
    expect(r!.reason).toMatch(/3 erreurs d’unités/);
  });

  it('prérequis non ouvert : la recommandation pointe vers le prérequis', async () => {
    await completeLesson('c0-l0');
    await completeLesson('c0-l2');
    await completeLesson('c0-l3');
    await completeLesson('c0-l4');
    // c1-l1 a pour prérequis c0-l2 (fait) ; c1-l4 a pour prérequis c1-l3 (non ouvert)
    await completeLesson('c1-l1');
    await completeLesson('c1-l2');
    const data = await load();
    const recs = recommend(data, derive(data, { cours0Mode: 'essentiel' }), {
      diagnosticDone: true,
      dailyGoalMin: 30,
    });
    expect(recs.some((r) => r.to === '/lecons/c1-l3')).toBe(true);
  });
});

describe('export / import', () => {
  it('aller-retour fidèle, versionné, sans les PDF locaux', async () => {
    const q = questionById('q-c0-o1')!;
    await recordAnswer({
      question: q,
      result: evaluate(q, { type: 'text', value: '2 V' }),
      context: 'lesson',
      refId: 'c0-l2',
      label: 'x',
    });
    await completeLesson('c0-l2');
    await db.docs.put({
      id: 'livret',
      name: 'l.pdf',
      size: 3,
      addedAt: 1,
      blob: new Blob(['abc']),
    });
    const file = await exportData({ theme: 'dark' });
    expect(file.app).toBe('ece-study');
    expect(file.formatVersion).toBe(1);
    expect('docs' in file.data).toBe(false);
    const json = JSON.parse(JSON.stringify(file));
    await resetAllProgress();
    expect(await db.attempts.count()).toBe(0);
    const { counts } = await importData(json);
    expect(counts.attempts).toBe(1);
    expect(await db.lessonProgress.get('c0-l2')).toBeDefined();
  });

  it('refuse les fichiers invalides avec un message clair', () => {
    expect(() => validateExport(null)).toThrow(ImportError);
    expect(() => validateExport({ app: 'autre' })).toThrow(/ECE STUDY/);
    expect(() => validateExport({ app: 'ece-study', formatVersion: 99, data: {} })).toThrow(
      /plus récente/,
    );
    expect(() =>
      validateExport({
        app: 'ece-study',
        formatVersion: 1,
        data: { attempts: [{ questionId: 3 }] },
      }),
    ).toThrow(/attempts/);
  });

  it('un import invalide ne modifie pas les données existantes', async () => {
    await completeLesson('c0-l2');
    await expect(
      importData({ app: 'ece-study', formatVersion: 1, data: { reviews: [{ cardId: 1 }] } }),
    ).rejects.toThrow();
    expect(await db.lessonProgress.count()).toBe(1);
  });
});

describe('notation de l’examen', () => {
  it('note sur 20 avec scores partiels', () => {
    expect(score20([{ result: { score: 1 } }, { result: { score: 0 } }])).toBe(10);
    expect(
      score20([{ result: { score: 1 } }, { result: { score: 1 / 3 } }, { result: { score: 0 } }]),
    ).toBe(8.9);
    expect(score20([])).toBe(0);
  });
});
