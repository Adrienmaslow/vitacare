/**
 * Échéancier : occurrences futures des revenus/dépenses récurrents et abonnements,
 * sans double comptage avec les transactions déjà enregistrées.
 */
import { addDays, diffDays, occurrencesBetween } from "@/lib/dates";
import type { ISODate, Minor, RecurringRow, SubscriptionRow, TransactionRow } from "@/types/db";

export interface ScheduledItem {
  date: ISODate;
  label: string;
  type: "income" | "expense";
  amount_minor: Minor;
  category_id: string | null;
  account_id: string | null;
  source: "recurring" | "subscription";
  sourceId: string;
}

/** Tolérance (jours) pour rapprocher une échéance d'une transaction réelle déjà saisie. */
export const MATCH_WINDOW_DAYS = 3;

function alreadyRecorded(txs: TransactionRow[], item: ScheduledItem): boolean {
  return txs.some((t) => {
    const linked = item.source === "recurring" ? t.recurring_id === item.sourceId : t.subscription_id === item.sourceId;
    return linked && Math.abs(diffDays(t.date, item.date)) <= MATCH_WINDOW_DAYS;
  });
}

/**
 * Échéances attendues entre from et to (inclus). Une échéance déjà matérialisée
 * en transaction (liée par recurring_id ou subscription_id à ±3 jours) est ignorée.
 * Un abonnement lié à une récurrence n'est pas compté deux fois : seuls les abonnements
 * actifs sont pris en compte et ils ne doivent pas dupliquer une récurrence (cf. ops).
 */
export function scheduledBetween(
  recurring: RecurringRow[],
  subscriptions: SubscriptionRow[],
  txs: TransactionRow[],
  from: ISODate,
  to: ISODate,
): ScheduledItem[] {
  const items: ScheduledItem[] = [];
  for (const r of recurring) {
    if (!r.is_active) continue;
    for (const d of occurrencesBetween(r.start_date, r.frequency, from, to, r.end_date)) {
      items.push({
        date: d, label: r.label, type: r.type, amount_minor: r.amount_minor, category_id: r.category_id,
        account_id: r.account_id, source: "recurring", sourceId: r.id,
      });
    }
  }
  for (const s of subscriptions) {
    if (s.status !== "active") continue;
    for (const d of occurrencesBetween(s.next_payment_date, s.frequency, from, to)) {
      items.push({
        date: d, label: s.service, type: "expense", amount_minor: s.amount_minor, category_id: s.category_id,
        account_id: s.account_id, source: "subscription", sourceId: s.id,
      });
    }
  }
  return items.filter((i) => !alreadyRecorded(txs, i)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Prochaines échéances (n jours) à partir de demain. */
export function upcoming(
  recurring: RecurringRow[], subscriptions: SubscriptionRow[], txs: TransactionRow[], today: ISODate, days: number,
): ScheduledItem[] {
  return scheduledBetween(recurring, subscriptions, txs, addDays(today, 1), addDays(today, days));
}

/**
 * Occurrences passées non encore matérialisées d'une récurrence (pour génération automatique).
 * Idempotent : se base sur les transactions existantes liées par recurring_id + date exacte.
 */
export function dueRecurringOccurrences(r: RecurringRow, txs: TransactionRow[], today: ISODate): ISODate[] {
  if (!r.is_active || !r.auto_post) return [];
  const existing = new Set(txs.filter((t) => t.recurring_id === r.id).map((t) => t.date));
  return occurrencesBetween(r.start_date, r.frequency, r.start_date, today, r.end_date).filter((d) => !existing.has(d));
}
