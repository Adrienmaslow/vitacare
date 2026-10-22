import { useMemo } from 'react';
import { addDays, dayKey } from '@/lib/dates';
import type { LearningData } from '@/features/progress/derive';

/** Calendrier d'activité (12 dernières semaines) : minutes actives réelles + réponses données. */
export function ActivityCalendar({ data, weeks = 12 }: { data: LearningData; weeks?: number }) {
  const { columns, max } = useMemo(() => {
    const minutes = new Map<string, number>();
    for (const s of data.sessions)
      minutes.set(s.day, (minutes.get(s.day) ?? 0) + s.activeMs / 60_000);
    const answers = new Map<string, number>();
    for (const a of data.attempts) {
      const k = dayKey(a.at);
      answers.set(k, (answers.get(k) ?? 0) + 1);
    }
    const today = dayKey();
    const d = new Date();
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    const start = addDays(today, -(weeks * 7 - 1) - (6 - dow));
    const cols: { day: string; min: number; ans: number; future: boolean }[][] = [];
    let mx = 0;
    for (let w = 0; w < weeks + 1; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(start, w * 7 + i);
        const min = minutes.get(day) ?? 0;
        const ans = answers.get(day) ?? 0;
        mx = Math.max(mx, min);
        col.push({ day, min, ans, future: day > today });
      }
      cols.push(col);
    }
    return { columns: cols, max: mx };
  }, [data, weeks]);

  const level = (min: number, ans: number) => {
    if (min <= 0 && ans <= 0) return 0;
    if (max <= 0) return 1;
    const r = min / max;
    return r > 0.66 ? 4 : r > 0.33 ? 3 : r > 0.05 ? 2 : 1;
  };
  const colors = [
    'var(--surface-2)',
    'color-mix(in srgb, var(--primary) 30%, var(--surface))',
    'color-mix(in srgb, var(--primary) 55%, var(--surface))',
    'color-mix(in srgb, var(--primary) 78%, var(--surface))',
    'var(--primary)',
  ];

  return (
    <div>
      <div
        className="flex gap-[3px] overflow-x-auto pb-1"
        role="img"
        aria-label="Calendrier d’activité des 12 dernières semaines"
      >
        {columns.map((col, i) => (
          <div key={i} className="grid grid-rows-7 gap-[3px]">
            {col.map((c) => (
              <div
                key={c.day}
                title={
                  c.future
                    ? ''
                    : `${new Date(c.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${Math.round(c.min)} min, ${c.ans} réponse${c.ans > 1 ? 's' : ''}`
                }
                className="h-3 w-3 rounded-[3px]"
                style={{ background: c.future ? 'transparent' : colors[level(c.min, c.ans)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        Moins
        {colors.map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
        ))}
        Plus
      </div>
    </div>
  );
}
