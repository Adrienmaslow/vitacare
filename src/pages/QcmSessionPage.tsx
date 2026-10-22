import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink, Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/misc';
import { QuizSession } from '@/components/quizzes/QuizSession';
import { selectQuestions, type QcmMode } from '@/features/assessment/select';
import { setMeta } from '@/db/repo';
import { useDerived } from '@/hooks/useLearning';
import { randomSeed } from '@/lib/random';
import { useSettings } from '@/stores/settings';
import type { AttemptContext } from '@/types';

const CONTEXT: Record<QcmMode, AttemptContext> = {
  lecon: 'lesson',
  chapitre: 'chapter',
  td: 'td',
  erreurs: 'errors',
  rapide: 'quick',
  concept: 'chapter',
};

export default function QcmSessionPage() {
  const [params] = useSearchParams();
  const { data, derived, loading } = useDerived();
  const difficulty = useSettings((s) => s.preferredDifficulty);
  const [seed, setSeed] = useState(randomSeed);
  const mode = (params.get('mode') as QcmMode) || 'rapide';
  const key = params.toString();
  // La sélection est figée au démarrage de la session (elle ne change pas à chaque réponse enregistrée).
  const sel = useMemo(
    () =>
      loading
        ? null
        : selectQuestions(
            {
              mode,
              lesson: params.get('lesson') ?? undefined,
              chapter: params.get('chapter') ?? undefined,
              td: params.get('td') ?? undefined,
              concepts: params.get('concepts')?.split(','),
              n: params.get('n') ? Number(params.get('n')) : undefined,
              difficulty,
            },
            data,
            derived,
            seed,
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, seed, loading],
  );
  if (!sel) return <div className="h-40" aria-busy="true" />;
  const refId = `${mode}:${params.get('chapter') ?? params.get('lesson') ?? params.get('td') ?? ''}:${seed}`;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={sel.title}
        subtitle={`${sel.questions.length} question${sel.questions.length > 1 ? 's' : ''} · correction immédiate`}
      />
      <QuizSession
        key={`${key}-${seed}`}
        questions={sel.questions}
        context={CONTEXT[mode]}
        refId={refId}
        label={sel.title}
        timeLimitSec={sel.timeLimitSec}
        onFinish={(results) => {
          if (mode === 'chapitre' && params.get('chapter') && results.length) {
            const score = results.filter((r) => r.result.correct).length / results.length;
            void setMeta(`chapterQuiz-${params.get('chapter')}`, { score, at: Date.now() });
          }
        }}
        finishActions={() => (
          <>
            <Button onClick={() => setSeed(randomSeed())}>Nouvelle session</Button>
            <ButtonLink to="/qcm" variant="secondary">
              Autres modes
            </ButtonLink>
          </>
        )}
      />
    </div>
  );
}
