import { AlertTriangle, BadgeAlert, Info, Lightbulb, Microscope } from 'lucide-react';
import { Md, Tex } from '@/components/ui/Math';
import { SourceTag } from '@/components/ui/misc';
import { QuestionCard } from '@/components/quizzes/QuestionCard';
import { Visual } from '@/components/visuals';
import { formulaById, questionById } from '@/content';
import type { LessonBlock } from '@/types';
import { FormulaCard } from './FormulaCard';

const CALLOUT = {
  info: { Icon: Info, cls: 'border-primary/30 bg-primary-soft/50', title: 'text-primary' },
  warning: { Icon: AlertTriangle, cls: 'border-warning/40 bg-warning-soft', title: 'text-warning' },
  limit: { Icon: Microscope, cls: 'border-teal/30 bg-teal-soft/60', title: 'text-teal' },
  erratum: { Icon: BadgeAlert, cls: 'border-danger/30 bg-danger-soft', title: 'text-danger' },
  method: { Icon: Lightbulb, cls: 'border-success/30 bg-success-soft', title: 'text-success' },
} as const;

export function LessonBlockView({
  block,
  lessonId,
  index,
}: {
  block: LessonBlock;
  lessonId: string;
  index: number;
}) {
  switch (block.kind) {
    case 'heading':
      return <h2 className="mt-2 text-lg font-semibold text-navy">{block.text}</h2>;
    case 'text':
      return <Md text={block.md} className="leading-relaxed" />;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={`grid gap-1.5 pl-5 leading-relaxed ${block.ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {block.items.map((it) => (
            <li key={it}>
              <Md text={it} as="span" />
            </li>
          ))}
        </Tag>
      );
    }
    case 'math':
      return <Tex tex={block.latex} display />;
    case 'formula': {
      const f = formulaById(block.formulaId);
      return f ? <FormulaCard formula={f} /> : null;
    }
    case 'callout': {
      const c = CALLOUT[block.tone];
      return (
        <aside className={`rounded-2xl border p-4 ${c.cls}`}>
          <div className={`flex items-center gap-2 font-semibold ${c.title}`}>
            <c.Icon size={17} aria-hidden /> {block.title}
          </div>
          <Md text={block.md} className="mt-1 text-[0.95rem] text-text" />
        </aside>
      );
    }
    case 'example':
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-primary">Exemple — {block.title}</div>
          <Md text={block.statement} className="mt-1" />
          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-[0.95rem]">
            {block.steps.map((s) => (
              <li key={s}>
                <Md text={s} as="span" />
              </li>
            ))}
          </ol>
          {block.source && <SourceTag source={block.source} className="mt-2" />}
        </div>
      );
    case 'visual':
      return (
        <figure>
          <Visual id={block.visual} />
          <figcaption className="mt-2 text-sm text-muted">{block.caption}</figcaption>
        </figure>
      );
    case 'check': {
      const q = questionById(block.questionId);
      if (!q) return null;
      return (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 p-4">
          <div className="mb-2 text-sm font-semibold text-primary">Vérifie ta compréhension</div>
          <QuestionCard
            question={q}
            context="lesson"
            refId={lessonId}
            label="Vérification en cours de leçon"
            seed={index * 7919}
          />
        </div>
      );
    }
  }
}
