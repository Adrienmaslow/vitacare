import { CheckCircle2, Circle, CircleDot, RotateCcw } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { MASTERY_LABEL } from '@/engines/mastery-engine/mastery';
import type { LessonStatus, MasteryStatus } from '@/types';

export const LESSON_STATUS: Record<
  LessonStatus,
  { label: string; tone: Tone; Icon: typeof Circle }
> = {
  'a-decouvrir': { label: 'À découvrir', tone: 'neutral', Icon: Circle },
  'en-cours': { label: 'En cours', tone: 'primary', Icon: CircleDot },
  termine: { label: 'Terminé', tone: 'success', Icon: CheckCircle2 },
  'a-revoir': { label: 'À revoir', tone: 'warning', Icon: RotateCcw },
};

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const s = LESSON_STATUS[status];
  return (
    <Badge tone={s.tone}>
      <s.Icon size={12} aria-hidden />
      {s.label}
    </Badge>
  );
}

const MASTERY_TONE: Record<MasteryStatus, Tone> = {
  'non-etudiee': 'neutral',
  'en-apprentissage': 'primary',
  'a-consolider': 'warning',
  maitrisee: 'success',
  'a-revoir': 'danger',
};

export function MasteryBadge({ status }: { status: MasteryStatus }) {
  return <Badge tone={MASTERY_TONE[status]}>{MASTERY_LABEL[status]}</Badge>;
}
