import katex from 'katex';
import { Fragment, memo, useMemo, type ReactNode } from 'react';

const cache = new Map<string, string>();

function renderTex(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (!html) {
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    });
    cache.set(key, html);
  }
  return html;
}

/** Formule LaTeX (contenu interne et vérifié uniquement). */
export const Tex = memo(function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => renderTex(tex, display), [tex, display]);
  if (display) return <div className="math-block" dangerouslySetInnerHTML={{ __html: html }} />;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Mise en forme légère : **gras**, $math$, $$math$$, paragraphes séparés par une ligne vide. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last)
      out.push(<Fragment key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) out.push(<Tex key={`${keyBase}-d${i++}`} tex={m[1]} display />);
    else if (m[2] !== undefined) out.push(<Tex key={`${keyBase}-m${i++}`} tex={m[2]} />);
    else if (m[3] !== undefined)
      out.push(
        <strong key={`${keyBase}-b${i++}`} className="font-semibold">
          {inline(m[3], `${keyBase}-b${i}`)}
        </strong>,
      );
    last = re.lastIndex;
  }
  if (last < text.length)
    out.push(<Fragment key={`${keyBase}-t${i++}`}>{text.slice(last)}</Fragment>);
  return out;
}

export function Md({
  text,
  className,
  as = 'div',
}: {
  text: string;
  className?: string;
  as?: 'div' | 'span';
}) {
  if (as === 'span') return <span className={className}>{inline(text, 's')}</span>;
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i} className={i > 0 ? 'mt-2' : undefined}>
          {inline(p, `p${i}`)}
        </p>
      ))}
    </div>
  );
}
