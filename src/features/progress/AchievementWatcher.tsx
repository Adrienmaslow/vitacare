import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { unlockAchievement } from '@/db/repo';
import { ACHIEVEMENTS } from '@/engines/achievements';
import { useDerived } from '@/hooks/useLearning';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';

/** Débloque les badges dès que leur condition est remplie (données réelles uniquement). */
export function AchievementWatcher() {
  const { data, derived, cardsReviewed, loading } = useDerived();
  const unlocked = useLiveQuery(() => db.achievements.toArray(), []);
  const gamification = useSettings((s) => s.gamification);
  const toast = useUi((s) => s.toast);
  const busy = useRef(false);
  useEffect(() => {
    if (loading || !unlocked || busy.current) return;
    const have = new Set(unlocked.map((a) => a.id));
    const fresh = ACHIEVEMENTS.filter(
      (a) => !have.has(a.id) && a.check(data, derived, { cardsReviewed }),
    );
    if (!fresh.length) return;
    busy.current = true;
    void Promise.all(fresh.map((a) => unlockAchievement(a.id))).finally(() => {
      busy.current = false;
      if (gamification)
        for (const a of fresh)
          toast({
            title: `Badge débloqué : ${a.title}`,
            description: a.description,
            tone: 'success',
          });
    });
  }, [data, derived, cardsReviewed, loading, unlocked, gamification, toast]);
  return null;
}
