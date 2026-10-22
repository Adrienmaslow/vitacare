import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page introuvable"
      action={<ButtonLink to="/dashboard">Retour au tableau de bord</ButtonLink>}
    >
      Ce lien ne correspond à aucune page d’ECE STUDY.
    </EmptyState>
  );
}
