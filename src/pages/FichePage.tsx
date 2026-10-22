import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Md, Tex } from '@/components/ui/Math';
import { PageHeader, SourceTag } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Switch';
import { FormulaCard } from '@/components/lessons/FormulaCard';
import {
  FORMULAS,
  GLOSSARY,
  chapterById,
  conceptById,
  conceptsOfChapter,
  exercisesOfChapter,
  lessonsOfChapter,
} from '@/content';
import type { Formula } from '@/types';
import NotFoundPage from './NotFoundPage';

type Kind = 'complete' | 'express' | 'formulaire' | 'lexique' | 'pieges' | 'methodes';

const formulasOfChapter = (chapterId: string): Formula[] =>
  FORMULAS.filter((f) => conceptById(f.conceptIds[0]!)?.chapterId === chapterId);

export default function FichePage() {
  const { ficheId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('type') as Kind) || 'complete';

  if (ficheId === 'formulaire-td') return <TdFormulaSheet />;
  const chapter = chapterById(ficheId);
  if (!chapter) return <NotFoundPage />;
  const lessons = lessonsOfChapter(chapter.id);
  const formulas = formulasOfChapter(chapter.id);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow={`Fiche · ${chapter.shortTitle}`}
          title={chapter.title}
          actions={
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>
              Imprimer / PDF
            </Button>
          }
        />
        <Segmented
          label="Type de fiche"
          value={kind}
          onChange={(v) => setParams({ type: v })}
          options={[
            { value: 'complete', label: 'Complète' },
            { value: 'express', label: 'Express' },
            { value: 'formulaire', label: 'Formulaire' },
            { value: 'lexique', label: 'Lexique' },
            { value: 'pieges', label: 'Pièges' },
            { value: 'methodes', label: 'Méthodes' },
          ]}
        />
      </div>
      <h1 className="mt-0 hidden text-xl font-semibold print:block">
        ECE STUDY — {chapter.shortTitle} : {chapter.title}
      </h1>
      <div className="mt-5 grid gap-5">
        {kind === 'complete' &&
          lessons.map((l) => (
            <section key={l.id} className="break-inside-avoid-page">
              <h2 className="text-lg font-semibold text-navy">{l.title}</h2>
              <p className="text-sm text-muted">{l.why}</p>
              <div className="mt-2 grid gap-2 text-[0.95rem]">
                {l.blocks.map((b, i) => {
                  if (b.kind === 'text') return <Md key={i} text={b.md} />;
                  if (b.kind === 'list')
                    return (
                      <ul key={i} className="list-disc pl-5">
                        {b.items.map((it) => (
                          <li key={it}>
                            <Md text={it} as="span" />
                          </li>
                        ))}
                      </ul>
                    );
                  if (b.kind === 'formula') {
                    const f = FORMULAS.find((x) => x.id === b.formulaId);
                    return f ? (
                      <div key={i} className="rounded-lg bg-surface-2 px-3 py-1">
                        <span className="text-sm font-medium">{f.name}</span>
                        <Tex tex={f.latex} display />
                      </div>
                    ) : null;
                  }
                  if (b.kind === 'math') return <Tex key={i} tex={b.latex} display />;
                  if (b.kind === 'callout')
                    return (
                      <div key={i} className="border-l-4 border-primary/40 pl-3 text-sm">
                        <span className="font-semibold">{b.title} : </span>
                        <Md text={b.md} as="span" />
                      </div>
                    );
                  if (b.kind === 'heading')
                    return (
                      <h3 key={i} className="font-semibold">
                        {b.text}
                      </h3>
                    );
                  return null;
                })}
              </div>
              <div className="mt-1">
                {l.sources.map((s) => (
                  <SourceTag key={s.doc + s.pages} source={s} />
                ))}
              </div>
            </section>
          ))}
        {kind === 'express' && (
          <>
            <ul className="grid gap-2">
              {conceptsOfChapter(chapter.id).map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.title}</span> —{' '}
                  <Md text={c.summary} as="span" />
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              {formulas.map((f) => (
                <div key={f.id} className="rounded-xl border border-border p-2">
                  <div className="text-sm font-medium">{f.name}</div>
                  <Tex tex={f.latex} display />
                </div>
              ))}
            </div>
          </>
        )}
        {kind === 'formulaire' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {formulas.map((f) => (
              <FormulaCard key={f.id} formula={f} compact defaultOpen />
            ))}
          </div>
        )}
        {kind === 'lexique' && (
          <dl className="grid gap-2">
            {GLOSSARY.filter((g) => g.chapterId === chapter.id).map((g) => (
              <div key={g.term} className="rounded-xl bg-surface-2 p-3">
                <dt className="font-semibold">{g.term}</dt>
                <dd className="text-muted">{g.definition}</dd>
              </div>
            ))}
          </dl>
        )}
        {kind === 'pieges' && (
          <ul className="grid list-disc gap-2 pl-5">
            {formulas.flatMap((f) =>
              f.pitfalls.map((p) => (
                <li key={f.id + p}>
                  <span className="font-medium">{f.name} : </span>
                  <Md text={p} as="span" />
                </li>
              )),
            )}
            {lessons.flatMap((l) =>
              l.blocks
                .filter(
                  (b) => b.kind === 'callout' && (b.tone === 'warning' || b.tone === 'erratum'),
                )
                .map((b, i) =>
                  b.kind === 'callout' ? (
                    <li key={l.id + i}>
                      <span className="font-medium">{b.title} : </span>
                      <Md text={b.md} as="span" />
                    </li>
                  ) : null,
                ),
            )}
          </ul>
        )}
        {kind === 'methodes' && (
          <div className="grid gap-3">
            {lessons.flatMap((l) =>
              l.blocks
                .filter((b) => b.kind === 'callout' && b.tone === 'method')
                .map((b, i) =>
                  b.kind === 'callout' ? (
                    <div key={l.id + i} className="rounded-xl bg-success-soft p-3">
                      <div className="font-semibold">{b.title}</div>
                      <Md text={b.md} />
                    </div>
                  ) : null,
                ),
            )}
            {exercisesOfChapter(chapter.id).map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-3 text-sm">
                <Link to={`/exercices/${e.id}`} className="font-semibold text-primary">
                  {e.td} · Ex. {e.number} — {e.title}
                </Link>
                <div className="text-muted">Méthode : {e.skills.join(' → ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TdFormulaSheet() {
  const list = FORMULAS.filter((f) => f.usedIn.length > 0);
  return (
    <div>
      <div className="no-print">
        <PageHeader
          eyebrow="Fiche transversale"
          title="Toutes les formules indispensables pour les TD1 et TD2"
          subtitle="Nom, expression, sens, variables, unités, conditions et référence dans le cours."
          actions={
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>
              Imprimer / PDF
            </Button>
          }
        />
      </div>
      <h1 className="hidden text-xl font-semibold print:block">
        ECE STUDY — Formulaire TD1 et TD2
      </h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {list.map((f) => (
          <FormulaCard key={f.id} formula={f} compact defaultOpen />
        ))}
      </div>
    </div>
  );
}
