import { create } from 'zustand';

export interface ExplainContext {
  conceptIds: string[];
  /** Ex. « TD1 · AD1.3 » : pour reformuler la consigne. */
  title?: string;
  rephrase?: string;
}

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone?: 'success' | 'info' | 'warning';
}

interface UiState {
  explain: ExplainContext | null;
  openExplain: (ctx: ExplainContext) => void;
  closeExplain: () => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set) => ({
  explain: null,
  openExplain: (ctx) => set({ explain: ctx }),
  closeExplain: () => set({ explain: null }),
  toasts: [],
  toast: (t) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
