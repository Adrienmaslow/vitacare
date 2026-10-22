import type { ReactNode } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { sourceLabel } from '@/content';
import type { SourceReference } from '@/types';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="font-semibold text-navy">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SourceTag({ source, className }: { source: SourceReference; className?: string }) {
  const Icon = source.doc === 'livret' ? FileText : BookOpen;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted', className)}>
      <Icon size={13} aria-hidden />
      <span>{sourceLabel(source)}</span>
    </span>
  );
}

export function OriginTag({ origin }: { origin: 'pdf' | 'ece-study' | 'livret' }) {
  return origin === 'ece-study' ? (
    <span className="rounded-md bg-teal-soft px-1.5 py-0.5 text-[0.7rem] font-medium text-teal">
      Ajout ECE STUDY
    </span>
  ) : (
    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-medium text-muted">
      Source : support officiel
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-xl font-semibold text-navy tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export const DIFFICULTY_LABEL = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' } as const;
