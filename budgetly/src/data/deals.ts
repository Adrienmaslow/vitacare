/**
 * Bons plans et réductions — uniquement des offres permanentes connues, renvoyant
 * vers la source officielle de l'enseigne. Aucun prix n'est affiché tant qu'il n'a pas
 * été vérifié : l'économie est calculée à partir des montants que l'utilisateur saisit
 * (voir src/features/deals/compare.ts).
 */
import { toVerify, type SourceInfo } from "./sources";

export type DealCategory =
  | "courses" | "restaurants" | "alimentation_etudiante" | "transport" | "telephonie" | "internet" | "streaming"
  | "logiciels" | "ordinateurs" | "equipement" | "sport" | "culture" | "cinema" | "voyages" | "assurances" | "logement";

export const DEAL_CATEGORY_LABELS: Record<DealCategory, string> = {
  courses: "Courses alimentaires", restaurants: "Restaurants", alimentation_etudiante: "Alimentation étudiante",
  transport: "Transport", telephonie: "Téléphonie", internet: "Internet", streaming: "Streaming",
  logiciels: "Logiciels étudiants", ordinateurs: "Ordinateurs", equipement: "Équipement scolaire", sport: "Sport",
  culture: "Culture", cinema: "Cinéma", voyages: "Voyages", assurances: "Assurances", logement: "Logement",
};

export interface Deal {
  slug: string;
  title: string;
  brand: string;
  category: DealCategory;
  description: string;
  conditions: string[];
  /** Prix normal et réduit en centimes : null tant que non vérifiés sur la source. */
  normalPriceMinor: number | null;
  reducedPriceMinor: number | null;
  benefitLabel: string;
  /** Catégories de dépenses BUDGETLY qui rendent ce bon plan pertinent. */
  matchesSpending: string[];
  /** Type d'abonnement concerné (pour la personnalisation). */
  matchesSubscriptionKinds?: string[];
  free?: boolean;
  source: SourceInfo;
}

export const DEALS: readonly Deal[] = [
  {
    slug: "restaurant-universitaire",
    title: "Repas complet au restaurant universitaire",
    brand: "CROUS", category: "alimentation_etudiante",
    description: "Entrée, plat et dessert à tarif social dans les restaurants et cafétérias CROUS.",
    conditions: ["Être étudiant", "Paiement via Izly"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Tarif social fixé nationalement",
    matchesSpending: ["restaurants", "alimentation"],
    source: toVerify("CROUS — etudiant.gouv.fr", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "too-good-to-go",
    title: "Paniers anti-gaspillage",
    brand: "Too Good To Go", category: "courses",
    description: "Invendus de boulangeries, supermarchés et restaurants proposés à prix réduit en fin de journée.",
    conditions: ["Disponibilité variable selon les commerces proches", "Contenu du panier non choisi"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Généralement une fraction de la valeur des produits",
    matchesSpending: ["alimentation", "restaurants"],
    source: toVerify("Too Good To Go", "https://www.toogoodtogo.com/fr"),
  },
  {
    slug: "carte-avantage-jeune",
    title: "Carte Avantage Jeune",
    brand: "SNCF Voyageurs", category: "transport",
    description: "Carte annuelle donnant droit à des réductions sur les trains en France pour les 12-27 ans.",
    conditions: ["Avoir entre 12 et 27 ans", "Carte payante, rentable à partir de quelques trajets par an"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Réduction sur les billets — conditions sur SNCF Connect",
    matchesSpending: ["transport", "voyage"],
    source: toVerify("SNCF Connect", "https://www.sncf-connect.com"),
  },
  {
    slug: "spotify-etudiants",
    title: "Spotify Premium Étudiants",
    brand: "Spotify", category: "streaming",
    description: "Abonnement Premium à tarif réduit pour les étudiants inscrits dans un établissement d'enseignement supérieur reconnu.",
    conditions: ["Vérification du statut étudiant", "Durée limitée, renouvelable selon les conditions"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Tarif étudiant réduit par rapport à l'offre individuelle",
    matchesSpending: ["abonnements"], matchesSubscriptionKinds: ["streaming_music"],
    source: toVerify("Spotify", "https://www.spotify.com/fr/student/"),
  },
  {
    slug: "github-student-pack",
    title: "GitHub Student Developer Pack",
    brand: "GitHub", category: "logiciels",
    description: "Ensemble d'outils de développement offerts aux étudiants (hébergement, IDE, services cloud…).",
    conditions: ["Statut étudiant vérifié", "Offres partenaires soumises à leurs propres conditions"],
    normalPriceMinor: null, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit pour les étudiants",
    matchesSpending: ["abonnements", "etudes"], matchesSubscriptionKinds: ["software", "cloud"],
    source: toVerify("GitHub Education", "https://education.github.com/pack"),
  },
  {
    slug: "jetbrains-education",
    title: "Licences éducatives JetBrains",
    brand: "JetBrains", category: "logiciels",
    description: "Accès gratuit aux IDE professionnels pour les étudiants et enseignants.",
    conditions: ["Adresse e-mail académique ou carte étudiante", "Usage non commercial"],
    normalPriceMinor: null, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit pour les étudiants",
    matchesSpending: ["abonnements", "etudes"], matchesSubscriptionKinds: ["software"],
    source: toVerify("JetBrains", "https://www.jetbrains.com/community/education/"),
  },
  {
    slug: "microsoft-365-education",
    title: "Microsoft 365 Éducation",
    brand: "Microsoft", category: "logiciels",
    description: "Word, Excel, PowerPoint et OneDrive souvent fournis gratuitement par ton établissement.",
    conditions: ["Établissement partenaire", "Compte académique"],
    normalPriceMinor: null, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit via de nombreux établissements",
    matchesSpending: ["abonnements", "etudes"], matchesSubscriptionKinds: ["software", "cloud"],
    source: toVerify("Microsoft Éducation", "https://www.microsoft.com/fr-fr/education"),
  },
  {
    slug: "libreoffice",
    title: "Suite bureautique libre LibreOffice",
    brand: "The Document Foundation", category: "logiciels",
    description: "Alternative gratuite et open source pour les documents, tableurs et présentations.",
    conditions: ["Aucune"],
    normalPriceMinor: 0, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit",
    matchesSpending: ["abonnements", "etudes"], matchesSubscriptionKinds: ["software"],
    source: toVerify("LibreOffice", "https://www.libreoffice.org"),
  },
  {
    slug: "figma-education",
    title: "Figma pour l'éducation",
    brand: "Figma", category: "logiciels",
    description: "Plan éducation gratuit pour les étudiants et enseignants vérifiés.",
    conditions: ["Statut étudiant vérifié"],
    normalPriceMinor: null, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit pour les étudiants",
    matchesSpending: ["abonnements", "etudes"], matchesSubscriptionKinds: ["software"],
    source: toVerify("Figma", "https://www.figma.com/education/"),
  },
  {
    slug: "musees-nationaux-18-25",
    title: "Gratuité des musées et monuments nationaux pour les 18-25 ans",
    brand: "Ministère de la Culture", category: "culture",
    description: "Accès gratuit aux collections permanentes de nombreux musées et monuments nationaux pour les jeunes de 18 à 25 ans résidant dans l'Union européenne.",
    conditions: ["18 à 25 ans", "Résidence dans l'UE", "Collections permanentes, selon établissement"],
    normalPriceMinor: null, reducedPriceMinor: 0, free: true,
    benefitLabel: "Gratuit",
    matchesSpending: ["loisirs"],
    source: toVerify("Ministère de la Culture", "https://www.culture.gouv.fr"),
  },
  {
    slug: "isic",
    title: "Carte étudiante internationale ISIC",
    brand: "ISIC", category: "voyages",
    description: "Carte payante donnant accès à des réductions étudiantes en France et à l'étranger.",
    conditions: ["Statut étudiant", "Carte payante : rentable seulement si tu utilises les réductions"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Réductions partenaires",
    matchesSpending: ["voyage", "loisirs"],
    source: toVerify("ISIC France", "https://www.isic.fr"),
  },
  {
    slug: "unidays",
    title: "Plateforme de réductions étudiantes UNiDAYS",
    brand: "UNiDAYS", category: "equipement",
    description: "Plateforme gratuite qui centralise des codes de réduction étudiants (mode, tech, logiciels).",
    conditions: ["Inscription gratuite avec vérification du statut", "Offres variables selon les marques"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Codes promo étudiants",
    matchesSpending: ["shopping"],
    source: toVerify("UNiDAYS", "https://www.myunidays.com/FR/fr-FR"),
  },
  {
    slug: "sport-universitaire",
    title: "Sport universitaire (SUAPS)",
    brand: "Ton université", category: "sport",
    description: "Le service des sports de l'université propose de nombreuses activités gratuites ou à faible coût.",
    conditions: ["Être inscrit dans l'établissement", "Offre variable selon les universités"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Souvent inclus dans les frais d'inscription",
    matchesSpending: ["loisirs"], matchesSubscriptionKinds: ["sport"],
    source: toVerify("Service des sports de ton établissement", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "forfait-mobile-sans-engagement",
    title: "Forfaits mobiles sans engagement",
    brand: "Opérateurs mobiles", category: "telephonie",
    description: "Les forfaits sans engagement des marques « low cost » des opérateurs permettent souvent de payer moins cher pour un usage équivalent.",
    conditions: ["Comparer l'enveloppe de données réellement utilisée", "Vérifier les frais de changement (carte SIM)"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Compare avec ton forfait actuel dans l'outil ci-dessous",
    matchesSpending: ["telephonie"], matchesSubscriptionKinds: ["phone"],
    source: toVerify("Comparaison réalisée par l'utilisateur", "https://www.arcep.fr"),
  },
  {
    slug: "assurance-habitation-etudiante",
    title: "Comparer son assurance habitation étudiante",
    brand: "Assureurs", category: "assurances",
    description: "Pour un studio ou une colocation, les garanties nécessaires sont souvent limitées : comparer plusieurs devis peut réduire la prime.",
    conditions: ["Vérifier les garanties exigées par le bail", "Attention aux franchises"],
    normalPriceMinor: null, reducedPriceMinor: null,
    benefitLabel: "Économie variable — compare tes devis ci-dessous",
    matchesSpending: ["assurance"], matchesSubscriptionKinds: ["insurance"],
    source: toVerify("Institut national de la consommation", "https://www.inc-conso.fr"),
  },
];

export const DEAL_BY_SLUG = new Map(DEALS.map((d) => [d.slug, d]));
