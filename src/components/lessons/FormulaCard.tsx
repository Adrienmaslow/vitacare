import { useState } from 'react';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { Md, Tex } from '@/components/ui/Math';
import { Badge } from '@/components/ui/Badge';
import { SourceTag } from '@/components/ui/misc';
import { FormulaExplorer } from '@/components/visuals';
import type { Formula } from '@/types';
import { cn } from '@/lib/cn';

/** Fiche complète d'une formule : sens, unités, conditions, intuition, exemple, pièges, source. */
export function FormulaCard({
  formula: f,
  compact = false,
  defaultOpen = false,
}: {
  formula: Formula;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [explore, setExplore] = useState(false);
  return (
    <div
      className={cn('min-w-0 rounded-2xl border border-border bg-surface', compact ? 'p-4' : 'p-5')}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-navy">{f.name}</h3>
        <div className="flex gap-1">
          {f.usedIn.map((td) => (
            <Badge key={td} tone="teal">
              {td}
            </Badge>
          ))}
        </div>
      </div>
      <div className="my-2 rounded-xl bg-surface-2 px-3 py-1 text-center">
        <Tex tex={f.latex} display />
      </div>
      <Md text={f.meaning} className="text-[0.95rem]" />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-2 text-sm font-medium text-primary"
      >
        {open ? 'Masquer les détails' : 'Unités, conditions, exemple, pièges'}
      </button>
      {open && (
        <div className="mt-3 grid gap-3 text-sm">
          <div>
            <div className="font-semibold text-navy">Variables et unités</div>
            <ul className="mt-1 grid gap-1">
              {f.variables.map((v) => (
                <li key={v.symbol} className="flex flex-wrap gap-x-2">
                  <span className="min-w-12">
                    <Tex tex={v.symbol} />
                  </span>
                  <span className="text-muted">{v.name}</span>
                  <span className="ml-auto font-medium">{v.unit}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-navy">Conditions d’utilisation</div>
            <Md text={f.conditions} className="text-muted" />
          </div>
          <div>
            <div className="font-semibold text-navy">Intuition</div>
            <Md text={f.intuition} className="text-muted" />
          </div>
          {f.example && (
            <div className="rounded-xl bg-primary-soft/60 p-3">
              <div className="font-semibold text-navy">Exemple numérique</div>
              <Md text={f.example.statement} />
              <Md text={f.example.solution} className="mt-1 font-medium" />
            </div>
          )}
          {f.pitfalls.length > 0 && (
            <div>
              <div className="flex items-center gap-1 font-semibold text-warning">
                <AlertTriangle size={14} aria-hidden /> Erreurs classiques
              </div>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {f.pitfalls.map((p) => (
                  <li key={p}>
                    <Md text={p} as="span" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SourceTag source={f.source} />
        </div>
      )}
      {f.explorer && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExplore(!explore)}
            aria-expanded={explore}
            className="inline-flex items-center gap-1 text-sm font-medium text-teal"
          >
            <SlidersHorizontal size={14} aria-hidden />{' '}
            {explore ? 'Fermer le simulateur' : 'Faire varier les grandeurs'}
          </button>
          {explore && (
            <div className="mt-2">
              <FormulaExplorer id={f.explorer} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
