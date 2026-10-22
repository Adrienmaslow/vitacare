import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flag, Timer } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Md } from '@/components/ui/Math';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Switch';
import {
  initialDraft,
  QuestionInput,
  toGiven,
  type Draft,
} from '@/components/quizzes/QuestionInput';
import { conceptById } from '@/content';
import { evaluate, expectedDisplay } from '@/engines/assessment-engine/evaluate';
import { selectExam } from '@/features/assessment/select';
import { score20 } from '@/features/assessment/scoring';
import { recordAnswer, saveExam } from '@/db/repo';
import { randomSeed } from '@/lib/random';
import { cn } from '@/lib/cn';
import { useSettings } from '@/stores/settings';
import type { EvaluationResult, Question } from '@/types';

type Phase = 'setup' | 'running' | 'done';

interface Graded {
  question: Question;
  result: EvaluationResult;
  answered: boolean;
}

export default function ExamPage() {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>('setup');
  const [n, setN] = useState(settings.examQuestions);
  const [minutes, setMinutes] = useState(settings.examMinutes);
  const [seed, setSeed] = useState(randomSeed);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [graded, setGraded] = useState<Graded[]>([]);
  const startedAt = useRef(0);
  const submitting = useRef(false);

  function start() {
    const s = randomSeed();
    const qs = selectExam(n, s);
    setSeed(s);
    setQuestions(qs);
    setDrafts(qs.map((q) => initialDraft(q, s)));
    setIndex(0);
    setRemaining(minutes * 60);
    startedAt.current = Date.now();
    settings.set({ examQuestions: n, examMinutes: minutes });
    setPhase('running');
  }

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setConfirm(false);
    const at = Date.now();
    const results: Graded[] = questions.map((q, i) => {
      const given = toGiven(q, drafts[i]!);
      if (!given) {
        return {
          question: q,
          answered: false,
          result: {
            correct: false,
            score: 0,
            feedback: 'Sans réponse.',
            errorCategory: null,
            expectedDisplay: expectedDisplay(q),
            givenDisplay: '(sans réponse)',
          },
        };
      }
      return { question: q, answered: true, result: evaluate(q, given) };
    });
    for (const g of results) {
      await recordAnswer({
        question: g.question,
        result: g.result,
        context: 'exam',
        refId: `exam:${seed}`,
        label: 'Examen blanc',
        at,
      });
    }
    await saveExam({
      at,
      score20: score20(results),
      correct: results.filter((r) => r.result.correct).length,
      total: results.length,
      durationMs: at - startedAt.current,
      timeLimitMin: minutes,
      questionIds: questions.map((q) => q.id),
    });
    setGraded(results);
    setPhase('done');
    submitting.current = false;
  }

  useEffect(() => {
    if (phase !== 'running' || minutes === 0) return;
    const t = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase, minutes]);

  useEffect(() => {
    if (phase === 'running' && minutes > 0 && remaining === 0) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Examen blanc"
          subtitle="Conditions d’examen : questions et réponses mélangées, aucun indice, correction uniquement à la fin, note sur 20."
        />
        <Card className="grid gap-5 p-6">
          <div>
            <div className="mb-2 text-sm font-medium">Nombre de questions</div>
            <Segmented
              label="Nombre de questions"
              value={n}
              onChange={setN}
              options={[10, 20, 30].map((v) => ({ value: v, label: String(v) }))}
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Chronomètre</div>
            <Segmented
              label="Durée"
              value={minutes}
              onChange={setMinutes}
              options={[
                { value: 15, label: '15 min' },
                { value: 30, label: '30 min' },
                { value: 45, label: '45 min' },
                { value: 60, label: '60 min' },
                { value: 0, label: 'Sans limite' },
              ]}
            />
          </div>
          <ul className="list-disc pl-5 text-sm text-muted">
            <li>Questions tirées des trois chapitres, notions réparties équitablement.</li>
            <li>À la fin du temps, la copie est rendue automatiquement.</li>
            <li>Les résultats alimentent tes statistiques et ta maîtrise estimée.</li>
          </ul>
          <Button size="lg" icon={<Timer size={18} />} onClick={start}>
            Commencer l’examen
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === 'running') {
    const q = questions[index]!;
    const answeredCount = questions.filter((qq, i) => toGiven(qq, drafts[i]!) !== null).length;
    return (
      <div className="mx-auto max-w-3xl">
        <div className="sticky top-14 z-20 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur lg:top-0">
          <span className="text-sm font-medium">
            Question {index + 1}/{questions.length} · {answeredCount} répondue
            {answeredCount > 1 ? 's' : ''}
          </span>
          {minutes > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold tabular-nums',
                remaining < 60 ? 'text-danger' : 'text-primary',
              )}
              role="timer"
              aria-label="Temps restant"
            >
              <Clock size={16} aria-hidden />
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={<Flag size={15} />}
            onClick={() => setConfirm(true)}
          >
            Rendre
          </Button>
        </div>
        <Card className="p-5 sm:p-6">
          <Md text={q.prompt} className="mb-4 text-[1.02rem]" />
          <QuestionInput
            question={q}
            draft={drafts[index]!}
            seed={seed}
            disabled={false}
            onChange={(d) => setDrafts((prev) => prev.map((x, i) => (i === index ? d : x)))}
          />
        </Card>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={index === 0}
            icon={<ChevronLeft size={16} />}
            onClick={() => setIndex(index - 1)}
          >
            Précédente
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>
              Suivante <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)}>Rendre la copie</Button>
          )}
        </div>
        <nav className="mt-5 flex flex-wrap gap-1.5" aria-label="Aller à une question">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              aria-label={`Question ${i + 1}${toGiven(qq, drafts[i]!) ? ', répondue' : ''}`}
              className={cn(
                'h-9 w-9 rounded-lg border text-sm tabular-nums',
                i === index
                  ? 'border-primary bg-primary text-primary-contrast'
                  : toGiven(qq, drafts[i]!)
                    ? 'border-primary/40 bg-primary-soft'
                    : 'border-border bg-surface',
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>
        <Dialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Rendre la copie ?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Continuer
              </Button>
              <Button onClick={() => void submit()}>Rendre</Button>
            </>
          }
        >
          <p>
            {answeredCount}/{questions.length} questions répondues. Les questions sans réponse
            comptent zéro.
          </p>
        </Dialog>
      </div>
    );
  }

  const total = score20(graded);
  const byConcept = new Map<string, { ok: number; n: number }>();
  for (const g of graded)
    for (const c of g.question.conceptIds) {
      const v = byConcept.get(c) ?? { ok: 0, n: 0 };
      v.n += 1;
      v.ok += g.result.score;
      byConcept.set(c, v);
    }
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="Bilan de l’examen" />
      <Card className="p-6">
        <div className="text-4xl font-semibold text-navy tabular-nums">
          {total.toLocaleString('fr-FR')}
          <span className="text-xl text-muted">/20</span>
        </div>
        <p className="mt-1 text-muted">
          {graded.filter((g) => g.result.correct).length} réponses justes sur {graded.length} ·{' '}
          {total >= 14
            ? 'Très bon niveau.'
            : total >= 10
              ? 'Moyenne atteinte : consolide les notions en rouge.'
              : 'Encore fragile : revois les leçons des notions en rouge.'}
        </p>
        <div className="mt-4 grid gap-1.5 text-sm">
          {[...byConcept.entries()]
            .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)
            .map(([c, v]) => (
              <div key={c} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate">{conceptById(c)?.title}</span>
                <span
                  className={cn('tabular-nums', v.ok / v.n < 0.5 ? 'text-danger' : 'text-success')}
                >
                  {Math.round((v.ok / v.n) * 100)} %
                </span>
              </div>
            ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setPhase('setup')}>Nouvel examen</Button>
          <ButtonLink to="/statistiques" variant="secondary">
            Statistiques
          </ButtonLink>
          <ButtonLink to="/qcm/session?mode=erreurs" variant="secondary">
            Retravailler mes erreurs
          </ButtonLink>
        </div>
      </Card>
      <h2 className="text-lg font-semibold text-navy">Correction</h2>
      <ol className="grid gap-3">
        {graded.map((g, i) => (
          <li key={g.question.id}>
            <Card
              className={cn('p-4', g.result.correct ? 'border-success/40' : 'border-danger/40')}
            >
              <div className="text-sm font-semibold text-muted">
                Question {i + 1} ·{' '}
                {g.result.correct
                  ? 'juste'
                  : g.result.score > 0
                    ? 'partiellement juste'
                    : g.answered
                      ? 'fausse'
                      : 'sans réponse'}
              </div>
              <Md text={g.question.prompt} className="mt-1" />
              <p className="mt-2 text-sm">
                <span className="text-muted">Ta réponse : </span>
                {g.result.givenDisplay}
              </p>
              <p className="text-sm text-success">
                <span className="text-muted">Attendu : </span>
                {g.result.expectedDisplay}
              </p>
              <Md text={g.question.explanation} className="mt-2 text-sm text-muted" />
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
