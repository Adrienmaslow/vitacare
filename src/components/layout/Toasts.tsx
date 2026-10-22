import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useUi } from '@/stores/ui';

export function Toasts() {
  const { toasts, dismissToast } = useUi();
  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon =
          t.tone === 'success' ? CheckCircle2 : t.tone === 'warning' ? TriangleAlert : Info;
        return (
          <div
            key={t.id}
            className="animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xl"
          >
            <Icon
              size={20}
              className={
                t.tone === 'success'
                  ? 'text-success'
                  : t.tone === 'warning'
                    ? 'text-warning'
                    : 'text-primary'
              }
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-navy">{t.title}</div>
              {t.description && <div className="text-sm text-muted">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Fermer la notification"
              className="rounded p-1 text-muted hover:bg-surface-2"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
