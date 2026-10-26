/**
 * Métadonnées de provenance communes à toutes les données externes (aides, bons plans, plateformes).
 *
 * IMPORTANT — état de vérification au 26/10/2026 :
 * les liens et conditions ci-dessous ont été rédigés à partir de connaissances générales sur
 * des dispositifs publics et services connus. L'environnement de développement n'avait pas
 * accès à Internet : AUCUN lien n'a pu être vérifié en ligne. Chaque entrée porte donc
 * verification.status = "to_verify" et l'interface l'affiche clairement.
 * Procédure de vérification : docs/EXTERNAL_PROVIDERS.md § « Revue des catalogues ».
 */
export type VerificationStatus = "verified" | "to_verify" | "expired";

export interface SourceInfo {
  provider: string;
  url: string;
  /** Date de rédaction de la fiche dans le dépôt. */
  addedAt: string;
  /** Date de la dernière vérification humaine sur la source officielle (null = jamais). */
  verifiedAt: string | null;
  status: VerificationStatus;
  /** Date d'expiration connue (offre limitée, campagne annuelle…). */
  expiresAt?: string | null;
}

export const CATALOG_ADDED_AT = "2026-10-26";

export function toVerify(provider: string, url: string, expiresAt: string | null = null): SourceInfo {
  return { provider, url, addedAt: CATALOG_ADDED_AT, verifiedAt: null, status: "to_verify", expiresAt };
}

/** Statut effectif à une date donnée : une offre dont la date d'expiration est passée est « expirée ». */
export function effectiveStatus(s: SourceInfo, today: string): VerificationStatus {
  if (s.expiresAt && s.expiresAt < today) return "expired";
  return s.status;
}
