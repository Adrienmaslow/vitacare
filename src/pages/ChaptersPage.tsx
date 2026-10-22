import { PageHeader } from '@/components/ui/misc';
import { ChapterCard } from '@/components/dashboard/ChapterCard';
import { allChapterStats } from '@/features/progress/derive';
import { useDerived } from '@/hooks/useLearning';
import { PLANNED_CHAPTERS } from '@/content';

export default function ChaptersPage() {
  const { data, derived, cours0Mode } = useDerived();
  return (
    <div>
      <PageHeader
        title="Chapitres"
        subtitle="Les trois cours de cette version, avec leur progression et leur maîtrise estimée."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {allChapterStats(data, derived, cours0Mode).map((s) => (
          <ChapterCard key={s.chapter.id} stats={s} />
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        À venir : {PLANNED_CHAPTERS.map((p) => `cours ${p.number}`).join(', ')}.
      </p>
    </div>
  );
}
