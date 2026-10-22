import { useId, type ReactNode } from 'react';

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-medium text-text">
          {label}
        </label>
        <output htmlFor={id} className="text-muted tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--primary)]"
      />
    </div>
  );
}

export function VisualFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2/60 p-4">
      {children}
      {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
    </div>
  );
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.motion === 'reduced'
  );
}
