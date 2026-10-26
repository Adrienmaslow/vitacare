/**
 * Couche d'abstraction pour une future synchronisation bancaire (agrégateur agréé DSP2).
 *
 * Aucune implémentation n'est active : BUDGETLY ne simule jamais une synchronisation et ne demande
 * jamais d'identifiants bancaires. Une intégration réelle passera par un prestataire agréé
 * (consentement géré chez le prestataire, redirection vers la banque) — voir docs/ROADMAP.md.
 */
import type { ISODate, Minor } from "@/types/db";

export interface BankConsent {
  id: string;
  institutionName: string;
  /** Date d'expiration du consentement (90/180 jours selon la réglementation applicable). */
  expiresAt: ISODate;
  status: "active" | "expired" | "revoked";
}

export interface BankAccountSnapshot {
  externalId: string;
  name: string;
  currency: string;
  balanceMinor: Minor;
  balanceDate: ISODate;
}

export interface BankTransactionSnapshot {
  externalId: string;
  accountExternalId: string;
  bookingDate: ISODate;
  valueDate: ISODate | null;
  amountMinor: Minor; // signé
  label: string;
  pending: boolean;
}

export interface BankingProvider {
  readonly id: string;
  isEnabled(): boolean;
  /** URL de redirection vers le parcours de consentement du prestataire. */
  startConsent(userId: string, redirectUrl: string): Promise<{ url: string }>;
  listAccounts(consentId: string): Promise<BankAccountSnapshot[]>;
  listTransactions(consentId: string, since: ISODate): Promise<BankTransactionSnapshot[]>;
  revokeConsent(consentId: string): Promise<void>;
}

/** Fournisseur par défaut : désactivé. Toute tentative d'utilisation échoue explicitement. */
export const noBankingProvider: BankingProvider = {
  id: "none",
  isEnabled: () => false,
  startConsent: async () => { throw new Error("Aucune connexion bancaire n'est configurée"); },
  listAccounts: async () => [],
  listTransactions: async () => [],
  revokeConsent: async () => undefined,
};

/**
 * Réconciliation prévue : une opération synchronisée sera rapprochée des opérations manuelles/CSV
 * via la même empreinte que l'import (src/features/imports/csv.ts → dedupHash) et la source "bank".
 */
