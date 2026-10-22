import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Switch';
import { Md } from '@/components/ui/Math';
import { conceptById, EXPLANATIONS, lessonForConcept } from '@/content';
import { useUi } from '@/stores/ui';

type Tab = 'autrement' | 'analogie' | 'exemple' | 'erreur' | 'prerequis' | 'consigne';

/**
 * « Explique-moi » : aide contextuelle construite à partir de contenus pré-écrits et vérifiés.
 * Ce n'est pas un chatbot : aucune réponse libre n'est générée.
 */
export function ExplainPanel() {
  const { explain, closeExplain } = useUi();
  const [tab, setTab] = useState<Tab>('autrement');
  const [conceptIndex, setConceptIndex] = useState(0);
  const conceptIds = explain?.conceptIds ?? [];
  const conceptId = conceptIds[Math.min(conceptIndex, conceptIds.length - 1)];
  const concept = conceptId ? conceptById(conceptId) : undefined;
  const ex = conceptId ? EXPLANATIONS[conceptId] : undefined;
  const lesson = conceptId ? lessonForConcept(conceptId) : undefined;
  const tabs: { value: Tab; label: string }[] = [
    { value: 'autrement', label: 'Autrement dit' },
    { value: 'analogie', label: 'Analogie' },
    { value: 'exemple', label: 'Exemple simple' },
    { value: 'erreur', label: 'Erreur fréquente' },
    { value: 'prerequis', label: 'Prérequis' },
    ...(explain?.rephrase ? [{ value: 'consigne' as Tab, label: 'La consigne' }] : []),
  ];

  return (
    <Dialog
      open={!!explain}
      onClose={() => {
        closeExplain();
        setTab('autrement');
        setConceptIndex(0);
      }}
      title="Explique-moi"
      side
    >
      {concept && ex ? (
        <div className="grid gap-4">
          {conceptIds.length > 1 && (
            <div>
              <label htmlFor="explain-concept" className="text-sm font-medium text-muted">
                Notion
              </label>
              <select
                id="explain-concept"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface-2 px-3"
                value={conceptIndex}
                onChange={(e) => setConceptIndex(Number(e.target.value))}
              >
                {conceptIds.map((c, i) => (
                  <option key={c} value={i}>
                    {conceptById(c)?.title ?? c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-navy">{concept.title}</h3>
            <p className="text-sm text-muted">{concept.summary}</p>
          </div>
          <Segmented label="Type d’aide" value={tab} options={tabs} onChange={setTab} />
          <div className="rounded-xl bg-surface-2 p-4 text-[0.97rem] leading-relaxed">
            {tab === 'autrement' && <Md text={ex.otherWords} />}
            {tab === 'analogie' && <Md text={ex.analogy} />}
            {tab === 'exemple' && <Md text={ex.simpleExample} />}
            {tab === 'erreur' && <Md text={ex.commonMistake} />}
            {tab === 'consigne' && explain?.rephrase && <Md text={explain.rephrase} />}
            {tab === 'prerequis' &&
              (concept.prerequisiteIds.length === 0 ? (
                <p>Aucun prérequis particulier : c’est une notion de départ.</p>
              ) : (
                <ul className="grid gap-2">
                  {concept.prerequisiteIds.map((p) => {
                    const pc = conceptById(p);
                    const pl = lessonForConcept(p);
                    return (
                      <li key={p}>
                        <span className="font-medium">{pc?.title}</span>
                        <span className="text-sm text-muted"> — {pc?.summary}</span>
                        {pl && (
                          <Link
                            to={`/lecons/${pl.id}`}
                            onClick={closeExplain}
                            className="ml-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Revoir
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>
          {lesson && (
            <Link
              to={`/lecons/${lesson.id}`}
              onClick={closeExplain}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Ouvrir la leçon « {lesson.title} » <ArrowRight size={14} />
            </Link>
          )}
          <p className="flex gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            Aide rédigée et vérifiée à l’avance à partir du cours. Ce n’est pas un assistant IA :
            aucune réponse n’est générée librement.
          </p>
        </div>
      ) : (
        <p className="text-muted">Aucune notion sélectionnée.</p>
      )}
    </Dialog>
  );
}
