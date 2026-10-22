import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Layers, RotateCcw } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/misc';
import { MasteryBadge } from '@/components/lessons/status';
import { CHAPTERS, FLASHCARDS, conceptById, lessonForConcept } from '@/content';
import { useDerived } from '@/hooks/useLearning';
import { addDays, dayKey, formatDateTime, formatDuration } from '@/lib/dates';

export default function RevisionsPage() {
  const { data, derived } = useDerived();
  const today = dayKey();
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(today, i);
        const n = data.reviews.filter((r) => (i === 0 ? r.due <= day : r.due === day)).length;
        return { day, n };
      }),
    [data.reviews, today],
  );
  const toReview = [...derived.mastery.values()].filter(
    (m) => m.status === 'a-revoir' || (m.evidence >= 2 && m.status === 'en-apprentissage'),
  );
  const lessonsToReview = derived.pathLessons.filter(
    (l) => derived.lessonStatus.get(l.id) === 'a-revoir',
  );
  const dueByChapter = CHAPTERS.map((c) => ({
    chapter: c,
    n: FLASHCARDS.filter(
      (f) => f.chapterId === c.id && data.reviews.some((r) => r.cardId === f.id && r.due <= today),
    ).length,
  }));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Révisions"
        subtitle="Ce qui doit être revu aujourd’hui et dans les prochains jours, selon la répétition espacée et ta maîtrise estimée."
        actions={
          derived.dueCards > 0 && (
            <ButtonLink to="/flashcards?mode=dues" icon={<Layers size={16} />}>
              Réviser {derived.dueCards} carte{derived.dueCards > 1 ? 's' : ''}
            </ButtonLink>
          )
        }
      />
      <Card>
        <CardHeader
          icon={<CalendarClock size={20} />}
          title="Les 7 prochains jours"
          subtitle="Cartes à réviser (aujourd’hui inclut les retards)"
        />
        <ol className="grid grid-cols-7 gap-1.5 px-5 pb-5">
          {week.map((d, i) => (
            <li
              key={d.day}
              className={`rounded-xl p-2 text-center ${i === 0 ? 'bg-primary-soft' : 'bg-surface-2'}`}
            >
              <div className="text-xs text-muted">
                {i === 0
                  ? 'Auj.'
                  : new Date(d.day + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short' })}
              </div>
              <div className="text-lg font-semibold text-navy tabular-nums">{d.n}</div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 px-5 pb-5 text-sm">
          {dueByChapter.map((c) => (
            <Link
              key={c.chapter.id}
              to={`/flashcards?chapter=${c.chapter.id}`}
              className="rounded-full bg-surface-2 px-3 py-1 hover:bg-border"
            >
              {c.chapter.shortTitle} : {c.n} due{c.n > 1 ? 's' : ''}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<RotateCcw size={20} />}
            title="Notions à revoir"
            subtitle="Oubli probable ou échecs récents"
          />
          <ul className="grid gap-2 px-5 pb-5">
            {toReview.length === 0 && (
              <li className="text-sm text-muted">Aucune notion à revoir pour l’instant.</li>
            )}
            {toReview.map((m) => {
              const l = lessonForConcept(m.conceptId);
              return (
                <li key={m.conceptId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">{conceptById(m.conceptId)?.title}</span>
                  <MasteryBadge status={m.status} />
                  <Link
                    to={`/qcm/session?mode=concept&concepts=${m.conceptId}&n=5`}
                    className="font-medium text-primary"
                  >
                    QCM
                  </Link>
                  {l && (
                    <Link to={`/lecons/${l.id}`} className="font-medium text-primary">
                      Leçon
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Leçons à revoir" />
          <ul className="grid gap-2 px-5 pb-5 text-sm">
            {lessonsToReview.length === 0 && (
              <li className="text-muted">Aucune leçon marquée « à revoir ».</li>
            )}
            {lessonsToReview.map((l) => (
              <li key={l.id}>
                <Link to={`/lecons/${l.id}`} className="text-primary hover:underline">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historique des sessions" />
        <ul className="grid gap-1 px-5 pb-5 text-sm">
          {data.sessions.length === 0 && (
            <li className="text-muted">Aucune session enregistrée.</li>
          )}
          {data.sessions
            .slice()
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, 15)
            .map((s) => (
              <li key={s.id} className="flex justify-between border-t border-border py-1.5">
                <span>{formatDateTime(s.startedAt)}</span>
                <span className="text-muted tabular-nums">{formatDuration(s.activeMs)}</span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
