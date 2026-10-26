/** Défis de la gamification (facultative). Aucun défi n'incite à dépenser ni ne pénalise une période difficile. */
export interface Achievement {
  slug: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { slug: "first-account", title: "Premier pas", description: "Ajouter ton premier compte.", icon: "wallet" },
  { slug: "first-budget", title: "Cap fixé", description: "Créer ton premier budget.", icon: "target" },
  { slug: "tracking-7-days", title: "Une semaine de suivi", description: "Enregistrer des opérations sur 7 jours différents.", icon: "calendar-check" },
  { slug: "first-goal", title: "Un projet en tête", description: "Définir un objectif d'épargne.", icon: "flag" },
  { slug: "aid-explorer", title: "Droits explorés", description: "Suivre au moins une aide pertinente.", icon: "hand-heart" },
  { slug: "subscription-check", title: "Abonnements passés au crible", description: "Comparer un abonnement ou un bon plan.", icon: "repeat" },
  { slug: "first-review", title: "Premier bilan", description: "Consulter tes analyses avec au moins un mois complet de données.", icon: "chart-pie" },
  { slug: "three-actions", title: "Passage à l'action", description: "Terminer trois actions de ton plan.", icon: "check-check" },
  { slug: "csv-import", title: "Import réussi", description: "Importer un relevé bancaire CSV.", icon: "upload" },
  { slug: "quiz-budget", title: "Culture financière", description: "Réussir un quiz de culture financière.", icon: "graduation-cap" },
];
