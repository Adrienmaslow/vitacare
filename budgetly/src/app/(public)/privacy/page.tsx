import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité" };

const SECTIONS: [string, string[]][] = [
  ["Statut de ce document", ["Ce document décrit le fonctionnement de BUDGETLY. Il doit être complété (identité du responsable de traitement, coordonnées, DPO éventuel) et relu par une personne compétente avant toute mise en production. La présence de cette page ne suffit pas à garantir la conformité au RGPD."]],
  ["Données collectées", ["Compte : adresse e-mail, mot de passe (géré par Supabase Auth, jamais stocké en clair).", "Profil facultatif : prénom ou pseudo, statut, tranche d'âge, ville, établissement, niveau d'études, logement, revenus déclarés, objectifs.", "Données financières saisies ou importées : comptes, opérations, budgets, abonnements, objectifs.", "Données facultatives : disponibilités et compétences (uniquement si tu actives les opportunités), suivi d'aides et de candidatures.", "Journal minimal d'événements de sécurité (sans montant ni donnée bancaire)."]],
  ["Finalités et bases légales", ["Fournir le service de gestion budgétaire : exécution du contrat.", "Estimation des aides et recommandation d'opportunités : consentement spécifique, révocable à tout moment.", "Reformulation des réponses du coach par IA : consentement spécifique, révocable.", "Sécurité du service (journalisation minimale, limitation de débit) : intérêt légitime."]],
  ["Ce que BUDGETLY ne fait pas", ["Aucune vente ni location de données.", "Aucune publicité ciblée.", "Aucune demande d'identifiants bancaires.", "Aucun stockage des fichiers CSV importés : ils sont lus dans ton navigateur.", "Aucune transmission de ton historique financier à un fournisseur d'IA."]],
  ["Sous-traitants", ["Supabase (base de données PostgreSQL et authentification) — région d'hébergement à choisir lors du déploiement (UE recommandée).", "Vercel (hébergement de l'application).", "Anthropic (uniquement si le coach IA est activé par l'opérateur ET si tu y consens).", "France Travail (API d'offres d'emploi, sans transmission de tes données personnelles)."]],
  ["Durées de conservation", ["Données du compte : jusqu'à la suppression du compte.", "Journal de sécurité : 12 mois recommandés (purge à configurer).", "Données de démonstration : stockées uniquement dans ton navigateur, régénérées chaque jour."]],
  ["Tes droits", ["Accès et portabilité : export JSON complet depuis les paramètres.", "Effacement : suppression définitive du compte depuis les paramètres.", "Rectification : modification directe dans l'application.", "Retrait du consentement : à tout moment dans les paramètres.", "Réclamation : auprès de la CNIL (cnil.fr)."]],
  ["Hors ligne", ["L'application installée (PWA) ne conserve aucune donnée financière hors ligne : seuls les fichiers statiques de l'interface sont mis en cache."]],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted">Version du 26 octobre 2026</p>
      {SECTIONS.map(([title, items]) => (
        <section key={title} className="mt-8">
          <h2 className="text-xl font-semibold">{title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
    </main>
  );
}
