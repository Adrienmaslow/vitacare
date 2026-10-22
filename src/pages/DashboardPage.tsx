import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Compass,
  Download,
  Lightbulb,
  PlayCircle,
  Smartphone,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar, Ring } from '@/components/ui/Progress';
import { Stat } from '@/components/ui/misc';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';
import { ChapterCard } from '@/components/dashboard/ChapterCard';
import { allChapterStats } from '@/features/progress/derive';
import { planForToday, recommend } from '@/engines/recommendation-engine/recommend';
import { useDerived } from '@/hooks/useLearning';
import { useSettings } from '@/stores/settings';
import { formatDateTime, formatDuration } from '@/lib/dates';
import { usePwa } from '@/components/pwa/pwa';

export default function DashboardPage() {
  const { data, derived, loading, diagnosticDone, cours0Mode } = useDerived();
  const { userName, dailyGoalMin, gamification } = useSettings();
  const installed = usePwa((s) => s.installed);
  const recs = useMemo(
    () => recommend(data, derived, { diagnosticDone, dailyGoalMin }),
    [data, derived, diagnosticDone, dailyGoalMin],
  );
  const remaining = Math.max(0, dailyGoalMin - derived.todayActiveMs / 60_000);
  const plan = planForToday(recs, remaining);
  const chapters = allChapterStats(data, derived, cours0Mode);
  const studied = [...derived.mastery.values()].filter((m) => m.evidence > 0);
  const avgMastery = studied.length
    ? studied.reduce((s, m) => s + m.score, 0) / derived.mastery.size
    : 0;
  const continueTo = recs[0]?.to ?? '/parcours';
  const recentSessions = data.sessions
    .slice()
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, 5);
  const hour = new Date().getHours();
  const hello = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';

  if (loading) return <div className="h-64" aria-busy="true" aria-label="Chargement" />;

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">De l’atome à la puce · ING2 S3</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            {hello}
            {userName ? ` ${userName}` : ''}
          </h1>
          <p className="mt-1 text-muted">
            {derived.isEmpty
              ? 'Bienvenue sur ECE STUDY. Commence par un diagnostic rapide pour savoir par où commencer.'
              : `Objectif du jour : ${dailyGoalMin} min · déjà ${formatDuration(derived.todayActiveMs)} aujourd’hui.`}
          </p>
        </div>
        <ButtonLink to={continueTo} size="lg" icon={<PlayCircle size={20} />}>
          {derived.isEmpty ? 'Commencer' : 'Continuer'}
        </ButtonLink>
      </section>

      {derived.isEmpty && (
        <Card className="overflow-hidden">
          <div className="grid gap-5 p-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-lg font-semibold text-navy">Comment fonctionne ECE STUDY</h2>
              <ol className="mt-3 grid gap-2 text-[0.95rem]">
                <li>
                  <span className="font-semibold text-primary">1.</span> Un diagnostic de 6 minutes
                  sur les outils du cours 0 (unités, loi d’Ohm, Kirchhoff, diviseurs).
                </li>
                <li>
                  <span className="font-semibold text-primary">2.</span> Un parcours guidé : leçons
                  courtes, vérifications, puis les vrais exercices du TD1 et du TD2.
                </li>
                <li>
                  <span className="font-semibold text-primary">3.</span> Des QCM, des flashcards à
                  répétition espacée et un suivi de tes erreurs.
                </li>
              </ol>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink to="/diagnostic" icon={<Compass size={18} />}>
                  Faire le diagnostic
                </ButtonLink>
                <ButtonLink to="/parcours" variant="secondary">
                  Voir le parcours
                </ButtonLink>
              </div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              <p className="font-medium text-navy">Tes données restent sur cet appareil</p>
              <p className="mt-1">
                La progression est enregistrée dans ton navigateur (aucun compte, aucun serveur).
                Elle n’est donc pas synchronisée automatiquement entre ton ordinateur et ton
                téléphone : utilise l’export / import dans{' '}
                <Link to="/parametres" className="text-primary underline">
                  Paramètres
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>
      )}

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <Ring value={derived.pathProgress} label="Progression du parcours" />
          <Stat
            label="Parcours"
            value={`${derived.lessonsDone}/${derived.pathLessons.length}`}
            hint="leçons terminées"
          />
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <Ring value={avgMastery} tone="teal" label="Maîtrise estimée moyenne" />
          <Stat
            label="Maîtrise"
            value={studied.length ? `${Math.round(avgMastery * 100)} %` : '—'}
            hint="estimée, toutes notions"
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Temps travaillé"
            value={formatDuration(derived.totalActiveMs)}
            hint={`aujourd’hui : ${formatDuration(derived.todayActiveMs)}`}
          />
          <ProgressBar
            className="mt-3"
            value={derived.todayActiveMs / 60_000 / dailyGoalMin}
            tone="success"
            label="Objectif quotidien"
          />
        </Card>
        <Card className="p-4">
          {gamification ? (
            <Stat
              label={`Niveau ${derived.level}`}
              value={`${derived.xp} XP`}
              hint={`série : ${derived.streak} jour${derived.streak > 1 ? 's' : ''}`}
            />
          ) : (
            <Stat
              label="Exercices TD"
              value={`${derived.exercisePartsDone}/${derived.exercisePartsTotal}`}
              hint="questions réussies"
            />
          )}
          {gamification && (
            <ProgressBar
              className="mt-3"
              value={derived.xpIntoLevel / derived.xpForNextLevel}
              label="Progression vers le niveau suivant"
            />
          )}
        </Card>
      </section>
      <p className="-mt-3 text-xs text-muted">
        La progression du parcours compte les leçons lues ; la maîtrise est estimée à partir de tes
        réponses (réussites, indices, difficulté, ancienneté). Elles ne se confondent pas.
      </p>

      <Card>
        <CardHeader
          icon={<Lightbulb size={20} />}
          title="Aujourd’hui, je révise quoi ?"
          subtitle={`Plan proposé pour ${Math.max(10, Math.round(remaining))} min, à partir de tes erreurs récentes, de tes révisions dues et de ton avancement.`}
        />
        <ol className="grid gap-2 px-5 pb-5">
          {plan.map((r, i) => (
            <li key={r.id}>
              <Link
                to={r.to}
                className="group flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-surface-2"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-navy">{r.title}</span>
                  <span className="block text-sm text-muted">{r.reason}</span>
                </span>
                <span className="shrink-0 text-sm text-muted tabular-nums">~{r.minutes} min</span>
                <ArrowRight
                  size={16}
                  className="mt-1 shrink-0 text-muted group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
          {plan.length === 0 && (
            <li className="text-sm text-muted">
              Rien d’urgent : avance dans le parcours ou fais un QCM de chapitre.
            </li>
          )}
        </ol>
      </Card>

      <section aria-labelledby="chapters-title">
        <h2 id="chapters-title" className="mb-3 text-lg font-semibold text-navy">
          Chapitres
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {chapters.map((s) => (
            <ChapterCard key={s.chapter.id} stats={s} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            icon={<CalendarCheck size={20} />}
            title="Activité"
            subtitle="Minutes réellement travaillées par jour (12 semaines)"
          />
          <div className="px-5 pb-5">
            <ActivityCalendar data={data} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Dernières sessions" />
          <ul className="grid gap-2 px-5 pb-5 text-sm">
            {recentSessions.length === 0 && (
              <li className="text-muted">Aucune session enregistrée pour l’instant.</li>
            )}
            {recentSessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{formatDateTime(s.startedAt)}</span>
                <span className="text-muted tabular-nums">{formatDuration(s.activeMs)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {!installed && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <Smartphone className="text-primary" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-navy">Installer ECE STUDY</div>
            <div className="text-sm text-muted">
              Sur ton ordinateur ou ton téléphone, l’application s’ouvre comme une app et fonctionne
              hors connexion.
            </div>
          </div>
          <ButtonLink
            to="/parametres#installation"
            variant="secondary"
            icon={<Download size={16} />}
          >
            Comment installer
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
