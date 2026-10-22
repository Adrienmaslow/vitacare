import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BadgeAlert, BookMarked, ExternalLink, FileUp, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/misc';
import { Md } from '@/components/ui/Math';
import { CHAPTERS, DOCS, EXERCISES, LESSONS } from '@/content';
import { db } from '@/db';
import { openLocalDoc, removeLocalDoc, saveLocalDoc } from '@/lib/localDocs';
import { useUi } from '@/stores/ui';
import type { DocId } from '@/types';

export default function ResourcesPage() {
  const docs = useLiveQuery(() => db.docs.toArray(), []);
  const toast = useUi((s) => s.toast);
  const inputs = useRef<Partial<Record<DocId, HTMLInputElement | null>>>({});
  const errata = [
    ...LESSONS.flatMap((l) =>
      l.blocks
        .filter((b) => b.kind === 'callout' && b.tone === 'erratum')
        .map((b) => ({
          where: l.title,
          to: `/lecons/${l.id}`,
          text: b.kind === 'callout' ? b.md : '',
        })),
    ),
    ...EXERCISES.flatMap((e) =>
      e.parts
        .filter((p) => p.erratum)
        .map((p) => ({
          where: `${e.td} · Ex. ${e.number} · ${p.id}`,
          to: `/exercices/${e.id}`,
          text: p.erratum!,
        })),
    ),
  ];

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Ressources"
        subtitle="Fiches de révision imprimables, formulaire des TD, documents de cours en consultation locale, et audit du contenu."
      />

      <Card>
        <CardHeader
          icon={<BookMarked size={20} />}
          title="Fiches de révision"
          subtitle="Fiche complète, express, formulaire, lexique, pièges et méthodes — affichage mobile et version imprimable (PDF via l’impression du navigateur)."
        />
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <Link
                to={`/ressources/fiches/${c.id}`}
                className="block rounded-xl border border-border p-3 hover:bg-surface-2"
              >
                <div className="text-sm text-primary">{c.shortTitle}</div>
                <div className="font-medium">{c.title}</div>
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/ressources/fiches/formulaire-td"
              className="block rounded-xl border border-primary/40 bg-primary-soft p-3 hover:brightness-95"
            >
              <div className="text-sm text-primary">Transversal</div>
              <div className="font-medium">Toutes les formules des TD1 et TD2</div>
            </Link>
          </li>
        </ul>
      </Card>

      <Card id="documents">
        <CardHeader
          icon={<ShieldCheck size={20} />}
          title="Mes documents de cours (consultation locale)"
          subtitle="Les PDF originaux ne sont pas publiés avec le site. Importe tes propres fichiers : ils restent dans ce navigateur (IndexedDB), ne sont jamais envoyés ni exportés, et s’ouvrent à la bonne page depuis les exercices."
        />
        <ul className="grid gap-2 px-5 pb-5">
          {(Object.keys(DOCS) as DocId[]).map((id) => {
            const d = docs?.find((x) => x.id === id);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{DOCS[id].title}</div>
                  <div className="text-xs text-muted">
                    {d
                      ? `${d.name} · ${(d.size / 1e6).toFixed(1)} Mo`
                      : `${DOCS[id].authors} · non importé`}
                  </div>
                </div>
                <input
                  ref={(el) => {
                    inputs.current[id] = el;
                  }}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  aria-label={`Importer ${DOCS[id].title}`}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    await saveLocalDoc(id, f);
                    toast({
                      title: 'Document importé',
                      description: 'Il reste uniquement sur cet appareil.',
                      tone: 'success',
                    });
                    e.target.value = '';
                  }}
                />
                {d ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ExternalLink size={15} />}
                      onClick={() => void openLocalDoc(id)}
                    >
                      Ouvrir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={15} />}
                      onClick={() => void removeLocalDoc(id)}
                      aria-label={`Retirer ${DOCS[id].title}`}
                    >
                      Retirer
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<FileUp size={15} />}
                    onClick={() => inputs.current[id]?.click()}
                  >
                    Importer le PDF
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader
          icon={<BadgeAlert size={20} />}
          title="Écarts relevés dans les supports"
          subtitle={`${errata.length} points signalés lors de l’audit documentaire (détails dans CONTENT_AUDIT.md du dépôt).`}
        />
        <ul className="grid gap-2 px-5 pb-5 text-sm">
          {errata.map((e, i) => (
            <li key={i} className="rounded-xl bg-surface-2 p-3">
              <Link to={e.to} className="font-medium text-primary">
                {e.where}
              </Link>
              <Md text={e.text} className="mt-1 text-muted" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
