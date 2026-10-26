/** Fabriques de lignes pour les tests des services purs. */
import { systemCategoryRows } from "@/lib/data/local-store";
import type { AccountRow, BudgetRow, RecurringRow, SubscriptionRow, TransactionRow } from "@/types/db";
import type { FinancialSnapshot } from "@/features/finance/snapshot";

let seq = 0;
const id = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;
const base = () => ({ id: id(), user_id: "u", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });

export const cats = systemCategoryRows();
export const catId = (slug: string) => cats.find((c) => c.slug === slug)!.id;

export function account(p: Partial<AccountRow> = {}): AccountRow {
  return { ...base(), name: "Courant", type: "checking", currency: "EUR", initial_balance_minor: 0, color: "#7357F6", icon: "wallet", is_archived: false, ...p };
}

export function tx(p: Partial<TransactionRow> & Pick<TransactionRow, "account_id" | "date" | "amount_minor">): TransactionRow {
  return {
    ...base(), booking_date: null, type: "expense", currency: "EUR", label: "Test", category_id: null, subcategory: null, description: null,
    status: "booked", source: "manual", recurring_id: null, subscription_id: null, import_id: null, transfer_group_id: null, dedup_hash: null, ...p,
  };
}

export function recurring(p: Partial<RecurringRow> & Pick<RecurringRow, "account_id" | "amount_minor" | "start_date">): RecurringRow {
  return { ...base(), label: "Récurrent", type: "expense", currency: "EUR", category_id: null, frequency: "monthly", end_date: null, next_date: p.start_date, is_active: true, auto_post: true, ...p };
}

export function subscription(p: Partial<SubscriptionRow> & Pick<SubscriptionRow, "amount_minor" | "next_payment_date">): SubscriptionRow {
  return { ...base(), service: "Service", currency: "EUR", frequency: "monthly", account_id: null, category_id: catId("abonnements"), kind: "other", status: "active", match_pattern: null, ...p };
}

export function budget(p: Partial<BudgetRow> & Pick<BudgetRow, "month" | "amount_minor">): BudgetRow {
  return { ...base(), category_id: null, alert_thresholds: [70, 85, 100], ...p };
}

export function snapshot(p: Partial<FinancialSnapshot> & { today: string }): FinancialSnapshot {
  return { profile: null, preferences: null, availability: null, accounts: [], transactions: [], categories: cats, budgets: [], recurring: [], subscriptions: [], goals: [], allocations: [], ...p };
}
