import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { conceptById } from '@/content';
import type { ChapterStats } from '@/features/progress/derive';

export function ChapterCard({ stats }: { stats: ChapterStats }) {
  const { chapter } = stats;
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-primary">{chapter.shortTitle}</div>
          <h3 className="mt-0.5 font-semibold text-navy">{chapter.title}</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {chapter.tds.map((td) => (
            <Badge key={td} tone="teal">
              {td}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted">Parcours</span>
            <span className="tabular-nums">
              {stats.lessonsDone}/{stats.lessonsTotal} leçons
            </span>
          </div>
          <ProgressBar value={stats.pathProgress} label={`Parcours du ${chapter.shortTitle}`} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted">Maîtrise estimée</span>
            <span className="tabular-nums">
              {stats.conceptsStudied ? `${Math.round(stats.mastery * 100)} %` : '—'}
            </span>
          </div>
          <ProgressBar
            value={stats.mastery}
            tone="teal"
            label={`Maîtrise estimée du ${chapter.shortTitle}`}
          />
        </div>
        <div className="text-sm text-muted">
          {stats.totalAnswers
            ? `${stats.correctAnswers} question${stats.correctAnswers > 1 ? 's' : ''} réussie${stats.correctAnswers > 1 ? 's' : ''} sur ${stats.totalAnswers}`
            : 'Aucune question traitée pour l’instant.'}
        </div>
        {stats.fragile.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-warning">Notions fragiles : </span>
            {stats.fragile
              .slice(0, 3)
              .map((m) => conceptById(m.conceptId)?.title)
              .join(', ')}
          </div>
        )}
      </div>
      <Link
        to={`/chapitres/${chapter.id}`}
        className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-primary"
      >
        Ouvrir le chapitre <ArrowRight size={14} />
      </Link>
    </Card>
  );
}
