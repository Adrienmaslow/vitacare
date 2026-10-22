import { useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/misc';
import { Segmented, Switch } from '@/components/ui/Switch';
import { FormulaCard } from '@/components/lessons/FormulaCard';
import { CHAPTERS, FORMULAS, conceptById } from '@/content';

export default function FormulasPage() {
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState('all');
  const [tdOnly, setTdOnly] = useState(false);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FORMULAS.filter((f) => {
      const ch = conceptById(f.conceptIds[0]!)?.chapterId;
      if (chapter !== 'all' && ch !== chapter) return false;
      if (tdOnly && f.usedIn.length === 0) return false;
      if (!q) return true;
      return `${f.name} ${f.meaning} ${f.variables.map((v) => v.name).join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [query, chapter, tdOnly]);
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Formules"
        subtitle="Chaque formule : sens, unités, conditions d’utilisation, intuition, exemple, pièges et référence dans le cours."
        actions={
          <ButtonLink
            to="/ressources/fiches/formulaire-td"
            variant="secondary"
            icon={<Printer size={16} />}
          >
            Formulaire TD1 + TD2
          </ButtonLink>
        }
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <label className="relative block">
          <span className="sr-only">Rechercher une formule</span>
          <Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (résistivité, mobilité, capacité…)"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-9 outline-none focus:border-primary"
          />
        </label>
        <Segmented
          label="Chapitre"
          value={chapter}
          onChange={setChapter}
          options={[
            { value: 'all', label: 'Tous' },
            ...CHAPTERS.map((c) => ({ value: c.id, label: c.shortTitle })),
          ]}
        />
      </div>
      <div className="max-w-md">
        <Switch
          checked={tdOnly}
          onChange={setTdOnly}
          label="Uniquement les formules utilisées en TD1/TD2"
        />
      </div>
      <p className="text-sm text-muted">
        {list.length} formule{list.length > 1 ? 's' : ''}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((f) => (
          <FormulaCard key={f.id} formula={f} compact />
        ))}
      </div>
    </div>
  );
}
