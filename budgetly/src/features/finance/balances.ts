/**
 * Soldes et agrégats. Définitions de référence : docs/FINANCIAL_CALCULATIONS.md.
 *
 * Règles clés :
 *  - un montant est toujours positif, le signe dépend du type ;
 *  - les transferts internes (transfer_in / transfer_out) modifient les soldes des comptes
 *    mais ne sont JAMAIS comptés comme revenus ou dépenses ;
 *  - les opérations « pending » sont exclues du solde comptable et présentées à part.
 */
import type { AccountRow, AccountType, ISODate, Minor, TransactionRow } from "@/types/db";

export const SAVINGS_ACCOUNT_TYPES: readonly AccountType[] = ["savings"];

export function signedAmount(t: Pick<TransactionRow, "type" | "amount_minor">): Minor {
  return t.type === "income" || t.type === "transfer_in" ? t.amount_minor : -t.amount_minor;
}

export function isTransfer(t: Pick<TransactionRow, "type">): boolean {
  return t.type === "transfer_in" || t.type === "transfer_out";
}

export interface AccountBalance {
  account: AccountRow;
  /** Solde comptable : opérations « booked » datées jusqu'à aujourd'hui inclus. */
  booked: Minor;
  /** Somme signée des opérations en attente. */
  pending: Minor;
  /** Solde disponible = comptable + en attente. */
  available: Minor;
  /** Opérations futures déjà saisies (date > aujourd'hui). */
  scheduled: Minor;
}

export function accountBalances(accounts: AccountRow[], txs: TransactionRow[], today: ISODate): AccountBalance[] {
  const map = new Map<string, AccountBalance>();
  for (const a of accounts) map.set(a.id, { account: a, booked: a.initial_balance_minor, pending: 0, available: 0, scheduled: 0 });
  for (const t of txs) {
    const b = map.get(t.account_id);
    if (!b) continue;
    const s = signedAmount(t);
    if (t.date > today) b.scheduled += s;
    else if (t.status === "pending") b.pending += s;
    else b.booked += s;
  }
  for (const b of map.values()) b.available = b.booked + b.pending;
  return [...map.values()];
}

export interface Totals {
  /** Tous comptes actifs, solde comptable. */
  total: Minor;
  /** Comptes hors épargne, solde comptable + opérations en attente. */
  available: Minor;
  /** Somme signée des opérations en attente (tous comptes). */
  pending: Minor;
  /** Solde des comptes d'épargne. */
  savings: Minor;
}

export function totals(balances: AccountBalance[]): Totals {
  let total = 0, available = 0, pending = 0, savings = 0;
  for (const b of balances) {
    if (b.account.is_archived) continue;
    total += b.booked;
    pending += b.pending;
    if (SAVINGS_ACCOUNT_TYPES.includes(b.account.type)) savings += b.booked + b.pending;
    else available += b.available;
  }
  return { total, available, pending, savings };
}

export interface PeriodFlows {
  income: Minor;
  expenses: Minor;
  net: Minor;
  /** Variation nette des comptes d'épargne sur la période (transferts compris). */
  savingsDelta: Minor;
}

/** Flux d'une période [from, to] — transferts exclus des revenus/dépenses. */
export function flows(txs: TransactionRow[], from: ISODate, to: ISODate, accounts: AccountRow[] = []): PeriodFlows {
  const savingsIds = new Set(accounts.filter((a) => SAVINGS_ACCOUNT_TYPES.includes(a.type)).map((a) => a.id));
  let income = 0, expenses = 0, savingsDelta = 0;
  for (const t of txs) {
    if (t.date < from || t.date > to || t.status !== "booked") continue;
    if (t.type === "income") income += t.amount_minor;
    else if (t.type === "expense") expenses += t.amount_minor;
    if (savingsIds.has(t.account_id)) savingsDelta += signedAmount(t);
  }
  return { income, expenses, net: income - expenses, savingsDelta };
}

/** Série quotidienne du solde total (comptes non archivés) sur [from, to]. */
export function balanceSeries(
  accounts: AccountRow[],
  txs: TransactionRow[],
  from: ISODate,
  to: ISODate,
  opts: { excludeSavings?: boolean } = {},
): { date: ISODate; balance: Minor }[] {
  const ids = new Set(
    accounts.filter((a) => !a.is_archived && !(opts.excludeSavings && SAVINGS_ACCOUNT_TYPES.includes(a.type))).map((a) => a.id),
  );
  let running = accounts.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.initial_balance_minor, 0);
  const deltas = new Map<ISODate, Minor>();
  for (const t of txs) {
    if (!ids.has(t.account_id) || t.status !== "booked") continue;
    if (t.date < from) running += signedAmount(t);
    else if (t.date <= to) deltas.set(t.date, (deltas.get(t.date) ?? 0) + signedAmount(t));
  }
  const out: { date: ISODate; balance: Minor }[] = [];
  for (let d = from; d <= to; ) {
    running += deltas.get(d) ?? 0;
    out.push({ date: d, balance: running });
    const nd = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1));
    d = nd.toISOString().slice(0, 10);
  }
  return out;
}
