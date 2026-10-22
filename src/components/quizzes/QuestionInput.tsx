import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react';
import { Md } from '@/components/ui/Math';
import { cn } from '@/lib/cn';
import { hashString, mulberry32, shuffle } from '@/lib/random';
import type { EvaluationResult, GivenAnswer, Question } from '@/types';

export type Draft =
  | { type: 'choice'; choiceId: string | null }
  | { type: 'boolean'; value: boolean | null }
  | { type: 'text'; value: string }
  | { type: 'matching'; mapping: Record<string, string> }
  | { type: 'ordering'; order: string[] }
  | { type: 'selfcheck'; draft: string; revealed: boolean; criteriaMet: boolean[] };

export function initialDraft(q: Question, seed: number): Draft {
  switch (q.type) {
    case 'mcq':
    case 'formula':
      return { type: 'choice', choiceId: null };
    case 'truefalse':
      return { type: 'boolean', value: null };
    case 'numeric':
      return { type: 'text', value: '' };
    case 'matching':
      return { type: 'matching', mapping: {} };
    case 'ordering': {
      const rng = mulberry32(seed ^ hashString(q.id));
      let order = shuffle(q.items, rng);
      // Ne jamais proposer d'emblée le bon ordre.
      if (order.every((it, i) => it === q.items[i])) order = [...order.slice(1), order[0]!];
      return { type: 'ordering', order };
    }
    case 'selfcheck':
      return {
        type: 'selfcheck',
        draft: '',
        revealed: false,
        criteriaMet: q.criteria.map(() => false),
      };
  }
}

/** Convertit le brouillon en réponse évaluable (null si incomplet). */
export function toGiven(q: Question, d: Draft): GivenAnswer | null {
  switch (d.type) {
    case 'choice':
      return d.choiceId ? { type: 'choice', choiceId: d.choiceId } : null;
    case 'boolean':
      return d.value === null ? null : { type: 'boolean', value: d.value };
    case 'text':
      return d.value.trim() ? { type: 'text', value: d.value } : null;
    case 'matching':
      return q.type === 'matching' && q.pairs.every((p) => d.mapping[p.left])
        ? { type: 'matching', mapping: d.mapping }
        : null;
    case 'ordering':
      return { type: 'ordering', order: d.order };
    case 'selfcheck':
      return d.revealed ? { type: 'selfcheck', criteriaMet: d.criteriaMet } : null;
  }
}

const SYMBOLS = ['Ω', 'µ', '·10^', '^', '²', '³', '⁻', '/', '·'];

export function QuestionInput({
  question: q,
  draft,
  onChange,
  disabled,
  seed,
  result,
  onSubmit,
}: {
  question: Question;
  draft: Draft;
  onChange: (d: Draft) => void;
  disabled: boolean;
  seed: number;
  /** Après correction : surligner justes/fausses. */
  result?: EvaluationResult | null;
  onSubmit?: () => void;
}) {
  const id = useId();
  const choiceOrder = useMemo(() => {
    if (q.type !== 'mcq' && q.type !== 'formula') return [];
    return shuffle(q.choices, mulberry32(seed ^ hashString(q.id)));
  }, [q, seed]);
  const rightOptions = useMemo(() => {
    if (q.type !== 'matching') return [];
    return shuffle(
      [...new Set(q.pairs.map((p) => p.right))],
      mulberry32(seed ^ hashString(q.id + 'm')),
    );
  }, [q, seed]);

  if ((q.type === 'mcq' || q.type === 'formula') && draft.type === 'choice') {
    return (
      <fieldset className="grid gap-2" disabled={disabled}>
        <legend className="sr-only">Choisis une réponse</legend>
        {choiceOrder.map((c, i) => {
          const selected = draft.choiceId === c.id;
          const showGood = result && c.id === q.correctId;
          const showBad = result && selected && c.id !== q.correctId;
          return (
            <label
              key={c.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                selected
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:bg-surface-2',
                showGood && 'border-success bg-success-soft',
                showBad && 'border-danger bg-danger-soft',
                disabled && 'cursor-default',
              )}
            >
              <input
                type="radio"
                name={id}
                className="mt-1 accent-[var(--primary)]"
                checked={selected}
                onChange={() => onChange({ type: 'choice', choiceId: c.id })}
              />
              <span className="min-w-0 flex-1">
                <span className="mr-2 font-semibold text-muted">
                  {String.fromCharCode(65 + i)}.
                </span>
                <Md text={c.text} as="span" />
                {result && (selected || c.id === q.correctId) && (
                  <span className="mt-1 block text-sm text-muted">
                    <Md text={c.why} as="span" />
                  </span>
                )}
              </span>
              {showGood && <Check className="text-success" size={18} aria-label="Bonne réponse" />}
              {showBad && (
                <X className="text-danger" size={18} aria-label="Ta réponse, incorrecte" />
              )}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (q.type === 'truefalse' && draft.type === 'boolean') {
    return (
      <div role="radiogroup" aria-label="Vrai ou faux" className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => {
          const selected = draft.value === v;
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange({ type: 'boolean', value: v })}
              className={cn(
                'h-12 rounded-xl border font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface hover:bg-surface-2',
                result && v === q.answer && 'border-success bg-success-soft text-success',
                result && selected && v !== q.answer && 'border-danger bg-danger-soft text-danger',
              )}
            >
              {v ? 'Vrai' : 'Faux'}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === 'numeric' && draft.type === 'text') {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
          Ta réponse {q.answer.unitRequired ? '(avec son unité)' : ''}
        </label>
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          value={draft.value}
          onChange={(e) => onChange({ type: 'text', value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={
            q.answer.unitRequired ? 'ex. 0,26 Ω  ·  1,6e-19 C  ·  5·10^20 m^-3' : 'ex. 1,66e20'
          }
          aria-describedby={`${id}-help`}
          className={cn(
            'h-12 w-full rounded-xl border bg-surface px-4 font-mono text-base text-text outline-none focus:border-primary',
            result ? (result.correct ? 'border-success' : 'border-danger') : 'border-border',
          )}
        />
        {!disabled && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Insérer un symbole">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                className="h-8 min-w-8 rounded-lg border border-border bg-surface-2 px-2 font-mono text-sm hover:bg-surface"
                onClick={() => onChange({ type: 'text', value: draft.value + s })}
                aria-label={`Insérer ${s}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <p id={`${id}-help`} className="mt-2 text-xs text-muted">
          Virgule ou point, notation scientifique (1,6e-19 ou 1,6·10^-19) et préfixes (mΩ, µC, pF,
          cm⁻³) acceptés.
        </p>
      </div>
    );
  }

  if (q.type === 'matching' && draft.type === 'matching') {
    return (
      <div className="grid gap-2">
        {q.pairs.map((p, i) => {
          const sel = draft.mapping[p.left] ?? '';
          const ok = result ? sel === p.right : null;
          return (
            <div
              key={p.left}
              className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[1fr_1.4fr] sm:items-center"
            >
              <label htmlFor={`${id}-${i}`} className="font-medium">
                <Md text={p.left} as="span" />
              </label>
              <select
                id={`${id}-${i}`}
                disabled={disabled}
                value={sel}
                onChange={(e) =>
                  onChange({
                    type: 'matching',
                    mapping: { ...draft.mapping, [p.left]: e.target.value },
                  })
                }
                className={cn(
                  'h-11 w-full rounded-lg border bg-surface-2 px-3 text-sm',
                  ok === true && 'border-success',
                  ok === false && 'border-danger',
                  ok === null && 'border-border',
                )}
              >
                <option value="">Choisir…</option>
                {rightOptions.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/\$/g, '')}
                  </option>
                ))}
              </select>
              {ok === false && (
                <p className="text-sm text-success sm:col-start-2">Attendu : {p.right}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (q.type === 'ordering' && draft.type === 'ordering') {
    const move = (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= draft.order.length) return;
      const order = draft.order.slice();
      [order[i], order[j]] = [order[j]!, order[i]!];
      onChange({ type: 'ordering', order });
    };
    return (
      <ol className="grid gap-2">
        {draft.order.map((it, i) => {
          const ok = result ? q.items[i] === it : null;
          return (
            <li
              key={it}
              className={cn(
                'flex items-center gap-2 rounded-xl border bg-surface px-3 py-2',
                ok === true ? 'border-success' : ok === false ? 'border-danger' : 'border-border',
              )}
            >
              <span className="w-6 shrink-0 text-center font-semibold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <Md text={it} as="span" />
              </span>
              {!disabled && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-surface-2 disabled:opacity-30"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Monter « ${it} »`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-surface-2 disabled:opacity-30"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.order.length - 1}
                    aria-label={`Descendre « ${it} »`}
                  >
                    <ArrowDown size={16} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  if (q.type === 'selfcheck' && draft.type === 'selfcheck') {
    return <SelfCheckInput question={q} draft={draft} onChange={onChange} disabled={disabled} />;
  }

  return null;
}

function SelfCheckInput({
  question: q,
  draft,
  onChange,
  disabled,
}: {
  question: Extract<Question, { type: 'selfcheck' }>;
  draft: Extract<Draft, { type: 'selfcheck' }>;
  onChange: (d: Draft) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  return (
    <div className="grid gap-3">
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          Rédige ta réponse (elle n’est pas notée automatiquement)
        </label>
        <textarea
          id={id}
          rows={4}
          disabled={disabled || draft.revealed}
          value={draft.draft}
          onChange={(e) => {
            setTouched(true);
            onChange({ ...draft, draft: e.target.value });
          }}
          className="w-full rounded-xl border border-border bg-surface p-3 text-text outline-none focus:border-primary"
        />
      </div>
      {!draft.revealed ? (
        <button
          type="button"
          className="justify-self-start rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface"
          onClick={() => onChange({ ...draft, revealed: true })}
          disabled={disabled}
        >
          {touched || draft.draft
            ? 'Comparer avec la réponse modèle'
            : 'Je ne sais pas : voir la réponse modèle'}
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="text-sm font-semibold text-navy">Réponse modèle</div>
          <Md text={q.modelAnswer} className="mt-1 text-sm" />
          <div className="mt-3 text-sm font-semibold text-navy">
            Autocorrection : coche les critères que ta réponse remplit
          </div>
          <div className="mt-2 grid gap-2">
            {q.criteria.map((c, i) => (
              <label key={c} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  disabled={disabled}
                  checked={draft.criteriaMet[i] ?? false}
                  onChange={(e) => {
                    const criteriaMet = draft.criteriaMet.slice();
                    criteriaMet[i] = e.target.checked;
                    onChange({ ...draft, criteriaMet });
                  }}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
