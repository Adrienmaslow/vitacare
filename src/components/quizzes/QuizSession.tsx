import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Md } from '@/components/ui/Math';
import { conceptById } from '@/content';
import { randomSeed } from '@/lib/random';
import type { AttemptContext, EvaluationResult, Question } from '@/types';
import { QuestionCard } from './QuestionCard';

export interface SessionResult {
  question: Question;
  result: EvaluationResult;
}

/**
 * Enchaîne des questions avec correction immédiate, puis affiche un bilan.
 * Si `timeLimitSec` est défini (mode rapide), la session s'arrête à la fin du temps.
 */
export function QuizSession({
  questions,
  context,
  refId,
  label,
  timeLimitSec,
  onFinish,
  finishActions,
}: {
  questions: Question[];
  context: AttemptContext;
  refId: string;
  label: string;
  timeLimitSec?: number;
  onFinish?: (results: SessionResult[]) => void;
  finishActions?: (results: SessionResult[]) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seed] = useState(randomSeed);
  const [remaining, setRemaining] = useState(timeLimitSec ?? 0);

  useEffect(() => {
    if (!timeLimitSec || finished) return;
    const t = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(t);
  }, [timeLimitSec, finished]);

  useEffect(() => {
    if (timeLimitSec && remaining === 0 && !finished && !answered) finish(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function finish(final: SessionResult[]) {
    setFinished(true);
    onFinish?.(final);
  }

  const q = questions[index];
  const correct = results.filter((r) => r.result.correct).length;

  if (questions.length === 0) {
    return <p className="text-muted">Aucune question disponible pour cette sélection.</p>;
  }

  if (finished || !q) {
    return <SessionSummary results={results} actions={finishActions?.(results)} />;
  }

  const next = () => {
    setAnswered(false);
    if (index + 1 >= questions.length || (timeLimitSec && remaining === 0)) finish(results);
    else setIndex(index + 1);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <ProgressBar
          value={(index + (answered ? 1 : 0)) / questions.length}
          label="Progression de la session"
        />
        <span className="shrink-0 text-sm text-muted tabular-nums">
          {index + 1}/{questions.length}
        </span>
        {timeLimitSec && (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary tabular-nums"
            aria-live="off"
          >
            <Clock size={15} aria-hidden />
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted">
          {q.conceptIds.map((c) => (
            <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5">
              {conceptById(c)?.title}
            </span>
          ))}
        </div>
        <QuestionCard
          key={`${q.id}-${index}`}
          question={q}
          context={context}
          refId={refId}
          label={label}
          seed={seed + index}
          allowRetry={false}
          onAnswered={(r) => {
            setAnswered(true);
            setResults((prev) => [...prev, { question: q, result: r }]);
          }}
          footer={() => (
            <Button size="sm" onClick={next} icon={<ArrowRight size={15} />}>
              {index + 1 >= questions.length || (timeLimitSec && remaining === 0)
                ? 'Voir le bilan'
                : 'Question suivante'}
            </Button>
          )}
        />
      </Card>
      <p className="text-center text-sm text-muted">
        {correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {results.length}
      </p>
    </div>
  );
}

export function SessionSummary({
  results,
  actions,
}: {
  results: SessionResult[];
  actions?: ReactNode;
}) {
  const correct = results.filter((r) => r.result.correct).length;
  const total = results.length;
  const ratio = total ? correct / total : 0;
  const byConcept = useMemo(() => {
    const m = new Map<string, { ok: number; n: number }>();
    for (const r of results)
      for (const c of r.question.conceptIds) {
        const v = m.get(c) ?? { ok: 0, n: 0 };
        v.n += 1;
        if (r.result.correct) v.ok += 1;
        m.set(c, v);
      }
    return [...m.entries()].sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  }, [results]);
  return (
    <Card className="animate-pop p-6">
      <div className="flex items-center gap-3">
        <Trophy className="text-primary" />
        <h2 className="text-xl font-semibold text-navy">Bilan de la session</h2>
      </div>
      <p className="mt-2 text-3xl font-semibold text-navy tabular-nums">
        {correct}/{total}
        <span className="ml-2 text-base font-normal text-muted">({Math.round(ratio * 100)} %)</span>
      </p>
      <p className="mt-1 text-muted">
        {total === 0
          ? 'Aucune question traitée.'
          : ratio >= 0.8
            ? 'Très bon résultat. Pense à revenir sur ces notions dans quelques jours pour ancrer la mémoire.'
            : ratio >= 0.5
              ? 'Des bases solides, mais quelques notions restent à consolider.'
              : 'Ces notions sont encore fragiles : revois les leçons concernées puis refais une session.'}
      </p>
      {byConcept.length > 0 && (
        <div className="mt-4 grid gap-2">
          <h3 className="text-sm font-semibold text-navy">Par notion</h3>
          {byConcept.map(([c, v]) => (
            <div key={c} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{conceptById(c)?.title ?? c}</span>
              <span className="tabular-nums text-muted">
                {v.ok}/{v.n}
              </span>
            </div>
          ))}
        </div>
      )}
      {results.some((r) => !r.result.correct) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Revoir les réponses fausses
          </summary>
          <ul className="mt-2 grid gap-3">
            {results
              .filter((r) => !r.result.correct)
              .map((r, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <Md text={r.question.prompt} />
                  <p className="mt-1 text-muted">Ta réponse : {r.result.givenDisplay || '—'}</p>
                  <p className="text-success">Attendu : {r.result.expectedDisplay}</p>
                </li>
              ))}
          </ul>
        </details>
      )}
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
