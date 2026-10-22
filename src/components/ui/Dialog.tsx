import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Boîte de dialogue modale accessible (<dialog> natif : focus piégé, Échap). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    }
    if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-0 max-h-[100dvh] w-full border-0 bg-transparent p-0 text-text backdrop:bg-black/40',
        side ? 'ml-auto h-[100dvh] max-w-md' : 'mx-auto mt-auto max-w-lg sm:my-auto',
      )}
    >
      {open && (
        <div
          className={cn(
            'animate-pop flex max-h-[100dvh] flex-col bg-surface shadow-2xl',
            side ? 'h-full' : 'rounded-t-2xl sm:rounded-2xl',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 id="dialog-title" className="text-lg font-semibold text-navy">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-surface-2"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
