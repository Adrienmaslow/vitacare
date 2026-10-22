import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState, PageHeader, Stat } from '@/components/ui/misc';
import { ButtonLink } from '@/components/ui/Button';
import { MasteryBadge } from '@/components/lessons/status';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';
import { DataTable, SimpleBars, SimpleLine } from '@/components/charts/Charts';
import { CONCEPTS, conceptById, questionById } from '@/content';
import { allChapterStats, weakestConcepts } from '@/features/progress/derive';
import { useDerived } from '@/hooks/useLearning';
import { addDays, dayKey, formatDateTime, formatDuration } from '@/lib/dates';

const short = (day: string) => {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
};

export default function StatsPage() {
  const { data, derived, cours0Mode } = useDerived();
  const today = dayKey();

  const time30 = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.sessions) m.set(s.day, (m.get(s.day) ?? 0) + s.activeMs);
    return Array.from({ length: 30 }, (_, i) => {
      const day = addDays(today, i - 29);
      return { label: short(day), value: Math.round((m.get(day) ?? 0) / 60_000) };
    });
  }, [data.sessions, today]);

  const successWeekly = useMemo(() => {
    const out = [];
    for (let w = 7; w >= 0; w--) {
      const end = addDays(today, -w * 7);
      const start = addDays(end, -6);
      const as = data.attempts.filter((a) => {
        const d = dayKey(a.at);
        return d >= start && d <= end;
      });
      if (as.length)
        out.push({
          label: short(start),
          value: Math.round((as.filter((a) => a.correct).length / as.length) * 100),
        });
    }
    return out;
  }, [data.attempts, today]);

  const exams = data.exams
    .slice()
    .sort((a, b) => a.at - b.at)
    .map((e) => ({ label: short(dayKey(e.at)), value: e.score20 }));

  const upcoming = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const day = addDays(today, i);
        return {
          label: i === 0 ? 'auj.' : short(day),
          value: data.reviews.filter((r) => (i === 0 ? r.due <= day : r.due === day)).length,
        };
      }),
    [data.reviews, today],
  );

  const totalAnswers = data.attempts.length;
  const correct = data.attempts.filter((a) => a.correct).length;
  const chapters = allChapterStats(data, derived, cours0Mode);
  const weakest = weakestConcepts(derived, 6);
  const studiedConcepts = CONCEPTS.map((c) => derived.mastery.get(c.id)!).filter(
    (m) => m.evidence > 0,
  );

  if (derived.isEmpty) {
    return (
      <div>
        <PageHeader title="Statistiques" />
        <EmptyState
          icon={<BarChart3 size={28} />}
          title="Pas encore de données"
          action={<ButtonLink to="/parcours">Commencer le parcours</ButtonLink>}
        >
          Les statistiques sont calculées uniquement à partir de ton activité réelle : temps passé,
          réponses, examens et révisions. Elles apparaîtront après tes premières réponses.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Statistiques"
        subtitle="Calculées uniquement à partir de ton activité réelle sur cet appareil."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <Stat
            label="Temps de révision"
            value={formatDuration(derived.totalActiveMs)}
            hint={`${data.sessions.length} session${data.sessions.length > 1 ? 's' : ''}`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Taux de réussite"
            value={totalAnswers ? `${Math.round((correct / totalAnswers) * 100)} %` : '—'}
            hint={`${correct}/${totalAnswers} réponses`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Leçons terminées"
            value={`${derived.lessonsDone}/${derived.pathLessons.length}`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Questions de TD réussies"
            value={`${derived.exercisePartsDone}/${derived.exercisePartsTotal}`}
            hint={`${data.exams.length} examen${data.exams.length > 1 ? 's' : ''} blanc${data.exams.length > 1 ? 's' : ''}`}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Minutes travaillées par jour"
            subtitle="30 derniers jours, temps actif mesuré"
          />
          <div className="px-3 pb-4">
            <SimpleBars data={time30} unit="min" name="Temps" />
            <div className="px-2">
              <DataTable
                data={time30.filter((d) => d.value > 0)}
                unit="min"
                caption="Minutes par jour"
              />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Taux de réussite par semaine" subtitle="Toutes réponses confondues" />
          <div className="px-3 pb-4">
            {successWeekly.length ? (
              <>
                <SimpleLine data={successWeekly} unit="%" name="Réussite" domain={[0, 100]} />
                <div className="px-2">
                  <DataTable data={successWeekly} unit="%" caption="Réussite hebdomadaire" />
                </div>
              </>
            ) : (
              <p className="px-2 text-sm text-muted">Pas encore de réponses.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Progression par chapitre"
          subtitle="Parcours (leçons) et maîtrise estimée sont deux mesures distinctes."
        />
        <div className="grid gap-4 px-5 pb-5">
          {chapters.map((c) => (
            <div
              key={c.chapter.id}
              className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr] sm:items-center"
            >
              <div className="font-medium">{c.chapter.shortTitle}</div>
              <div>
                <div className="mb-1 text-xs text-muted">
                  Parcours {Math.round(c.pathProgress * 100)} %
                </div>
                <ProgressBar value={c.pathProgress} label={`Parcours ${c.chapter.shortTitle}`} />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted">
                  Maîtrise {c.conceptsStudied ? `${Math.round(c.mastery * 100)} %` : '—'}
                </div>
                <ProgressBar
                  value={c.mastery}
                  tone="teal"
                  label={`Maîtrise ${c.chapter.shortTitle}`}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Notions les plus fragiles"
            subtitle="Au moins 2 réponses, triées par maîtrise croissante"
          />
          <ul className="grid gap-2 px-5 pb-5">
            {weakest.length === 0 && (
              <li className="text-sm text-muted">
                Aucune notion fragile identifiée pour l’instant.
              </li>
            )}
            {weakest.map((m) => (
              <li key={m.conceptId} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{conceptById(m.conceptId)?.title}</span>
                <MasteryBadge status={m.status} />
                <span className="w-10 text-right tabular-nums">{Math.round(m.score * 100)} %</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Révisions à effectuer"
            subtitle="Flashcards dues sur les 14 prochains jours"
          />
          <div className="px-3 pb-4">
            <SimpleBars
              data={upcoming}
              unit="cartes"
              name="Cartes dues"
              color="var(--teal)"
              height={180}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Maîtrise estimée par notion"
          subtitle={`${studiedConcepts.length} notion${studiedConcepts.length > 1 ? 's' : ''} travaillée${studiedConcepts.length > 1 ? 's' : ''} sur ${CONCEPTS.length}`}
        />
        <ul className="grid gap-2 px-5 pb-5 md:grid-cols-2">
          {CONCEPTS.map((c) => {
            const m = derived.mastery.get(c.id)!;
            return (
              <li key={c.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {m.evidence
                      ? `${Math.round(m.score * 100)} % · ${m.evidence} rép.`
                      : 'non étudiée'}
                  </span>
                </div>
                <ProgressBar
                  value={m.score}
                  tone="teal"
                  className="mt-1"
                  label={`Maîtrise ${c.title}`}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scores des examens blancs" subtitle="Note sur 20" />
          <div className="px-3 pb-4">
            {exams.length ? (
              <SimpleLine data={exams} unit="/20" name="Note" domain={[0, 20]} />
            ) : (
              <p className="px-2 text-sm text-muted">Aucun examen blanc passé.</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Calendrier d’activité" />
          <div className="px-5 pb-5">
            <ActivityCalendar data={data} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historique des activités" subtitle="20 dernières réponses" />
        <ul className="grid gap-1 px-5 pb-5 text-sm">
          {data.attempts
            .slice()
            .sort((a, b) => b.at - a.at)
            .slice(0, 20)
            .map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5"
              >
                <span className="text-muted">{formatDateTime(a.at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {conceptById(a.conceptIds[0]!)?.title ?? questionById(a.questionId)?.id}
                </span>
                <span className={a.correct ? 'text-success' : 'text-danger'}>
                  {a.correct ? 'juste' : 'faux'}
                </span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
