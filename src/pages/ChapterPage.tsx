import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookMarked, Layers, ListChecks, PenLine, Target } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { PageHeader, SourceTag } from '@/components/ui/misc';
import { LessonStatusBadge, MasteryBadge } from '@/components/lessons/status';
import { chapterById, conceptsOfChapter, exercisesOfChapter, lessonsOfChapter } from '@/content';
import { chapterStats } from '@/features/progress/derive';
import { useDerived } from '@/hooks/useLearning';
import NotFoundPage from './NotFoundPage';

const RELEVANCE = {
  indispensable: { label: 'Indispensable TD1/TD2', tone: 'teal' },
  utile: { label: 'Utile', tone: 'primary' },
  culture: { label: 'Hors TD1/TD2', tone: 'neutral' },
} as const;

export default function ChapterPage() {
  const { chapterId = '' } = useParams();
  const chapter = chapterById(chapterId);
  const { data, derived, cours0Mode } = useDerived();
  if (!chapter) return <NotFoundPage />;
  const stats = chapterStats(chapter, data, derived, cours0Mode);
  const lessons = lessonsOfChapter(chapter.id);
  const concepts = conceptsOfChapter(chapter.id);
  const exercises = exercisesOfChapter(chapter.id);
  const prereq = chapter.prerequisiteChapterIds.map((id) => chapterById(id)!);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={chapter.shortTitle}
        title={chapter.title}
        subtitle={chapter.summary}
        actions={
          <>
            <ButtonLink
              to={`/qcm/session?mode=chapitre&chapter=${chapter.id}`}
              variant="secondary"
              icon={<ListChecks size={16} />}
            >
              QCM du chapitre
            </ButtonLink>
            <ButtonLink
              to={`/ressources/fiches/${chapter.id}`}
              variant="secondary"
              icon={<BookMarked size={16} />}
            >
              Fiche
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            icon={<Target size={20} />}
            title="Pourquoi ce chapitre ?"
            subtitle={chapter.whyItMatters}
          />
          <div className="px-5 pb-5">
            <h3 className="text-sm font-semibold text-navy">Objectifs</h3>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-[0.95rem]">
              {chapter.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {prereq.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                Prérequis :{' '}
                {prereq.map((p) => (
                  <Link
                    key={p.id}
                    to={`/chapitres/${p.id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {p.shortTitle} — {p.title}
                  </Link>
                ))}
              </p>
            )}
            <SourceTag source={chapter.source} className="mt-3" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="grid gap-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Parcours</span>
                <span className="tabular-nums">
                  {stats.lessonsDone}/{stats.lessonsTotal}
                </span>
              </div>
              <ProgressBar value={stats.pathProgress} label="Parcours du chapitre" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Maîtrise estimée</span>
                <span className="tabular-nums">
                  {stats.conceptsStudied ? `${Math.round(stats.mastery * 100)} %` : '—'}
                </span>
              </div>
              <ProgressBar value={stats.mastery} tone="teal" label="Maîtrise estimée du chapitre" />
            </div>
            <p className="text-sm text-muted">
              {stats.correctAnswers} bonne{stats.correctAnswers > 1 ? 's' : ''} réponse
              {stats.correctAnswers > 1 ? 's' : ''} sur {stats.totalAnswers}.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                to={`/flashcards?chapter=${chapter.id}`}
                size="sm"
                variant="secondary"
                icon={<Layers size={15} />}
              >
                Flashcards
              </ButtonLink>
              {chapter.tds.map((td) => (
                <ButtonLink
                  key={td}
                  to={`/exercices?td=${td}`}
                  size="sm"
                  variant="teal"
                  icon={<PenLine size={15} />}
                >
                  {td}
                </ButtonLink>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Leçons"
          subtitle={
            chapter.id === 'c0' && cours0Mode === 'essentiel'
              ? 'Mode essentiel : les leçons marquées « Essentiel TD » suffisent pour le TD1 et le TD2.'
              : undefined
          }
        />
        <ol className="grid gap-2 px-5 pb-5">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <Link
                to={`/lecons/${l.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-2"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-navy">{l.title}</span>
                  <span className="block text-sm text-muted">{l.why}</span>
                </span>
                {l.essential && <Badge tone="teal">Essentiel TD</Badge>}
                <LessonStatusBadge status={derived.lessonStatus.get(l.id)!} />
                <span className="text-sm text-muted">{l.durationMin} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Notions et maîtrise"
          subtitle="Statut estimé à partir de tes réponses (QCM, exercices, indices, révisions)."
        />
        <ul className="grid gap-2 px-5 pb-5">
          {concepts.map((c) => {
            const m = derived.mastery.get(c.id)!;
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-sm text-muted">{c.summary}</span>
                </span>
                <Badge tone={RELEVANCE[c.tdRelevance].tone}>{RELEVANCE[c.tdRelevance].label}</Badge>
                <MasteryBadge status={m.status} />
                <span className="w-12 text-right text-sm text-muted tabular-nums">
                  {m.evidence ? `${Math.round(m.score * 100)} %` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {exercises.length > 0 && (
        <Card>
          <CardHeader title="Exercices officiels associés" />
          <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
            {exercises.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/exercices/${e.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm hover:bg-surface-2"
                >
                  <span>
                    <span className="font-medium">
                      {e.td} · Ex. {e.number}
                    </span>{' '}
                    — {e.title}
                  </span>
                  <ArrowRight size={15} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
