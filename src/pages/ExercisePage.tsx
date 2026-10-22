import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BadgeAlert,
  BookOpenCheck,
  CircleHelp,
  ExternalLink,
  Eye,
  FileText,
  LifeBuoy,
  Repeat,
  Target,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Md } from '@/components/ui/Math';
import { DIFFICULTY_LABEL, SourceTag } from '@/components/ui/misc';
import { QuestionCard } from '@/components/quizzes/QuestionCard';
import { conceptById, exerciseById, lessonById } from '@/content';
import { db } from '@/db';
import { updateExercisePart } from '@/db/repo';
import { useDerived } from '@/hooks/useLearning';
import { openLocalDoc } from '@/lib/localDocs';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';
import type { Exercise, ExercisePart } from '@/types';
import NotFoundPage from './NotFoundPage';

const HINT_LABEL = ['Orientation', 'Outil', 'Démarrage'];

export default function ExercisePage() {
  const { exerciseId = '' } = useParams();
  const exercise = exerciseById(exerciseId);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [exerciseId]);
  if (!exercise) return <NotFoundPage />;
  return <ExerciseView exercise={exercise} active={active} setActive={setActive} />;
}

function ExerciseView({
  exercise: ex,
  active,
  setActive,
}: {
  exercise: Exercise;
  active: number;
  setActive: (i: number) => void;
}) {
  const { data } = useDerived();
  const progress = data.exerciseProgress.find((p) => p.exerciseId === ex.id);
  const hasPdf = useLiveQuery(() => db.docs.get('livret').then(Boolean), []);
  const part = ex.parts[active]!;
  const allDone = ex.parts.every(
    (p) => progress?.parts[p.id]?.correct || progress?.parts[p.id]?.correctionViewed,
  );
  const firstPage = Number.parseInt(ex.source.pages, 10);

  return (
    <div className="grid gap-5">
      <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
        <Link to="/exercices" className="hover:underline">
          Exercices
        </Link>{' '}
        /{' '}
        <Link to={`/exercices?td=${ex.td}`} className="hover:underline">
          {ex.td}
        </Link>
      </nav>
      <header>
        <div className="text-sm font-medium text-primary">
          {ex.td} · {ex.section} · Exercice {ex.number}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy sm:text-[1.75rem]">
          {ex.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{DIFFICULTY_LABEL[ex.difficulty]}</Badge>
          <Badge>
            {ex.parts.length} question{ex.parts.length > 1 ? 's' : ''}
          </Badge>
          <SourceTag source={ex.source} />
        </div>
      </header>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <FileText size={18} className="text-primary" aria-hidden /> A. Énoncé
        </h2>
        <Md text={ex.statement} className="mt-2 leading-relaxed" />
        {ex.data.length > 0 && (
          <dl className="mt-3 grid gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            {ex.data.map((d) => (
              <div
                key={d.label}
                className="grid gap-0.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-3"
              >
                <dt className="font-medium text-muted">{d.label}</dt>
                <dd>
                  <Md text={d.value} as="span" />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {ex.figure && (
          <p className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted">
            <span className="font-medium text-text">{ex.figure.label}</span> —{' '}
            {ex.figure.description} Voir le livret, p. {ex.figure.page}.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>
            Énoncé reformulé fidèlement (données d’origine intégralement conservées) : le texte
            original n’est pas republié sur ce site public.
          </span>
          {hasPdf ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-primary"
              onClick={() => void openLocalDoc('livret', firstPage)}
            >
              <ExternalLink size={13} /> Ouvrir mon livret, p. {firstPage}
            </button>
          ) : (
            <Link to="/ressources#documents" className="font-medium text-primary">
              Importer mon livret PDF (local)
            </Link>
          )}
        </div>
        {ex.auditNotes && (
          <ul className="mt-3 grid gap-1 text-xs text-warning">
            {ex.auditNotes.map((n) => (
              <li key={n}>Note d’audit : {n}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <Target size={18} className="text-primary" aria-hidden /> B. Objectif
          </h2>
          <p className="mt-1">{ex.objective}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ex.skills.map((s) => (
              <Badge key={s} tone="primary">
                {s}
              </Badge>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <BookOpenCheck size={18} className="text-primary" aria-hidden /> C. Prérequis
          </h2>
          <ul className="mt-1 grid gap-1 text-sm">
            {ex.prerequisiteLessonIds.map((id) => {
              const l = lessonById(id);
              return (
                l && (
                  <li key={id}>
                    <Link to={`/lecons/${id}`} className="text-primary hover:underline">
                      {l.title}
                    </Link>
                  </li>
                )
              );
            })}
          </ul>
        </Card>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Questions de l’exercice"
      >
        {ex.parts.map((p, i) => {
          const st = progress?.parts[p.id];
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 rounded-xl border px-3 py-2 text-sm font-medium',
                i === active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface hover:bg-surface-2',
                st?.correct && i !== active && 'border-success/50 text-success',
              )}
            >
              {p.id}
              {st?.correct ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <PartView
        key={`${ex.id}-${part.id}`}
        exercise={ex}
        part={part}
        onNext={active < ex.parts.length - 1 ? () => setActive(active + 1) : undefined}
      />

      {allDone && <ExerciseReview exercise={ex} />}
    </div>
  );
}

function PartView({
  exercise: ex,
  part,
  onNext,
}: {
  exercise: Exercise;
  part: ExercisePart;
  onNext?: () => void;
}) {
  const { data } = useDerived();
  const stored = data.exerciseProgress.find((p) => p.exerciseId === ex.id)?.parts[part.id];
  const [hints, setHints] = useState(0);
  const [showCorrection, setShowCorrection] = useState(false);
  const openExplain = useUi((s) => s.openExplain);
  const effectiveHints = showCorrection ? 3 : hints;
  const rephrase = useMemo(() => `${ex.objective} Ici : ${part.prompt}`, [ex, part]);

  async function revealHint() {
    const n = Math.min(3, hints + 1);
    setHints(n);
    await updateExercisePart(ex.id, part.id, { hintsUsed: n });
  }
  async function revealCorrection() {
    setShowCorrection(true);
    await updateExercisePart(ex.id, part.id, { correctionViewed: true, hintsUsed: 3 });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-navy">
          {part.id}
          {stored?.correct && (
            <span className="ml-2 text-sm font-medium text-success">réussie</span>
          )}
        </h2>
        <Badge tone={part.correctionOrigin === 'livret' ? 'neutral' : 'teal'}>
          {part.correctionOrigin === 'livret'
            ? 'Correction présente dans le livret'
            : 'Correction calculée par ECE STUDY'}
        </Badge>
      </div>
      <Md text={part.prompt} className="mt-2 text-[1.02rem] font-medium" />

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-muted">
          D–F. Ta réponse et sa vérification
        </div>
        <QuestionCard
          question={part.question}
          context="exercise"
          refId={ex.id}
          label={`${ex.td} · Ex. ${ex.number} · ${part.id}`}
          seed={1}
          hintsUsed={effectiveHints}
          hidePrompt
          onAnswered={(r) => {
            if (r.correct)
              void updateExercisePart(ex.id, part.id, { correct: true, hintsUsed: effectiveHints });
          }}
          footer={(r) => (
            <>
              {!showCorrection && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Eye size={15} />}
                  onClick={revealCorrection}
                >
                  Voir la correction
                </Button>
              )}
              {r.correct && onNext && (
                <Button size="sm" onClick={onNext}>
                  Question suivante
                </Button>
              )}
            </>
          )}
        />
      </div>

      <section className="mt-5 rounded-2xl bg-surface-2 p-4" aria-label="Aide progressive">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-navy">
            <LifeBuoy size={17} className="text-primary" aria-hidden /> E. Aide progressive
          </h3>
          <span className="text-xs text-muted">
            Une réussite après des indices compte moins pour la maîtrise qu’une réussite autonome.
          </span>
        </div>
        <ol className="mt-2 grid gap-2">
          {part.hints.slice(0, hints).map((h) => (
            <li key={h.level} className="animate-pop rounded-xl bg-surface p-3 text-[0.95rem]">
              <div className="text-xs font-semibold tracking-wide text-primary uppercase">
                Indice {h.level} · {HINT_LABEL[h.level - 1]}
              </div>
              <Md text={h.md} className="mt-1" />
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {hints < 3 && (
            <Button size="sm" variant="secondary" onClick={revealHint}>
              {hints === 0 ? 'Je suis bloqué' : `Indice suivant (${hints + 1}/3)`}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<CircleHelp size={15} />}
            onClick={() => openExplain({ conceptIds: part.question.conceptIds, rephrase })}
          >
            Revoir la notion
          </Button>
          {!showCorrection && (
            <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={revealCorrection}>
              Voir la correction
            </Button>
          )}
          {part.similarGeneratorId && (
            <ButtonLink
              size="sm"
              variant="ghost"
              icon={<Repeat size={15} />}
              to={`/exercices/entrainement/${part.similarGeneratorId}`}
            >
              Exercice similaire
            </ButtonLink>
          )}
        </div>
      </section>

      {showCorrection && (
        <section
          className="animate-pop mt-5 rounded-2xl border border-border p-4"
          aria-label="Correction"
        >
          <h3 className="font-semibold text-navy">G. Correction détaillée</h3>
          <ol className="mt-2 grid gap-3">
            {part.correction.map((s, i) => (
              <li key={i} className="text-[0.97rem]">
                {s.title && <div className="text-sm font-semibold text-primary">{s.title}</div>}
                <Md text={s.md} />
              </li>
            ))}
          </ol>
          {part.erratum && (
            <div className="mt-3 flex gap-2 rounded-xl bg-danger-soft p-3 text-sm">
              <BadgeAlert size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
              <div>
                <span className="font-semibold text-danger">Écart relevé dans le livret : </span>
                {part.erratum}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {part.correctionOrigin === 'livret'
              ? 'Raisonnement rédigé par ECE STUDY à partir de la correction du livret ; résultats recalculés et vérifiés.'
              : 'Le livret ne fournit pas de correction pour cette question : corrigé calculé par ECE STUDY, à confronter à la correction donnée en TD.'}
          </p>
        </section>
      )}
    </Card>
  );
}

function ExerciseReview({ exercise: ex }: { exercise: Exercise }) {
  const { data } = useDerived();
  const p = data.exerciseProgress.find((x) => x.exerciseId === ex.id);
  const attempts = data.attempts.filter((a) => a.refId === ex.id && a.context === 'exercise');
  const autonomous = ex.parts.filter(
    (part) => p?.parts[part.id]?.correct && (p.parts[part.id]?.hintsUsed ?? 0) === 0,
  ).length;
  const withHelp = ex.parts.filter(
    (part) => p?.parts[part.id]?.correct && (p.parts[part.id]?.hintsUsed ?? 0) > 0,
  ).length;
  const notSolved = ex.parts.filter((part) => !p?.parts[part.id]?.correct);
  const mistakes = data.mistakes.filter((m) => m.refId === ex.id);
  return (
    <Card className="animate-pop p-5">
      <h2 className="text-lg font-semibold text-navy">H. Bilan de l’exercice</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-success-soft p-3">
          <div className="text-2xl font-semibold text-success tabular-nums">{autonomous}</div>
          <div className="text-sm">réussie{autonomous > 1 ? 's' : ''} sans aide</div>
        </div>
        <div className="rounded-xl bg-warning-soft p-3">
          <div className="text-2xl font-semibold text-warning tabular-nums">{withHelp}</div>
          <div className="text-sm">réussie{withHelp > 1 ? 's' : ''} avec indices</div>
        </div>
        <div className="rounded-xl bg-danger-soft p-3">
          <div className="text-2xl font-semibold text-danger tabular-nums">{notSolved.length}</div>
          <div className="text-sm">
            non résolue{notSolved.length > 1 ? 's' : ''} (correction lue)
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm">
        <span className="font-medium">Notions travaillées : </span>
        {ex.conceptIds.map((c) => conceptById(c)?.title).join(', ')}.
      </p>
      <p className="mt-1 text-sm text-muted">
        {attempts.length} tentative{attempts.length > 1 ? 's' : ''} enregistrée
        {attempts.length > 1 ? 's' : ''}, {mistakes.length} erreur{mistakes.length > 1 ? 's' : ''}.
        {notSolved.length > 0 && ` À reprendre : ${notSolved.map((x) => x.id).join(', ')}.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {mistakes.length > 0 && (
          <ButtonLink to="/erreurs" variant="secondary" size="sm">
            Voir mes erreurs
          </ButtonLink>
        )}
        <ButtonLink to={`/exercices?td=${ex.td}`} size="sm">
          Exercice suivant du {ex.td}
        </ButtonLink>
      </div>
    </Card>
  );
}
