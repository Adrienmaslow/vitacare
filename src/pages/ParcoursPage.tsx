import { Link } from 'react-router-dom';
import { Clock, Compass, Flag, Layers, ListChecks, PenLine, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Switch';
import { DIFFICULTY_LABEL, PageHeader } from '@/components/ui/misc';
import { LESSON_STATUS } from '@/components/lessons/status';
import { CHAPTERS, PLANNED_CHAPTERS, conceptById, lessonById } from '@/content';
import { useDerived } from '@/hooks/useLearning';
import { useSettings } from '@/stores/settings';
import { cn } from '@/lib/cn';

export default function ParcoursPage() {
  const { derived, diagnosticDone } = useDerived();
  const { cours0Mode, set } = useSettings();
  const next = derived.pathLessons.find((l) => {
    const s = derived.lessonStatus.get(l.id);
    return s === 'a-decouvrir' || s === 'en-cours';
  });

  return (
    <div>
      <PageHeader
        title="Parcours de révision"
        subtitle="Un ordre recommandé, pas une obligation : toutes les leçons restent ouvertes. Une leçon déjà connue peut être validée par un test."
        actions={
          next && <ButtonLink to={`/lecons/${next.id}`}>Reprendre : {next.title}</ButtonLink>
        }
      />
      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-navy">Cours 0 — mode {cours0Mode}</div>
          <p className="text-sm text-muted">
            {cours0Mode === 'essentiel'
              ? 'Mode essentiel : seulement les outils directement utiles au TD1 et au TD2 (unités, loi d’Ohm, Kirchhoff, diviseurs).'
              : 'Mode complet : toutes les notions du cours 0, y compris les méthodes et théorèmes utiles pour la suite du semestre.'}
          </p>
        </div>
        <Segmented
          label="Mode du cours 0"
          value={cours0Mode}
          onChange={(v) => set({ cours0Mode: v })}
          options={[
            { value: 'essentiel', label: 'Essentiel' },
            { value: 'complet', label: 'Complet' },
          ]}
        />
        {!diagnosticDone && (
          <ButtonLink to="/diagnostic" variant="secondary" icon={<Compass size={16} />}>
            Diagnostic
          </ButtonLink>
        )}
      </Card>

      <div className="grid gap-8">
        {CHAPTERS.map((ch) => {
          const lessons = derived.pathLessons.filter((l) => l.chapterId === ch.id);
          const done = lessons.filter((l) =>
            ['termine', 'a-revoir'].includes(derived.lessonStatus.get(l.id)!),
          ).length;
          return (
            <section key={ch.id} aria-labelledby={`p-${ch.id}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-primary">{ch.shortTitle}</div>
                  <h2 id={`p-${ch.id}`} className="text-xl font-semibold text-navy">
                    <Link to={`/chapitres/${ch.id}`} className="hover:underline">
                      {ch.title}
                    </Link>
                  </h2>
                </div>
                <div className="w-48">
                  <ProgressBar
                    value={lessons.length ? done / lessons.length : 0}
                    label={`Parcours ${ch.shortTitle}`}
                  />
                  <div className="mt-1 text-right text-xs text-muted tabular-nums">
                    {done}/{lessons.length} leçons
                  </div>
                </div>
              </div>
              <ol className="relative ml-3 grid gap-3 border-l-2 border-border pl-6">
                <PathStep
                  icon={<Flag size={14} />}
                  title="Introduction et objectifs"
                  to={`/chapitres/${ch.id}`}
                  meta={ch.objectives.length + ' objectifs'}
                />
                {lessons.map((l) => {
                  const st = derived.lessonStatus.get(l.id)!;
                  const S = LESSON_STATUS[st];
                  const isNext = next?.id === l.id;
                  const prereq = l.prerequisiteLessonIds
                    .map((p) => lessonById(p)?.title)
                    .filter(Boolean);
                  return (
                    <li key={l.id} className="relative">
                      <span
                        className={cn(
                          'absolute top-4 -left-[33px] grid h-4 w-4 place-items-center rounded-full border-2 bg-bg',
                          st === 'termine'
                            ? 'border-success bg-success'
                            : st === 'a-revoir'
                              ? 'border-warning'
                              : st === 'en-cours'
                                ? 'border-primary'
                                : 'border-border',
                        )}
                        aria-hidden
                      />
                      <Link
                        to={`/lecons/${l.id}`}
                        className={cn(
                          'block rounded-2xl border bg-surface p-4 transition-colors hover:bg-surface-2',
                          isNext ? 'border-primary ring-2 ring-primary/15' : 'border-border',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy">{l.title}</span>
                          <Badge tone={S.tone}>
                            <S.Icon size={12} aria-hidden />
                            {S.label}
                          </Badge>
                          {isNext && (
                            <Badge tone="primary">
                              <Sparkles size={12} aria-hidden />
                              Recommandé
                            </Badge>
                          )}
                          {l.essential && ch.id === 'c0' && <Badge tone="teal">Essentiel TD</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={13} aria-hidden /> {l.durationMin} min
                          </span>
                          <span>{DIFFICULTY_LABEL[l.difficulty]}</span>
                          <span className="min-w-0 truncate">
                            {l.conceptIds.map((c) => conceptById(c)?.title).join(' · ')}
                          </span>
                        </div>
                        {prereq.length > 0 && (
                          <div className="mt-1 text-xs text-muted">
                            Prérequis : {prereq.join(', ')}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
                <PathStep
                  icon={<ListChecks size={14} />}
                  title="Vérification : QCM de chapitre"
                  to={`/qcm/session?mode=chapitre&chapter=${ch.id}`}
                  meta="10 à 20 questions"
                />
                {ch.tds.map((td) => (
                  <PathStep
                    key={td}
                    icon={<PenLine size={14} />}
                    title={`Applications et exercices du ${td}`}
                    to={`/exercices?td=${td}`}
                    meta="exercices officiels du livret"
                  />
                ))}
                <PathStep
                  icon={<Layers size={14} />}
                  title="Révision ultérieure : flashcards du chapitre"
                  to={`/flashcards?chapter=${ch.id}`}
                  meta="répétition espacée"
                />
              </ol>
            </section>
          );
        })}
        <section>
          <h2 className="mb-2 text-lg font-semibold text-navy">Chapitres à venir</h2>
          <p className="mb-3 text-sm text-muted">
            Hors du périmètre de cette version (TD3 à TD11) : la structure de l’application est
            prête à les accueillir.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {PLANNED_CHAPTERS.map((p) => (
              <li
                key={p.number}
                className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted"
              >
                Cours {p.number} — {p.title}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function PathStep({
  icon,
  title,
  to,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  to: string;
  meta: string;
}) {
  return (
    <li className="relative">
      <span
        className="absolute top-3.5 -left-[35px] grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-muted"
        aria-hidden
      >
        {icon}
      </span>
      <Link
        to={to}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm hover:bg-surface-2"
      >
        <span className="font-medium text-text">{title}</span>
        <span className="text-muted">{meta}</span>
      </Link>
    </li>
  );
}
