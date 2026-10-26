/**
 * Instantané financier : toutes les données nécessaires aux calculs, chargées
 * en une fois puis passées aux services purs (aucun accès aux données dans les calculs).
 */
import type { DataStore } from "@/lib/data/store";
import type {
  AccountRow, AvailabilityRow, BudgetRow, CategoryRow, ISODate, ProfileRow, RecurringRow,
  SavingsAllocationRow, SavingsGoalRow, SubscriptionRow, TransactionRow, UserPreferencesRow,
} from "@/types/db";

export interface FinancialSnapshot {
  today: ISODate;
  profile: ProfileRow | null;
  preferences: UserPreferencesRow | null;
  availability: AvailabilityRow | null;
  accounts: AccountRow[];
  transactions: TransactionRow[];
  categories: CategoryRow[];
  budgets: BudgetRow[];
  recurring: RecurringRow[];
  subscriptions: SubscriptionRow[];
  goals: SavingsGoalRow[];
  allocations: SavingsAllocationRow[];
}

export async function loadSnapshot(store: DataStore, today: ISODate): Promise<FinancialSnapshot> {
  const [profiles, prefs, avail, accounts, transactions, categories, budgets, recurring, subscriptions, goals, allocations] =
    await Promise.all([
      store.list("profiles", { limit: 1 }),
      store.list("user_preferences", { limit: 1 }),
      store.list("availability_preferences", { limit: 1 }),
      store.list("financial_accounts", { order: { column: "created_at" } }),
      store.list("transactions", { order: { column: "date", ascending: true } }),
      store.list("transaction_categories", { order: { column: "name" } }),
      store.list("budgets"),
      store.list("recurring_transactions"),
      store.list("subscriptions"),
      store.list("savings_goals", { order: { column: "created_at" } }),
      store.list("savings_allocations"),
    ]);
  return {
    today,
    profile: profiles[0] ?? null,
    preferences: prefs[0] ?? null,
    availability: avail[0] ?? null,
    accounts,
    transactions,
    categories,
    budgets,
    recurring,
    subscriptions,
    goals,
    allocations,
  };
}

export function emptySnapshot(today: ISODate): FinancialSnapshot {
  return {
    today, profile: null, preferences: null, availability: null, accounts: [], transactions: [], categories: [],
    budgets: [], recurring: [], subscriptions: [], goals: [], allocations: [],
  };
}
