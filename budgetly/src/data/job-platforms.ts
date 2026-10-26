/**
 * Plateformes de recherche de missions affichées quand aucun fournisseur d'offres
 * n'est connecté. Ce sont des liens d'orientation, pas des offres.
 */
import { toVerify, type SourceInfo } from "./sources";

export interface JobPlatform {
  slug: string;
  name: string;
  description: string;
  categories: string[];
  official: boolean;
  source: SourceInfo;
}

export const JOB_PLATFORMS: readonly JobPlatform[] = [
  { slug: "france-travail", name: "France Travail", description: "Offres d'emploi publiques, dont jobs étudiants, intérim et contrats courts.", categories: ["job_etudiant", "interim", "saisonnier", "vente"], official: true, source: toVerify("France Travail", "https://www.francetravail.fr") },
  { slug: "1jeune1solution", name: "1jeune1solution", description: "Plateforme publique : jobs étudiants, alternance, stages et aides pour les jeunes.", categories: ["job_etudiant", "saisonnier"], official: true, source: toVerify("Gouvernement", "https://www.1jeune1solution.gouv.fr") },
  { slug: "jobaviz", name: "Jobaviz", description: "Plateforme des CROUS dédiée aux jobs étudiants.", categories: ["job_etudiant"], official: true, source: toVerify("CROUS", "https://www.jobaviz.fr") },
  { slug: "studentjob", name: "StudentJob", description: "Jobs étudiants, temps partiels et missions ponctuelles.", categories: ["job_etudiant", "evenementiel", "vente"], official: false, source: toVerify("StudentJob", "https://www.studentjob.fr") },
  { slug: "yoopies", name: "Yoopies", description: "Babysitting, soutien scolaire et pet sitting entre particuliers.", categories: ["babysitting", "pet_sitting", "cours"], official: false, source: toVerify("Yoopies", "https://yoopies.fr") },
  { slug: "superprof", name: "Superprof", description: "Cours particuliers dans de nombreuses matières.", categories: ["cours"], official: false, source: toVerify("Superprof", "https://www.superprof.fr") },
  { slug: "staffme", name: "StaffMe", description: "Missions ponctuelles pour étudiants en statut indépendant.", categories: ["evenementiel", "administratif", "livraison"], official: false, source: toVerify("StaffMe", "https://staffme.fr") },
  { slug: "studentpop", name: "StudentPop", description: "Missions courtes salariées pour étudiants (événementiel, vente, inventaires).", categories: ["evenementiel", "vente", "inventaire"], official: false, source: toVerify("StudentPop", "https://www.studentpop.fr") },
  { slug: "malt", name: "Malt", description: "Missions freelance (développement, design, rédaction…) pour indépendants.", categories: ["freelance", "contenu", "distance"], official: false, source: toVerify("Malt", "https://www.malt.fr") },
];

export const OPPORTUNITY_CATEGORIES: Record<string, string> = {
  job_etudiant: "Job étudiant", evenementiel: "Événementiel", vente: "Vente & commerce", interim: "Intérim",
  inventaire: "Inventaires", babysitting: "Babysitting", pet_sitting: "Pet sitting", cours: "Cours particuliers",
  soutien_scolaire: "Soutien scolaire", administratif: "Travail administratif", livraison: "Livraison",
  saisonnier: "Saisonnier", distance: "À distance", freelance: "Freelance", contenu: "Création de contenu",
  services: "Prestations de services",
};

export const INCOME_DECLARATION_GUIDE = [
  { title: "Salaire étudiant", body: "Un job salarié donne lieu à un bulletin de paie : les cotisations sont prélevées par l'employeur. Les salaires des étudiants peuvent bénéficier d'une exonération d'impôt sur le revenu dans une certaine limite et sous condition d'âge — vérifie le plafond de l'année sur impots.gouv.fr." },
  { title: "Contrats courts et intérim", body: "CDD, intérim et extras sont des contrats salariés : tu reçois un bulletin de paie et, selon le cas, une indemnité de fin de mission ou de congés payés." },
  { title: "Freelance et micro-entreprise", body: "En micro-entreprise, tu déclares ton chiffre d'affaires à l'URSSAF (mensuellement ou trimestriellement) et paies des cotisations proportionnelles. Le taux dépend de l'activité : consulte urssaf.fr avant de calculer ton revenu net." },
  { title: "Déclaration d'impôts", body: "Si tu es rattaché au foyer fiscal de tes parents, tes revenus sont déclarés avec les leurs. Sinon, tu fais ta propre déclaration. Les règles sont détaillées sur impots.gouv.fr." },
  { title: "Effet sur les aides", body: "Les revenus d'activité peuvent modifier le montant de certaines aides (aide au logement, prime d'activité…) ou en ouvrir de nouvelles. Déclare tout changement à l'organisme concerné." },
];
