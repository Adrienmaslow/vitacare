import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Switch';
import { DIFFICULTY_LABEL, PageHeader } from '@/components/ui/misc';
import { EXERCISES } from '@/content';
import { GENERATORS } from '@/engines/generators';
import { useDerived } from '@/hooks/useLearning';
import type { ExerciseSection } from '@/types';

const SECTIONS: ExerciseSection[] = [
  'Applications directes',
  'Travaux dirigés',
  'Exercices supplémentaires',
];

export default function ExercisesPage() {
  const [params, setParams] = useSearchParams();
  const td = (params.get('td') as 'TD1' | 'TD2' | 'all' | null) ?? 'all';
  const { data } = useDerived();
  const progress = new Map(data.exerciseProgress.map((p) => [p.exerciseId, p]));
  const list = EXERCISES.filter((e) => td === 'all' || e.td === td);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Exercices"
        subtitle="Les vrais exercices du livret (TD1 et TD2), question par question, avec indices progressifs et corrections. Puis des entraînements supplémentaires générés."
      />
      <Segmented
        label="Filtrer par TD"
        value={td}
        onChange={(v) => setParams(v === 'all' ? {} : { td: v })}
        options={[
          { value: 'all', label: 'Tous' },
          { value: 'TD1', label: 'TD1 · Résistivité et capacité' },
          { value: 'TD2', label: 'TD2 · Semi-conducteurs' },
        ]}
      />
      {(['TD1', 'TD2'] as const)
        .filter((t) => td === 'all' || td === t)
        .map((t) =>
          SECTIONS.map((section) => {
            const items = list.filter((e) => e.td === t && e.section === section);
            if (!items.length) return null;
            return (
              <section key={`${t}-${section}`} aria-label={`${t} — ${section}`}>
                <h2 className="mb-2 text-lg font-semibold text-navy">
                  {t} · {section}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((e) => {
                    const p = progress.get(e.id);
                    const ok = p ? e.parts.filter((part) => p.parts[part.id]?.correct).length : 0;
                    const official = e.parts.every((x) => x.correctionOrigin === 'livret');
                    return (
                      <Link key={e.id} to={`/exercices/${e.id}`} className="group">
                        <Card className="h-full p-4 transition-colors group-hover:bg-surface-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-primary">
                                Exercice {e.number}
                              </div>
                              <div className="font-semibold text-navy">{e.title}</div>
                            </div>
                            <ArrowRight
                              size={16}
                              className="mt-1 text-muted group-hover:text-primary"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge>{DIFFICULTY_LABEL[e.difficulty]}</Badge>
                            <Badge>
                              {e.parts.length} question{e.parts.length > 1 ? 's' : ''}
                            </Badge>
                            <Badge tone={official ? 'neutral' : 'teal'}>
                              {official ? 'Correction du livret' : 'Correction ECE STUDY'}
                            </Badge>
                          </div>
                          <ProgressBar
                            className="mt-3"
                            value={ok / e.parts.length}
                            tone="success"
                            label={`Progression exercice ${e.number}`}
                          />
                          <div className="mt-1 text-xs text-muted tabular-nums">
                            {ok}/{e.parts.length} réussie{ok > 1 ? 's' : ''}
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          }),
        )}

      <Card>
        <CardHeader
          icon={<FlaskConical size={20} />}
          title="Entraînements supplémentaires (exercices générés)"
          subtitle="Exercices originaux d’ECE STUDY, distincts des TD officiels : données tirées dans des plages réalistes, résultat calculé par le moteur. Chaque tirage est reproductible."
        />
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
          {GENERATORS.map((g) => (
            <li key={g.id}>
              <Link
                to={`/exercices/entrainement/${g.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm hover:bg-surface-2"
              >
                <span className="font-medium">{g.title}</span>
                <Badge
                  tone={g.difficulty === 1 ? 'success' : g.difficulty === 2 ? 'warning' : 'danger'}
                >
                  {DIFFICULTY_LABEL[g.difficulty]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
