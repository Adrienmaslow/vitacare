import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Md } from '@/components/ui/Math';
import { SourceTag } from '@/components/ui/misc';
import { evaluate } from '@/engines/assessment-engine/evaluate';
import { recordAnswer } from '@/db/repo';
import { playFeedback } from '@/lib/sound';
import { useUi } from '@/stores/ui';
import type { AttemptContext, EvaluationResult, Question, QuizAttempt } from '@/types';
import { initialDraft, QuestionInput, toGiven, type Draft } from './QuestionInput';

const ERROR_LABEL: Record<string, string> = {
  unites: 'Erreur probable : unités / conversion',
  signe: 'Erreur probable : signe',
};

/**
 * Question en mode « correction immédiate ». La bonne réponse n'est jamais affichée avant validation.
 * Chaque validation est enregistrée (tentatives, erreurs) dans IndexedDB.
 */
export function QuestionCard({
  question,
  context,
  refId,
  label,
  seed,
  hintsUsed = 0,
  prompt,
  onAnswered,
  footer,
  allowRetry = true,
  hidePrompt = false,
}: {
  question: Question;
  context: AttemptContext;
  refId: string;
  label: string;
  seed: number;
  hintsUsed?: number;
  /** Énoncé affiché (par défaut, question.prompt). */
  prompt?: string;
  onAnswered?: (r: EvaluationResult, attempt: QuizAttempt) => void;
  /** Actions supplémentaires après correction (Continuer…). */
  footer?: (r: EvaluationResult) => ReactNode;
  allowRetry?: boolean;
  hidePrompt?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(question, seed));
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());
  const feedbackRef = useRef<HTMLDivElement>(null);
  const openExplain = useUi((s) => s.openExplain);

  useEffect(() => {
    setDraft(initialDraft(question, seed));
    setResult(null);
    startedAt.current = Date.now();
  }, [question, seed]);

  const given = toGiven(question, draft);

  async function submit() {
    if (!given || result || saving) return;
    setSaving(true);
    const r = evaluate(question, given);
    try {
      const attempt = await recordAnswer({
        question,
        result: r,
        context,
        refId,
        label,
        hintsUsed,
        durationMs: Date.now() - startedAt.current,
      });
      setResult(r);
      playFeedback(r.correct ? 'success' : 'error');
      onAnswered?.(r, attempt);
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  function retry() {
    setDraft(initialDraft(question, seed + 1));
    setResult(null);
    startedAt.current = Date.now();
  }

  return (
    <div className="grid gap-4">
      {!hidePrompt && (
        <div className="text-[1.02rem] leading-relaxed text-text">
          <Md text={prompt ?? question.prompt} />
        </div>
      )}
      <QuestionInput
        question={question}
        draft={draft}
        onChange={setDraft}
        disabled={!!result}
        seed={seed}
        result={result}
        onSubmit={submit}
      />

      {!result && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={!given || saving}>
            Valider
          </Button>
          <Button
            variant="ghost"
            icon={<CircleHelp size={16} />}
            onClick={() => openExplain({ conceptIds: question.conceptIds })}
          >
            Explique-moi
          </Button>
        </div>
      )}

      {result && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="status"
          className={`animate-pop rounded-2xl border p-4 outline-none ${result.correct ? 'border-success/40 bg-success-soft' : 'border-danger/40 bg-danger-soft'}`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {result.correct ? (
              <CheckCircle2 className="text-success" size={20} />
            ) : (
              <XCircle className="text-danger" size={20} />
            )}
            <span className={result.correct ? 'text-success' : 'text-danger'}>
              {result.correct
                ? 'Correct'
                : result.score > 0
                  ? `Partiellement juste (${Math.round(result.score * 100)} %)`
                  : 'Pas tout à fait'}
            </span>
          </div>
          {question.type === 'numeric' && (
            <p className="mt-1 text-sm text-text">{result.feedback}</p>
          )}
          {(question.type === 'matching' ||
            question.type === 'ordering' ||
            question.type === 'selfcheck') && (
            <p className="mt-1 text-sm text-text">{result.feedback}</p>
          )}
          {!result.correct && result.errorCategory && ERROR_LABEL[result.errorCategory] && (
            <p className="mt-1 text-sm font-medium text-text">
              {ERROR_LABEL[result.errorCategory]}
            </p>
          )}
          {!result.correct && question.type !== 'selfcheck' && (
            <p className="mt-2 text-sm text-text">
              <span className="font-medium">Réponse attendue : </span>
              {result.expectedDisplay}
            </p>
          )}
          <div className="mt-3 border-t border-black/5 pt-3 text-sm text-text dark:border-white/10">
            <Md text={question.explanation} />
          </div>
          {question.source && <SourceTag source={question.source} className="mt-2" />}
          <div className="mt-3 flex flex-wrap gap-2">
            {!result.correct && allowRetry && (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={15} />} onClick={retry}>
                Réessayer
              </Button>
            )}
            {!result.correct && (
              <Button
                variant="ghost"
                size="sm"
                icon={<CircleHelp size={15} />}
                onClick={() => openExplain({ conceptIds: question.conceptIds })}
              >
                Revoir la notion
              </Button>
            )}
            {footer?.(result)}
          </div>
        </div>
      )}
    </div>
  );
}
