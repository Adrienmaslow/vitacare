import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, Gauge, ListChecks, PenLine, Timer, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/misc';
import { CHAPTERS, ORDERED_LESSONS } from '@/content';
import { useDerived } from '@/hooks/useLearning';

export default function QcmHubPage() {
  const { data } = useDerived();
  const unresolved = data.mistakes.filter((m) => !m.resolved).length;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="QCM"
        subtitle="Choisis un mode. Les distracteurs reprennent des erreurs fréquentes ; chaque réponse est expliquée."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ModeCard
          to="/qcm/session?mode=rapide"
          icon={<Zap />}
          title="Session rapide"
          desc="5 minutes chrono, questions variées, priorité aux notions fragiles."
        />
        <ModeCard
          to="/qcm/session?mode=erreurs"
          icon={<AlertCircle />}
          title="Mode erreurs"
          desc={
            unresolved
              ? `${unresolved} erreur${unresolved > 1 ? 's' : ''} à retravailler, plus des questions voisines.`
              : 'Aucune erreur en attente pour l’instant.'
          }
          disabled={!unresolved}
        />
        <ModeCard
          to="/examen"
          icon={<Timer />}
          title="Mode examen"
          desc="20 questions, chronomètre, sans indice, correction à la fin, note sur 20."
        />
        <ModeCard
          to="/diagnostic"
          icon={<Gauge />}
          title="Diagnostic cours 0"
          desc="3 questions par outil pour savoir quoi réviser."
        />
      </div>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-navy">
          <ListChecks size={18} aria-hidden /> Par chapitre (10 à 20 questions)
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {CHAPTERS.map((c) => (
            <ModeCard
              key={c.id}
              to={`/qcm/session?mode=chapitre&chapter=${c.id}`}
              title={`${c.shortTitle} — ${c.title}`}
              desc="Couvre toutes les notions du chapitre, priorité aux plus fragiles."
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-navy">
          <PenLine size={18} aria-hidden /> Méthodes des TD
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ModeCard
            to="/qcm/session?mode=td&td=TD1"
            title="Méthodes du TD1"
            desc="Unités, R = ρℓ/S, vitesse de dérive, capacité."
          />
          <ModeCard
            to="/qcm/session?mode=td&td=TD2"
            title="Méthodes du TD2"
            desc="Bandes, dopage, loi d’action de masse, conductivité."
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-navy">
          <BookOpen size={18} aria-hidden /> Par leçon (3 à 5 questions)
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ORDERED_LESSONS.map((l) => (
            <li key={l.id}>
              <Link
                to={`/qcm/session?mode=lecon&lesson=${l.id}`}
                className="block rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-surface-2"
              >
                {l.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModeCard({
  to,
  icon,
  title,
  desc,
  disabled,
}: {
  to: string;
  icon?: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const inner = (
    <Card
      className={`flex h-full gap-3 p-4 transition-colors ${disabled ? 'opacity-60' : 'hover:bg-surface-2'}`}
    >
      {icon && <div className="text-primary">{icon}</div>}
      <div>
        <div className="font-semibold text-navy">{title}</div>
        <div className="text-sm text-muted">{desc}</div>
      </div>
    </Card>
  );
  return disabled ? <div aria-disabled>{inner}</div> : <Link to={to}>{inner}</Link>;
}
