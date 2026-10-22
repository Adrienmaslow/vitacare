import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Md } from '@/components/ui/Math';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Switch';
import { CHAPTERS, FLASHCARDS, FLASHCARD_KIND_LABEL } from '@/content';
import { gradeCard } from '@/db/repo';
import { newSchedule, review } from '@/engines/spaced-repetition/srs';
import { useDerived } from '@/hooks/useLearning';
import { dayKey } from '@/lib/dates';
import { useUi } from '@/stores/ui';
import type { Flashcard, ReviewGrade } from '@/types';

const GRADES: { grade: ReviewGrade; label: string; cls: string }[] = [
  { grade: 'a-revoir', label: 'À revoir', cls: 'border-danger/40 text-danger' },
  { grade: 'difficile', label: 'Difficile', cls: 'border-warning/40 text-warning' },
  { grade: 'moyen', label: 'Moyen', cls: 'border-primary/40 text-primary' },
  { grade: 'facile', label: 'Facile', cls: 'border-success/40 text-success' },
];

const NEW_PER_SESSION = 10;

export default function FlashcardsPage() {
  const [params, setParams] = useSearchParams();
  const chapter = params.get('chapter') ?? 'all';
  const mode = (params.get('mode') as 'session' | 'dues' | 'parcourir' | null) ?? 'session';
  const { data } = useDerived();
  const toast = useUi((s) => s.toast);
  const today = dayKey();
  const schedules = useMemo(() => new Map(data.reviews.map((r) => [r.cardId, r])), [data.reviews]);

  const pool = FLASHCARDS.filter((c) => chapter === 'all' || c.chapterId === chapter);
  const due = pool.filter((c) => {
    const s = schedules.get(c.id);
    return s && s.due <= today;
  });
  const fresh = pool.filter((c) => !schedules.has(c.id));

  // File figée au début de la session ; les cartes « À revoir » sont remises en fin de file.
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [reviewedNow, setReviewedNow] = useState(0);

  const start = () => {
    const q = mode === 'dues' ? due : [...due, ...fresh.slice(0, NEW_PER_SESSION)];
    setQueue(q);
    setFlipped(false);
    setReviewedNow(0);
  };

  const card = queue?.[0];

  async function grade(g: ReviewGrade) {
    if (!card || !queue) return;
    await gradeCard(card.id, g);
    setReviewedNow((n) => n + 1);
    const rest = queue.slice(1);
    setQueue(g === 'a-revoir' ? [...rest, card] : rest);
    setFlipped(false);
    if (rest.length === 0 && g !== 'a-revoir')
      toast({
        title: 'Session terminée',
        description: 'Les prochaines cartes reviendront au moment opportun.',
        tone: 'success',
      });
  }

  const preview = (g: ReviewGrade) => {
    if (!card) return '';
    const s = review(schedules.get(card.id) ?? newSchedule(card.id, today), g);
    return s.intervalDays === 0
      ? 'aujourd’hui'
      : s.intervalDays === 1
        ? 'demain'
        : `dans ${s.intervalDays} j`;
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader
        title="Flashcards"
        subtitle="Répétition espacée : chaque carte revient juste avant que tu l’oublies."
      />
      <div className="flex flex-wrap gap-3">
        <Segmented
          label="Chapitre"
          value={chapter}
          onChange={(v) => {
            setQueue(null);
            setParams(v === 'all' ? {} : { chapter: v });
          }}
          options={[
            { value: 'all', label: 'Tous' },
            ...CHAPTERS.map((c) => ({ value: c.id, label: c.shortTitle })),
          ]}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="p-3">
          <div className="text-2xl font-semibold text-primary tabular-nums">{due.length}</div>
          <div className="text-xs text-muted">dues aujourd’hui</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-semibold text-navy tabular-nums">{fresh.length}</div>
          <div className="text-xs text-muted">jamais vues</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-semibold text-navy tabular-nums">
            {pool.length - fresh.length}
          </div>
          <div className="text-xs text-muted">en cours de mémorisation</div>
        </Card>
      </div>

      {!queue && (
        <Card className="grid gap-3 p-6">
          <p>
            {due.length + Math.min(fresh.length, NEW_PER_SESSION) === 0
              ? 'Aucune carte à réviser pour l’instant dans cette sélection.'
              : `Session : ${due.length} carte${due.length > 1 ? 's' : ''} due${due.length > 1 ? 's' : ''}${mode === 'dues' ? '' : ` + ${Math.min(fresh.length, NEW_PER_SESSION)} nouvelle${fresh.length > 1 ? 's' : ''}`}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={start}
              disabled={
                due.length + (mode === 'dues' ? 0 : Math.min(fresh.length, NEW_PER_SESSION)) === 0
              }
            >
              Commencer la session
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setParams({ ...(chapter !== 'all' ? { chapter } : {}), mode: 'parcourir' })
              }
            >
              Parcourir toutes les cartes
            </Button>
          </div>
          <p className="flex gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            Consulter une carte ne suffit pas à « maîtriser » une notion : la maîtrise estimée ne se
            calcule qu’à partir des QCM et des exercices.
          </p>
        </Card>
      )}

      {queue && card && (
        <div className="grid gap-4">
          <div className="text-sm text-muted">
            {queue.length} carte{queue.length > 1 ? 's' : ''} restante{queue.length > 1 ? 's' : ''}{' '}
            · {reviewedNow} révisée{reviewedNow > 1 ? 's' : ''}
          </div>
          <button
            type="button"
            onClick={() => setFlipped(!flipped)}
            aria-label={
              flipped ? 'Retourner la carte (recto)' : 'Retourner la carte (voir la réponse)'
            }
            className="min-h-64 rounded-3xl border border-border bg-surface p-6 text-left shadow-card transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <Badge tone="primary">{FLASHCARD_KIND_LABEL[card.kind]}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <RotateCw size={13} aria-hidden /> {flipped ? 'verso' : 'recto'}
              </span>
            </div>
            <div key={String(flipped)} className="animate-flip mt-6 text-lg leading-relaxed">
              {flipped ? (
                <Md text={card.back} />
              ) : (
                <Md text={card.front} className="font-medium text-navy" />
              )}
            </div>
            {!flipped && (
              <div className="mt-6 text-sm text-muted">Touche la carte pour voir la réponse.</div>
            )}
          </button>
          {flipped && (
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label="Évaluer ta réponse"
            >
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  type="button"
                  onClick={() => void grade(g.grade)}
                  className={`rounded-xl border bg-surface px-3 py-3 text-sm font-medium hover:bg-surface-2 ${g.cls}`}
                >
                  {g.label}
                  <span className="block text-xs font-normal text-muted">{preview(g.grade)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {queue && !card && (
        <EmptyState
          title="Session terminée"
          action={<Button onClick={() => setQueue(null)}>Retour</Button>}
        >
          {reviewedNow} révision{reviewedNow > 1 ? 's' : ''} enregistrée{reviewedNow > 1 ? 's' : ''}
          .
        </EmptyState>
      )}

      {mode === 'parcourir' && !queue && (
        <section aria-label="Toutes les cartes" className="grid gap-2">
          {pool.map((c) => {
            const s = schedules.get(c.id);
            return (
              <details key={c.id} className="rounded-xl border border-border bg-surface p-4">
                <summary className="cursor-pointer">
                  <Md text={c.front} as="span" className="font-medium" />
                  <span className="ml-2 text-xs text-muted">
                    {FLASHCARD_KIND_LABEL[c.kind]}
                    {s ? ` · prochaine révision ${s.due}` : ' · jamais vue'}
                  </span>
                </summary>
                <Md text={c.back} className="mt-2 text-muted" />
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
