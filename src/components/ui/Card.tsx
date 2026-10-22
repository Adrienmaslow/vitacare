import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('min-w-0 rounded-2xl border border-border bg-surface shadow-card', className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 text-primary">{icon}</div>}
        <div className="min-w-0">
          <Heading className="text-[1.02rem] font-semibold tracking-tight text-navy">
            {title}
          </Heading>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
