import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Dumbbell, History } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Md } from '@/components/ui/Math';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Switch';
import { conceptById, exerciseById, questionById } from '@/content';
import { setMistakeCategory, setMistakeResolved } from '@/db/repo';
import { useDerived } from '@/hooks/useLearning';
import { formatDateTime } from '@/lib/dates';
import type { ErrorCategory, Mistake } from '@/types';

export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  formule: 'Formule',
  unites: 'Unités',
  calcul: 'Calcul',
  signe: 'Signe',
  methode: 'Méthode',
  comprehension: 'Compréhension',
  prerequis: 'Prérequis',
};

export default function MistakesPage() {
  const { data } = useDerived();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [category, setCategory] = useState<'all' | ErrorCategory | 'none'>('all');
  const list = useMemo(
    () =>
      data.mistakes
        .filter((m) => (filter === 'open' ? !m.resolved : true))
        .filter((m) =>
          category === 'all'
            ? true
            : category === 'none'
              ? m.category === null
              : m.category === category,
        )
        .sort((a, b) => b.at - a.at),
    [data.mistakes, filter, category],
  );
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of data.mistakes.filter((x) => !x.resolved))
      c.set(m.category ?? 'none', (c.get(m.category ?? 'none') ?? 0) + 1);
    return c;
  }, [data.mistakes]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Mes erreurs"
        subtitle="Chaque mauvaise réponse est enregistrée. Une erreur est marquée corrigée dès que tu réponds juste à la même question."
        actions={
          data.mistakes.some((m) => !m.resolved) && (
            <ButtonLink to="/qcm/session?mode=erreurs" icon={<Dumbbell size={16} />}>
              M’entraîner sur mes erreurs
            </ButtonLink>
          )
        }
      />
      <div className="flex flex-wrap gap-3">
        <Segmented
          label="Statut"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'À corriger' },
            { value: 'all', label: 'Historique complet' },
          ]}
        />
        <select
          aria-label="Filtrer par catégorie"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
        >
          <option value="all">Toutes catégories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v} ({counts.get(k) ?? 0})
            </option>
          ))}
          <option value="none">Cause non déterminée ({counts.get('none') ?? 0})</option>
        </select>
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title={data.mistakes.length ? 'Aucune erreur en attente' : 'Aucune erreur enregistrée'}
        >
          {data.mistakes.length
            ? 'Toutes tes erreurs ont été corrigées. Bravo.'
            : 'Les erreurs apparaîtront ici dès ta première mauvaise réponse à un QCM ou un exercice.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {list.map((m) => (
            <MistakeItem key={m.id} mistake={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MistakeItem({ mistake: m }: { mistake: Mistake }) {
  const { data } = useDerived();
  const [open, setOpen] = useState(false);
  const q = questionById(m.questionId);
  const ex = m.context === 'exercise' ? exerciseById(m.refId) : undefined;
  const history = data.attempts
    .filter((a) => a.questionId === m.questionId)
    .sort((a, b) => b.at - a.at);
  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-primary">{m.label}</div>
            <div className="text-xs text-muted">{formatDateTime(m.at)}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {m.resolved && <Badge tone="success">Corrigée</Badge>}
            {m.conceptIds.map((c) => (
              <Badge key={c}>{conceptById(c)?.title}</Badge>
            ))}
          </div>
        </div>
        {q && <Md text={q.prompt} className="mt-2 text-[0.95rem]" />}
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted">Ta réponse : </span>
            <span className="text-danger">{m.given || '—'}</span>
          </div>
          <div>
            <span className="text-muted">Bonne réponse : </span>
            <span className="text-success">{m.expected}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted" htmlFor={`cat-${m.id}`}>
            Cause :
          </label>
          <select
            id={`cat-${m.id}`}
            value={m.category ?? ''}
            onChange={(e) =>
              void setMistakeCategory(m.id!, (e.target.value || null) as ErrorCategory | null)
            }
            className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm"
          >
            <option value="">Non déterminée</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          {ex ? (
            <ButtonLink size="sm" to={`/exercices/${ex.id}`} icon={<Dumbbell size={15} />}>
              Reprendre l’exercice
            </ButtonLink>
          ) : (
            <ButtonLink
              size="sm"
              to={`/qcm/session?mode=concept&concepts=${m.conceptIds.join(',')}&n=5`}
              icon={<Dumbbell size={15} />}
            >
              M’entraîner sur cette erreur
            </ButtonLink>
          )}
          {!m.resolved && (
            <Button size="sm" variant="ghost" onClick={() => void setMistakeResolved(m.id!, true)}>
              Marquer corrigée
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<History size={15} />}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            Historique ({history.length})
          </Button>
        </div>
        {open && (
          <ul className="mt-3 grid gap-1 border-t border-border pt-3 text-sm">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span>{formatDateTime(a.at)}</span>
                <span className="text-muted">{a.given}</span>
                <span className={a.correct ? 'text-success' : 'text-danger'}>
                  {a.correct ? 'juste' : 'faux'}
                  {a.hintsUsed ? ` · ${a.hintsUsed} indice${a.hintsUsed > 1 ? 's' : ''}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ex && (
          <p className="mt-2 text-xs text-muted">
            Exercice :{' '}
            <Link className="text-primary" to={`/exercices/${ex.id}`}>
              {ex.td} · {ex.number} — {ex.title}
            </Link>
          </p>
        )}
      </Card>
    </li>
  );
}
