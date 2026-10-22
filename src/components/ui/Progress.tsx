import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  label,
  tone = 'primary',
  className,
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'teal' | 'success' | 'warning';
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = {
    primary: 'bg-primary',
    teal: 'bg-teal',
    success: 'bg-success',
    warning: 'bg-warning',
  }[tone];
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Jauge circulaire. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  label,
  tone = 'primary',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  tone?: 'primary' | 'teal' | 'success';
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = { primary: 'var(--primary)', teal: 'var(--teal)', success: 'var(--success)' }[tone];
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} : ${Math.round(v * 100)} %`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-navy">
        {children ?? `${Math.round(v * 100)}%`}
      </div>
    </div>
  );
}
