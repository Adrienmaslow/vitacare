import { useMemo, useState } from 'react';
import { CheckCircle2, Compass, RotateCcw, XCircle } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/misc';
import { QuizSession, type SessionResult } from '@/components/quizzes/QuizSession';
import { DIAGNOSTIC_LESSON_IDS, lessonById, questionById } from '@/content';
import { completeLesson, setMeta } from '@/db/repo';
import { useUi } from '@/stores/ui';
import type { Question } from '@/types';

/**
 * Diagnostic initial du cours 0 : 3 questions par outil du parcours essentiel.
 * Un outil réussi à 3/3 est validé (la leçon est marquée « validée par un test »).
 */
export default function DiagnosticPage() {
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [results, setResults] = useState<SessionResult[]>([]);
  const toast = useUi((s) => s.toast);
  const lessons = DIAGNOSTIC_LESSON_IDS.map((id) => lessonById(id)!);
  const questions = useMemo(
    () =>
      lessons.flatMap((l) =>
        (l.skipTestQuestionIds ?? [])
          .map((id) => questionById(id))
          .filter((q): q is Question => !!q),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const verdict = lessons.map((l) => {
    const ids = new Set(l.skipTestQuestionIds);
    const rs = results.filter((r) => ids.has(r.question.id));
    const ok = rs.filter((r) => r.result.correct).length;
    return { lesson: l, ok, n: rs.length, validated: rs.length > 0 && ok === rs.length };
  });

  async function onFinish(rs: SessionResult[]) {
    setResults(rs);
    await setMeta('diagnosticDone', true);
    for (const l of lessons) {
      const ids = new Set(l.skipTestQuestionIds);
      const sub = rs.filter((r) => ids.has(r.question.id));
      if (sub.length && sub.every((r) => r.result.correct)) await completeLesson(l.id, true);
    }
    setPhase('done');
    toast({ title: 'Diagnostic enregistré', tone: 'success' });
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Cours 0 · Révisions ING1"
          title="Test diagnostic"
          subtitle="Tu connais déjà ces outils ? Réponds à 3 questions par outil pour valider ce prérequis et passer directement à la suite."
        />
        <Card className="grid gap-4 p-6">
          <ul className="grid gap-2">
            {lessons.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <Compass size={16} className="text-primary" aria-hidden /> {l.title}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            {questions.length} questions, environ 6 minutes. Un outil réussi à 3/3 est validé ;
            sinon, la leçon correspondante t’est recommandée.
          </p>
          <Button size="lg" onClick={() => setPhase('run')}>
            Commencer
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === 'run') {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Test diagnostic" />
        <QuizSession
          questions={questions}
          context="diagnostic"
          refId="diagnostic-c0"
          label="Diagnostic cours 0"
          onFinish={onFinish}
        />
      </div>
    );
  }

  const toStudy = verdict.filter((v) => !v.validated);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Résultat du diagnostic" />
      <Card className="grid gap-3 p-6">
        {verdict.map((v) => (
          <div key={v.lesson.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            {v.validated ? (
              <CheckCircle2 className="text-success" aria-hidden />
            ) : (
              <XCircle className="text-danger" aria-hidden />
            )}
            <span className="min-w-0 flex-1">{v.lesson.title}</span>
            <span className="text-sm tabular-nums text-muted">
              {v.ok}/{v.n}
            </span>
          </div>
        ))}
        <p className="mt-2 text-muted">
          {toStudy.length === 0
            ? 'Tous les outils essentiels sont validés : tu peux passer directement au cours 1.'
            : `À revoir en priorité : ${toStudy.map((v) => v.lesson.title).join(', ')}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {toStudy[0] ? (
            <ButtonLink to={`/lecons/${toStudy[0].lesson.id}`}>
              Commencer par « {toStudy[0].lesson.title} »
            </ButtonLink>
          ) : (
            <ButtonLink to="/chapitres/c1">Aller au cours 1</ButtonLink>
          )}
          <Button
            variant="secondary"
            icon={<RotateCcw size={16} />}
            onClick={() => setPhase('run')}
          >
            Refaire le test
          </Button>
        </div>
      </Card>
    </div>
  );
}
