/**
 * Vue « tableau de bord » : indicateurs définis rigoureusement (docs/FINANCIAL_CALCULATIONS.md).
 */
import { addDays, endOfMonth, startOfMonth } from "@/lib/dates";
import type { ISODate, Minor } from "@/types/db";
import { categoryBreakdown } from "../analytics/service";
import { budgetStatuses } from "../budgets/service";
import { forecast } from "../forecasts/engine";
import { goalProgress } from "../goals/service";
import { accountBalances, balanceSeries, flows, totals } from "./balances";
import { scheduledBetween, upcoming } from "./schedule";
import type { FinancialSnapshot } from "./snapshot";

export interface DashboardCards {
  totalBalance: Minor;
  availableBalance: Minor;
  monthIncome: Minor;
  monthExpenses: Minor;
  /** Reste à vivre jusqu'à la fin du mois = disponible + revenus récurrents attendus − charges fixes restantes. */
  leftToLive: Minor;
  fixedChargesRemaining: Minor;
  expectedIncomeRemaining: Minor;
  pending: Minor;
  savingsAvailable: Minor;
  savedThisMonth: Minor;
  /** Solde prévisionnel de fin de mois (scénario réaliste). */
  forecastEndOfMonth: Minor;
  forecastReliability: "low" | "medium" | "high";
}

export function dashboardCards(s: FinancialSnapshot): DashboardCards {
  const t = totals(accountBalances(s.accounts, s.transactions, s.today));
  const from = startOfMonth(s.today);
  const eom = endOfMonth(s.today);
  const fl = flows(s.transactions, from, s.today, s.accounts);
  const remaining = scheduledBetween(s.recurring, s.subscriptions, s.transactions, addDays(s.today, 1), eom);
  const savingsIds = new Set(s.accounts.filter((a) => a.type === "savings").map((a) => a.id));
  const relevant = remaining.filter((i) => !i.account_id || !savingsIds.has(i.account_id));
  const fixed = relevant.filter((i) => i.type === "expense").reduce((a, i) => a + i.amount_minor, 0);
  const income = relevant.filter((i) => i.type === "income").reduce((a, i) => a + i.amount_minor, 0);
  const f = forecast(s, Math.max(1, Number(eom.slice(8, 10)) - Number(s.today.slice(8, 10))));
  return {
    totalBalance: t.total,
    availableBalance: t.available,
    monthIncome: fl.income,
    monthExpenses: fl.expenses,
    leftToLive: t.available + income - fixed,
    fixedChargesRemaining: fixed,
    expectedIncomeRemaining: income,
    pending: t.pending,
    savingsAvailable: t.savings,
    savedThisMonth: fl.savingsDelta,
    forecastEndOfMonth: f.endBalance.realistic,
    forecastReliability: f.reliability.level,
  };
}

export type SeriesPeriod = "7d" | "30d" | "3m" | "6m" | "12m";
export const PERIOD_DAYS: Record<SeriesPeriod, number> = { "7d": 7, "30d": 30, "3m": 91, "6m": 182, "12m": 365 };

export function dashboardView(s: FinancialSnapshot, period: SeriesPeriod | { from: ISODate; to: ISODate } = "30d") {
  const range = typeof period === "string" ? { from: addDays(s.today, -PERIOD_DAYS[period] + 1), to: s.today } : period;
  const from = startOfMonth(s.today);
  const cats = new Map(s.categories.map((c) => [c.id, c]));
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  return {
    today: s.today,
    hasData: s.accounts.length > 0,
    cards: dashboardCards(s),
    series: balanceSeries(s.accounts, s.transactions, range.from, range.to),
    breakdown: categoryBreakdown(s, from, s.today),
    recent: [...s.transactions]
      .filter((t) => t.date <= s.today)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.created_at.localeCompare(a.created_at)))
      .slice(0, 8)
      .map((t) => ({ ...t, categoryName: t.category_id ? cats.get(t.category_id)?.name ?? null : null, categoryColor: t.category_id ? cats.get(t.category_id)?.color ?? null : null, accountName: accounts.get(t.account_id)?.name ?? "" })),
    upcoming: upcoming(s.recurring, s.subscriptions, s.transactions, s.today, 14).slice(0, 6),
    budgets: budgetStatuses(s.budgets, s.categories, s.transactions, from, s.today).slice(0, 5),
    goals: s.goals.filter((g) => g.status === "active").map((g) => goalProgress(g, s.allocations, s.today)).slice(0, 3),
  };
}
