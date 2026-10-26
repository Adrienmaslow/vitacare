/**
 * Catalogue des aides — versionné dans Git pour que chaque modification soit relue.
 * Aucun montant n'est indiqué : les barèmes évoluent et doivent être consultés
 * sur le simulateur officiel. Les règles d'éligibilité sont volontairement
 * prudentes et ne produisent qu'une estimation (« potentiellement éligible »).
 */
import { toVerify, type SourceInfo } from "./sources";

export type AidCategory =
  | "logement" | "bourse" | "crous" | "alimentation" | "transport" | "mobilite_internationale"
  | "regionale" | "municipale" | "urgence" | "formation" | "equipement" | "permis" | "sante" | "emploi" | "simulateur";

export const AID_CATEGORY_LABELS: Record<AidCategory, string> = {
  logement: "Logement", bourse: "Bourses", crous: "CROUS", alimentation: "Alimentation", transport: "Transport",
  mobilite_internationale: "Mobilité internationale", regionale: "Aides régionales", municipale: "Aides municipales",
  urgence: "Aides d'urgence", formation: "Formation", equipement: "Équipement", permis: "Permis de conduire",
  sante: "Santé", emploi: "Insertion & emploi", simulateur: "Simulateurs officiels",
};

/** Critères connus du profil, utilisés par le moteur d'éligibilité. */
export interface EligibilityFacts {
  status?: "student" | "working_student" | "apprentice" | "young_worker" | "job_seeker" | "other" | null;
  ageRange?: "under_18" | "18_20" | "21_25" | "26_30" | "over_30" | null;
  housing?: "family" | "crous" | "private_rent" | "shared_rent" | "owner" | "other" | null;
  hasScholarship?: boolean | null;
  hasProfessionalIncome?: boolean | null;
  monthlyIncomeMinor?: number | null;
  receivesHousingAid?: boolean | null;
}

/**
 * Règle déclarative : chaque condition renvoie true (remplie), false (non remplie)
 * ou null (information manquante).
 */
export interface AidCondition {
  label: string;
  test: (f: EligibilityFacts) => boolean | null;
}

export interface Aid {
  slug: string;
  name: string;
  organization: string;
  category: AidCategory;
  summary: string;
  conditions: string[];
  amountLabel: string;
  documents: string[];
  howTo: string;
  /** Période de dépôt connue, sinon null. */
  periodLabel: string | null;
  rules: AidCondition[];
  /** Si true, l'aide est un outil d'orientation : toujours « à explorer ». */
  isTool?: boolean;
  source: SourceInfo;
  /** Effet possible des revenus d'activité sur l'aide (pédagogie). */
  incomeImpactNote?: string;
}

const isStudent = (f: EligibilityFacts) =>
  f.status == null ? null : ["student", "working_student", "apprentice"].includes(f.status);
const isRenter = (f: EligibilityFacts) =>
  f.housing == null ? null : ["private_rent", "shared_rent", "crous"].includes(f.housing);
const under30 = (f: EligibilityFacts) => (f.ageRange == null ? null : f.ageRange !== "over_30");
const under26 = (f: EligibilityFacts) => (f.ageRange == null ? null : ["under_18", "18_20", "21_25"].includes(f.ageRange));
const adult = (f: EligibilityFacts) => (f.ageRange == null ? null : f.ageRange !== "under_18");

export const AIDS: readonly Aid[] = [
  {
    slug: "apl",
    name: "Aide personnalisée au logement (APL / ALS)",
    organization: "CAF / MSA",
    category: "logement",
    summary: "Aide mensuelle versée pour réduire le loyer, y compris pour les étudiants en résidence CROUS, en location ou en colocation.",
    conditions: [
      "Être locataire, colocataire ou résident d'un logement qui est ta résidence principale.",
      "Le logement ne doit pas appartenir à un membre de ta famille.",
      "Le montant dépend des ressources, du loyer, de la zone et du type de logement.",
      "Des conditions spécifiques peuvent s'appliquer à certains étudiants étrangers : vérifie sur le site de la CAF.",
    ],
    amountLabel: "Variable — à estimer avec le simulateur officiel de la CAF.",
    documents: ["Bail ou contrat de résidence", "Attestation de loyer", "RIB", "Pièce d'identité / titre de séjour"],
    howTo: "Demande en ligne sur caf.fr, idéalement dès l'entrée dans le logement.",
    periodLabel: null,
    rules: [
      { label: "Locataire ou résident (CROUS, location, colocation)", test: isRenter },
      { label: "Ne perçoit pas déjà une aide au logement", test: (f) => (f.receivesHousingAid == null ? null : !f.receivesHousingAid) },
    ],
    source: toVerify("CAF", "https://www.caf.fr"),
    incomeImpactNote: "Les revenus d'activité sont pris en compte dans le calcul : un job étudiant peut faire évoluer le montant.",
  },
  {
    slug: "bourse-criteres-sociaux",
    name: "Bourse sur critères sociaux",
    organization: "CROUS (Dossier social étudiant)",
    category: "bourse",
    summary: "Bourse annuelle versée mensuellement aux étudiants de l'enseignement supérieur selon les ressources de la famille.",
    conditions: [
      "Être inscrit dans une formation habilitée de l'enseignement supérieur.",
      "Conditions d'âge lors de la première demande (sauf exceptions).",
      "Ressources familiales sous les plafonds du barème de l'année.",
    ],
    amountLabel: "Selon l'échelon attribué — barème annuel publié par le ministère.",
    documents: ["Avis fiscal des parents", "Pièce d'identité", "Certificat de scolarité ou vœux d'inscription"],
    howTo: "Constituer le Dossier social étudiant (DSE) sur messervices.etudiant.gouv.fr.",
    periodLabel: "Campagne annuelle, généralement au printemps pour l'année universitaire suivante — dates à vérifier.",
    rules: [
      { label: "Étudiant ou futur étudiant", test: isStudent },
      { label: "Moins de 30 ans (critère indicatif)", test: under30 },
      { label: "N'est pas déjà boursier", test: (f) => (f.hasScholarship == null ? null : !f.hasScholarship) },
    ],
    source: toVerify("Ministère de l'Enseignement supérieur — etudiant.gouv.fr", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "aide-urgence-crous",
    name: "Aides spécifiques ponctuelles du CROUS",
    organization: "CROUS — service social",
    category: "urgence",
    summary: "Aide financière d'urgence pour faire face à une difficulté passagère (perte de job, dépense imprévue…). Accessible aux boursiers comme aux non-boursiers.",
    conditions: ["Être étudiant.", "Rencontrer une difficulté financière ponctuelle, évaluée par un assistant social."],
    amountLabel: "Variable selon l'évaluation de la situation.",
    documents: ["Justificatifs de ressources et de charges", "Relevés de compte récents"],
    howTo: "Prendre rendez-vous avec le service social du CROUS de ton académie.",
    periodLabel: "Toute l'année.",
    rules: [{ label: "Étudiant", test: isStudent }],
    source: toVerify("CROUS — etudiant.gouv.fr", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "restauration-crous",
    name: "Repas à tarif social au restaurant universitaire",
    organization: "CROUS",
    category: "alimentation",
    summary: "Les restaurants universitaires proposent des repas complets à tarif social ; un tarif renforcé existe pour certains publics (boursiers, étudiants en difficulté).",
    conditions: ["Être étudiant.", "Tarif renforcé selon les conditions en vigueur — à vérifier auprès du CROUS."],
    amountLabel: "Tarif fixé nationalement — consulter le CROUS.",
    documents: ["Carte étudiante / compte Izly"],
    howTo: "Activer son compte Izly et se rendre dans un restaurant universitaire.",
    periodLabel: null,
    rules: [{ label: "Étudiant", test: isStudent }],
    source: toVerify("CROUS — etudiant.gouv.fr", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "visale",
    name: "Garantie Visale",
    organization: "Action Logement",
    category: "logement",
    summary: "Caution locative gratuite qui remplace un garant personnel pour louer un logement.",
    conditions: ["Jeunes jusqu'à 30 ans (et autres publics selon conditions).", "Le logement et le loyer doivent respecter les critères du dispositif."],
    amountLabel: "Service gratuit (garantie, pas un versement d'argent).",
    documents: ["Pièce d'identité", "Justificatif de situation (étudiant, alternant, salarié…)"],
    howTo: "Demande en ligne sur visale.fr avant la signature du bail.",
    periodLabel: null,
    rules: [{ label: "30 ans ou moins", test: under30 }],
    source: toVerify("Action Logement", "https://www.visale.fr"),
  },
  {
    slug: "avance-loca-pass",
    name: "Avance Loca-Pass",
    organization: "Action Logement",
    category: "logement",
    summary: "Avance sans intérêts pour financer le dépôt de garantie, remboursable progressivement.",
    conditions: ["Jeunes de moins de 30 ans selon situation (étudiant boursier, alternant, en emploi…)", "Demande dans les délais suivant l'entrée dans le logement."],
    amountLabel: "Dans la limite d'un plafond fixé par Action Logement — à vérifier.",
    documents: ["Bail", "Justificatif de situation"],
    howTo: "Demande en ligne sur actionlogement.fr.",
    periodLabel: null,
    incomeImpactNote: "C'est une avance remboursable : intègre les remboursements à ton budget.",
    rules: [
      { label: "Moins de 30 ans", test: under30 },
      { label: "Locataire", test: isRenter },
    ],
    source: toVerify("Action Logement", "https://www.actionlogement.fr"),
  },
  {
    slug: "mobili-jeune",
    name: "Aide Mobili-Jeune",
    organization: "Action Logement",
    category: "logement",
    summary: "Aide au paiement du loyer pour les jeunes en alternance (apprentissage ou professionnalisation).",
    conditions: ["Être en alternance dans une entreprise du secteur privé non agricole.", "Moins de 30 ans.", "Conditions de rémunération à vérifier."],
    amountLabel: "Forfait mensuel plafonné — à vérifier.",
    documents: ["Contrat d'alternance", "Bail ou quittance de loyer"],
    howTo: "Demande en ligne sur actionlogement.fr.",
    periodLabel: null,
    rules: [
      { label: "En alternance (apprenti)", test: (f) => (f.status == null ? null : f.status === "apprentice") },
      { label: "Moins de 30 ans", test: under30 },
      { label: "Locataire", test: isRenter },
    ],
    source: toVerify("Action Logement", "https://www.actionlogement.fr"),
  },
  {
    slug: "prime-activite",
    name: "Prime d'activité",
    organization: "CAF / MSA",
    category: "emploi",
    summary: "Complément de revenus pour les personnes qui travaillent avec des revenus modestes. Les étudiants et apprentis y ont droit sous condition de revenus d'activité minimum.",
    conditions: [
      "Avoir 18 ans ou plus et exercer une activité professionnelle.",
      "Étudiants et apprentis : percevoir des revenus d'activité au-dessus d'un seuil mensuel fixé par la réglementation.",
      "Ressources du foyer sous un plafond.",
    ],
    amountLabel: "Variable — à estimer avec le simulateur officiel de la CAF.",
    documents: ["Déclaration trimestrielle de ressources", "Bulletins de salaire"],
    howTo: "Simulation puis demande en ligne sur caf.fr.",
    periodLabel: "Déclaration trimestrielle.",
    incomeImpactNote: "Calculée sur les revenus des trois derniers mois : chaque changement de revenus doit être déclaré.",
    rules: [
      { label: "18 ans ou plus", test: adult },
      { label: "Exerce une activité rémunérée", test: (f) => (f.hasProfessionalIncome == null ? (f.status == null ? null : ["working_student", "apprentice", "young_worker"].includes(f.status)) : f.hasProfessionalIncome) },
    ],
    source: toVerify("CAF", "https://www.caf.fr"),
  },
  {
    slug: "complementaire-sante-solidaire",
    name: "Complémentaire santé solidaire (C2S)",
    organization: "Assurance Maladie",
    category: "sante",
    summary: "Complémentaire santé gratuite ou à faible coût selon les ressources, qui limite les restes à charge.",
    conditions: ["Résider en France de façon stable et régulière.", "Ressources sous un plafond (avec ou sans participation financière)."],
    amountLabel: "Gratuite ou participation mensuelle selon l'âge et les ressources — à vérifier.",
    documents: ["Justificatifs de ressources des 12 derniers mois"],
    howTo: "Demande en ligne sur ameli.fr ou auprès de ta caisse d'assurance maladie.",
    periodLabel: null,
    rules: [{ label: "Revenus mensuels modestes (indicateur : < 1 000 €)", test: (f) => (f.monthlyIncomeMinor == null ? null : f.monthlyIncomeMinor < 100000) }],
    source: toVerify("Assurance Maladie", "https://www.ameli.fr"),
  },
  {
    slug: "aide-mobilite-internationale",
    name: "Aide à la mobilité internationale",
    organization: "Établissement d'enseignement supérieur / CROUS",
    category: "mobilite_internationale",
    summary: "Aide destinée aux étudiants boursiers qui effectuent un séjour d'études ou un stage à l'étranger dans le cadre de leur formation.",
    conditions: ["Être boursier sur critères sociaux.", "Séjour à l'étranger intégré au cursus."],
    amountLabel: "Forfait mensuel pour une durée limitée — à vérifier auprès du service relations internationales.",
    documents: ["Attestation de bourse", "Convention de mobilité"],
    howTo: "Se renseigner auprès du service des relations internationales de ton établissement.",
    periodLabel: "Avant le départ en mobilité.",
    rules: [
      { label: "Étudiant", test: isStudent },
      { label: "Boursier", test: (f) => f.hasScholarship ?? null },
    ],
    source: toVerify("Ministère de l'Enseignement supérieur — etudiant.gouv.fr", "https://www.etudiant.gouv.fr"),
  },
  {
    slug: "aide-permis-apprentis",
    name: "Aide au permis de conduire pour les apprentis",
    organization: "État — Agence de services et de paiement",
    category: "permis",
    summary: "Aide forfaitaire de l'État pour financer le permis B des apprentis majeurs.",
    conditions: ["Être apprenti et avoir au moins 18 ans.", "Contrat d'apprentissage en cours.", "Être engagé dans la préparation du permis B."],
    amountLabel: "Forfait fixé par décret — montant à vérifier sur la page officielle.",
    documents: ["Devis ou facture de l'auto-école", "Pièce d'identité"],
    howTo: "Demande auprès de ton centre de formation d'apprentis (CFA).",
    periodLabel: null,
    rules: [
      { label: "Apprenti", test: (f) => (f.status == null ? null : f.status === "apprentice") },
      { label: "18 ans ou plus", test: adult },
    ],
    source: toVerify("Service-Public.fr", "https://www.service-public.fr"),
  },
  {
    slug: "contrat-engagement-jeune",
    name: "Contrat d'engagement jeune (CEJ)",
    organization: "France Travail / Mission locale",
    category: "emploi",
    summary: "Accompagnement intensif vers l'emploi avec une allocation mensuelle possible, pour les jeunes sans emploi ni formation.",
    conditions: ["Avoir entre 16 et 25 ans (29 ans en situation de handicap).", "Ne pas être étudiant ni en formation.", "Conditions de ressources pour l'allocation."],
    amountLabel: "Allocation selon l'âge et les ressources — à vérifier.",
    documents: ["Pièce d'identité", "Justificatif de domicile"],
    howTo: "Contacter la Mission locale ou France Travail ; informations sur 1jeune1solution.gouv.fr.",
    periodLabel: null,
    rules: [
      { label: "Moins de 26 ans", test: under26 },
      { label: "Ni en études ni en emploi", test: (f) => (f.status == null ? null : f.status === "job_seeker") },
    ],
    source: toVerify("1jeune1solution", "https://www.1jeune1solution.gouv.fr"),
  },
  {
    slug: "aides-regionales-transport",
    name: "Réductions et aides transport de ta région",
    organization: "Région / autorité organisatrice des transports",
    category: "transport",
    summary: "La plupart des régions et réseaux urbains proposent des abonnements réduits pour les jeunes et étudiants, parfois remboursés en partie.",
    conditions: ["Varient selon la région et le réseau.", "Souvent liées à l'âge (moins de 26 ans) ou au statut étudiant."],
    amountLabel: "Variable selon le réseau.",
    documents: ["Certificat de scolarité", "Pièce d'identité"],
    howTo: "Consulter le site de ton réseau de transport ou de ta région.",
    periodLabel: null,
    rules: [{ label: "Moins de 26 ans ou étudiant", test: (f) => { const a = under26(f); const s = isStudent(f); return a === true || s === true ? true : a === null || s === null ? null : false; } }],
    source: toVerify("1jeune1solution", "https://www.1jeune1solution.gouv.fr"),
  },
  {
    slug: "simulateur-1jeune1solution",
    name: "Simulateur d'aides 1jeune1solution",
    organization: "Gouvernement",
    category: "simulateur",
    summary: "Simulateur officiel qui recense en quelques minutes les aides nationales et locales auxquelles un jeune peut prétendre.",
    conditions: ["Ouvert à tous les jeunes."],
    amountLabel: "Outil d'orientation.",
    documents: [],
    howTo: "Répondre au questionnaire sur 1jeune1solution.gouv.fr.",
    periodLabel: null,
    rules: [],
    isTool: true,
    source: toVerify("1jeune1solution", "https://www.1jeune1solution.gouv.fr"),
  },
  {
    slug: "service-public-aides",
    name: "Fiches pratiques Service-Public.fr",
    organization: "Direction de l'information légale et administrative",
    category: "simulateur",
    summary: "Référence officielle pour vérifier les conditions et démarches de chaque aide.",
    conditions: ["Ouvert à tous."],
    amountLabel: "Outil d'information.",
    documents: [],
    howTo: "Rechercher le nom de l'aide sur service-public.fr.",
    periodLabel: null,
    rules: [],
    isTool: true,
    source: toVerify("Service-Public.fr", "https://www.service-public.fr"),
  },
];

export const AID_BY_SLUG = new Map(AIDS.map((a) => [a.slug, a]));
