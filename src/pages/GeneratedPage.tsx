import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Eye, LifeBuoy, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Md } from '@/components/ui/Math';
import { DIFFICULTY_LABEL } from '@/components/ui/misc';
import { QuestionCard } from '@/components/quizzes/QuestionCard';
import { generatorById } from '@/engines/generators';
import { randomSeed } from '@/lib/random';
import NotFoundPage from './NotFoundPage';

export default function GeneratedPage() {
  const { generatorId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const gen = generatorById(generatorId);
  const seed = Number(params.get('seed')) || 0;
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const ex = useMemo(() => (gen && seed ? gen.make(seed) : null), [gen, seed]);
  useEffect(() => {
    // Graine absente : on en tire une et on l'inscrit dans l'URL (tirage partageable et reproductible).
    if (gen && !seed) setParams({ seed: String(randomSeed()) }, { replace: true });
  }, [gen, seed, setParams]);
  if (!gen) return <NotFoundPage />;
  if (!ex) return null;
  const newOne = () => {
    setHints(0);
    setShowSolution(false);
    setParams({ seed: String(randomSeed()) });
  };
  return (
    <div className="grid gap-5">
      <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
        <Link to="/exercices" className="hover:underline">
          Exercices
        </Link>{' '}
        / Entraînement supplémentaire
      </nav>
      <header>
        <div className="flex flex-wrap gap-2">
          <Badge tone="teal">Entraînement supplémentaire — généré</Badge>
          <Badge>{DIFFICULTY_LABEL[ex.difficulty]}</Badge>
          <Badge>Tirage n° {seed}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">{ex.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Exercice original d’ECE STUDY (pas un exercice du livret). Le résultat attendu est calculé
          par le moteur à partir des données tirées.
        </p>
      </header>
      <Card className="p-5 sm:p-6">
        <QuestionCard
          key={seed}
          question={ex.question}
          prompt={ex.statement}
          context="generated"
          refId={`${gen.id}#${seed}`}
          label={`Entraînement — ${ex.title}`}
          seed={seed}
          hintsUsed={showSolution ? 3 : hints}
          footer={() => (
            <Button size="sm" icon={<Shuffle size={15} />} onClick={newOne}>
              Nouvel exercice
            </Button>
          )}
        />
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-navy">
            <LifeBuoy size={17} className="text-primary" aria-hidden /> Aide progressive
          </h2>
          <ol className="mt-2 grid gap-2">
            {ex.hints.slice(0, hints).map((h, i) => (
              <li key={i} className="rounded-xl bg-surface p-3">
                <span className="text-xs font-semibold text-primary uppercase">Indice {i + 1}</span>
                <Md text={h} className="mt-1" />
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {hints < 3 && (
              <Button size="sm" variant="secondary" onClick={() => setHints(hints + 1)}>
                {hints === 0 ? 'Je suis bloqué' : `Indice suivant (${hints + 1}/3)`}
              </Button>
            )}
            {!showSolution && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Eye size={15} />}
                onClick={() => setShowSolution(true)}
              >
                Voir la correction
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<Shuffle size={15} />} onClick={newOne}>
              Autre tirage
            </Button>
          </div>
        </div>
        {showSolution && (
          <div className="animate-pop mt-5 rounded-2xl border border-border p-4">
            <h2 className="font-semibold text-navy">Correction</h2>
            <ol className="mt-2 grid gap-2">
              {ex.steps.map((s, i) => (
                <li key={i}>
                  <Md text={s.md} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}
