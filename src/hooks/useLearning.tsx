import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '@/db';
import { derive, EMPTY_DATA, type Derived, type LearningData } from '@/features/progress/derive';
import { useSettings } from '@/stores/settings';

interface LearningContextValue {
  data: LearningData;
  derived: Derived;
  loading: boolean;
  cardsReviewed: number;
  diagnosticDone: boolean;
  cours0Mode: 'essentiel' | 'complet';
}

const LearningContext = createContext<LearningContextValue | null>(null);

/** Charge une seule fois les données IndexedDB (réactives) et les calculs dérivés pour toute l'app. */
export function LearningProvider({ children }: { children: ReactNode }) {
  const result = useLiveQuery(async () => {
    const [attempts, mistakes, lessonProgress, exerciseProgress, reviews, sessions, exams, meta] =
      await Promise.all([
        db.attempts.toArray(),
        db.mistakes.toArray(),
        db.lessonProgress.toArray(),
        db.exerciseProgress.toArray(),
        db.reviews.toArray(),
        db.sessions.toArray(),
        db.exams.toArray(),
        db.meta.toArray(),
      ]);
    const metaMap = new Map(meta.map((m) => [m.key, m.value]));
    const activeDays = meta.filter((m) => m.key.startsWith('active-')).map((m) => m.key.slice(7));
    return {
      data: {
        attempts,
        mistakes,
        lessonProgress,
        exerciseProgress,
        reviews,
        sessions,
        exams,
        activeDays,
      } satisfies LearningData,
      cardsReviewed: (metaMap.get('cardsReviewed') as number | undefined) ?? 0,
      diagnosticDone: metaMap.get('diagnosticDone') === true,
    };
  }, []);
  const cours0Mode = useSettings((s) => s.cours0Mode);
  const data = result?.data ?? EMPTY_DATA;
  const cardsReviewed = result?.cardsReviewed ?? 0;
  const value = useMemo<LearningContextValue>(
    () => ({
      data,
      derived: derive(data, { cours0Mode, cardsReviewed }),
      loading: result === undefined,
      cardsReviewed,
      diagnosticDone: result?.diagnosticDone ?? false,
      cours0Mode,
    }),
    [data, cours0Mode, cardsReviewed, result],
  );
  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useDerived(): LearningContextValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useDerived doit être utilisé dans <LearningProvider>');
  return ctx;
}
