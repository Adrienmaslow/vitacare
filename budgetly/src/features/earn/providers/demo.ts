/**
 * Fournisseur de DÉMONSTRATION : exemples fictifs, explicitement étiquetés
 * (isExample = true, employeur « Exemple — … »). Utilisé uniquement en mode démo.
 */
import { addDays } from "@/lib/dates";
import type { Opportunity, OpportunityProvider, OpportunityQuery } from "../types";

function examples(today: string): Opportunity[] {
  const base = { provider: "demo", isExample: true, sourceName: "Exemple de démonstration BUDGETLY", fetchedAt: `${today}T08:00:00.000Z`, url: null } as const;
  return [
    { ...base, externalId: "ex-1", title: "Hôte·sse d'accueil pour un salon étudiant (exemple)", employer: "Exemple — Agence événementielle", location: "Lyon 7e", remote: false, category: "evenementiel", contractType: "CDD", postedAt: addDays(today, -2), startDate: addDays(today, 9), durationLabel: "Samedi, 8 h", durationHours: 8, payLabel: "≈ 12 €/h brut (exemple)", hourlyRateMinor: 1200, description: "Exemple fictif : accueil des visiteurs, orientation, distribution de documentation.", skills: ["accueil", "communication"], weekend: true },
    { ...base, externalId: "ex-2", title: "Cours particuliers de mathématiques niveau lycée (exemple)", employer: "Exemple — Particulier", location: "Lyon 3e", remote: false, category: "cours", contractType: "CESU", postedAt: addDays(today, -1), startDate: addDays(today, 3), durationLabel: "2 h / semaine", durationHours: 8, payLabel: "≈ 18 €/h (exemple)", hourlyRateMinor: 1800, description: "Exemple fictif : accompagnement d'un élève de première en mathématiques.", skills: ["mathématiques", "pédagogie"], weekend: false },
    { ...base, externalId: "ex-3", title: "Inventaire de nuit en magasin (exemple)", employer: "Exemple — Société d'inventaire", location: "Villeurbanne", remote: false, category: "inventaire", contractType: "Intérim", postedAt: addDays(today, -4), startDate: addDays(today, 6), durationLabel: "1 nuit, 6 h", durationHours: 6, payLabel: "≈ 12,50 €/h brut + majoration (exemple)", hourlyRateMinor: 1250, description: "Exemple fictif : comptage des stocks avec terminal portable.", skills: ["rigueur"], weekend: false },
    { ...base, externalId: "ex-4", title: "Babysitting sortie d'école (exemple)", employer: "Exemple — Famille", location: "Lyon 6e", remote: false, category: "babysitting", contractType: "CESU", postedAt: addDays(today, -3), startDate: addDays(today, 2), durationLabel: "3 soirs / semaine, 2 h", durationHours: 24, payLabel: "≈ 11 €/h (exemple)", hourlyRateMinor: 1100, description: "Exemple fictif : récupérer deux enfants à l'école et aider aux devoirs.", skills: ["babysitting", "patience"], weekend: false },
    { ...base, externalId: "ex-5", title: "Rédaction d'articles pour un blog (exemple)", employer: "Exemple — Start-up", location: null, remote: true, category: "contenu", contractType: "Freelance", postedAt: addDays(today, -6), startDate: null, durationLabel: "4 articles", durationHours: 10, payLabel: "≈ 40 € par article (exemple)", hourlyRateMinor: 1600, description: "Exemple fictif : 4 articles de 800 mots sur la vie étudiante.", skills: ["rédaction", "SEO"], weekend: null },
    { ...base, externalId: "ex-6", title: "Vendeur·se en renfort week-end (exemple)", employer: "Exemple — Enseigne de sport", location: "Lyon 2e", remote: false, category: "vente", contractType: "CDD", postedAt: addDays(today, -5), startDate: addDays(today, 12), durationLabel: "Week-ends, 14 h / semaine", durationHours: 56, payLabel: "≈ 12 €/h brut (exemple)", hourlyRateMinor: 1200, description: "Exemple fictif : conseil client et mise en rayon.", skills: ["vente", "sport"], weekend: true },
  ];
}

export class DemoOpportunityProvider implements OpportunityProvider {
  readonly id = "demo";
  readonly name = "Exemples de démonstration";
  constructor(private readonly today: string) {}
  isEnabled() {
    return true;
  }
  async search(q: OpportunityQuery) {
    const kw = q.keywords?.toLowerCase().trim();
    return examples(this.today).filter((o) =>
      (!kw || `${o.title} ${o.description} ${o.skills.join(" ")}`.toLowerCase().includes(kw)) &&
      (!q.category || o.category === q.category) &&
      (q.remote === undefined || !q.remote || o.remote) &&
      (!q.minHourlyMinor || (o.hourlyRateMinor ?? 0) >= q.minHourlyMinor),
    );
  }
}
