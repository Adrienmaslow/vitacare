/**
 * Analyses : séries mensuelles, ratios et comparaisons.
 * Lorsque les données sont insuffisantes, les indicateurs valent null et un
 * avertissement est renvoyé au lieu d'une analyse trompeuse.
 */
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from "@/lib/dates";
import { mulDiv, percent } from "@/lib/money";
import type { ISODate, Minor, TransactionRow } from "@/types/db";
import { flows } from "../finance/balances";
import type { FinancialSnapshot } from "../finance/snapshot";

export interface MonthPoint {
  month: ISODate;
  income: Minor;
  expenses: Minor;
  net: Minor;
  fixed: Minor;
  variable: Minor;
  savingsDelta: Minor;
}

/** Charge fixe : liée à une échéance/un abonnement, ou catégorie structurellement fixe. */
export function isFixedExpense(t: TransactionRow, fixedCategoryIds: Set<string>): boolean {
  return !!t.recurring_id || !!t.subscription_id || (t.category_id !== null && fixedCategoryIds.has(t.category_id));
}

export const FIXED_CATEGORY_SLUGS = ["logement", "assurance", "telephonie", "abonnements"];

export function monthlySeries(s: FinancialSnapshot, months: number): MonthPoint[] {
  const fixedCats = new Set(s.categories.filter((c) => FIXED_CATEGORY_SLUGS.includes(c.slug)).map((c) => c.id));
  const first = startOfMonth(addMonths(s.today, -(months - 1)));
  const out: MonthPoint[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(first, i);
    const end = endOfMonth(m);
    const f = flows(s.transactions, m, end, s.accounts);
    let fixed = 0;
    for (const t of s.transactions) {
      if (t.type === "expense" && t.status === "booked" && t.date >= m && t.date <= end && isFixedExpense(t, fixedCats)) fixed += t.amount_minor;
    }
    out.push({ month: m, income: f.income, expenses: f.expenses, net: f.net, fixed, variable: f.expenses - fixed, savingsDelta: f.savingsDelta });
  }
  return out;
}

export function weeklyExpenses(s: FinancialSnapshot, weeks: number): { week: ISODate; expenses: Minor }[] {
  const start = startOfWeek(addDays(s.today, -7 * (weeks - 1)));
  const out: { week: ISODate; expenses: Minor }[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addDays(start, 7 * i);
    const we = addDays(w, 6);
    let e = 0;
    for (const t of s.transactions) if (t.type === "expense" && t.status === "booked" && t.date >= w && t.date <= we) e += t.amount_minor;
    out.push({ week: w, expenses: e });
  }
  return out;
}

export interface Kpis {
  savingsRate: number | null;
  fixedShareOfIncome: number | null;
  averageDailySpend: Minor | null;
  savingCapacity: Minor | null;
  safetyMarginDays: number | null;
  monthOverMonth: number | null;
  vsThreeMonthAvg: number | null;
  vsSixMonthAvg: number | null;
  vsLastYear: number | null;
  warnings: string[];
}

/** Calcule les indicateurs sur les mois complets précédents (le mois en cours est partiel). */
export function kpis(s: FinancialSnapshot, availableBalance: Minor): Kpis {
  const series = monthlySeries(s, 13);
  const current = series[series.length - 1]!;
  const complete = series.slice(0, -1).filter((p) => p.income > 0 || p.expenses > 0);
  const last3 = complete.slice(-3);
  const last6 = complete.slice(-6);
  const warnings: string[] = [];
  if (complete.length < 1) warnings.push("Aucun mois complet enregistré : les ratios seront disponibles après ton premier mois d'utilisation.");
  else if (complete.length < 3) warnings.push(`Seulement ${complete.length} mois complet(s) : les moyennes sont indicatives.`);

  const avg = (xs: MonthPoint[], k: keyof MonthPoint) => (xs.length ? mulDiv(xs.reduce((a, p) => a + (p[k] as number), 0), 1, xs.length) : null);
  const avgIncome = avg(last3, "income");
  const avgExpenses = avg(last3, "expenses");
  const avgFixed = avg(last3, "fixed");
  const savingCapacity = avgIncome !== null && avgExpenses !== null ? avgIncome - avgExpenses : null;
  const savingsRate = avgIncome && savingCapacity !== null ? percent(savingCapacity, avgIncome) : null;
  const fixedShare = avgIncome && avgFixed !== null ? percent(avgFixed, avgIncome) : null;
  const averageDailySpend = avgExpenses !== null ? mulDiv(avgExpenses * 12, 1, 365) : null;
  const safetyMarginDays = averageDailySpend && averageDailySpend > 0 ? Math.floor(availableBalance / averageDailySpend) : null;

  const prev = complete[complete.length - 1];
  const prevPrev = complete[complete.length - 2];
  const change = (a: Minor | null | undefined, b: Minor | null | undefined) => (a !== null && a !== undefined && b ? percent(a - b, b) : null);
  const lastYear = series[0];
  return {
    savingsRate,
    fixedShareOfIncome: fixedShare,
    averageDailySpend,
    savingCapacity,
    safetyMarginDays,
    monthOverMonth: change(prev?.expenses, prevPrev?.expenses),
    vsThreeMonthAvg: change(prev?.expenses, avg(complete.slice(-4, -1), "expenses")),
    vsSixMonthAvg: change(prev?.expenses, avg(complete.slice(-7, -1), "expenses")),
    vsLastYear: lastYear && lastYear.expenses > 0 && complete.length >= 12 ? change(current.expenses, lastYear.expenses) : null,
    warnings,
  };
}

export function categoryBreakdown(s: FinancialSnapshot, from: ISODate, to: ISODate) {
  const byCat = new Map<string, Minor>();
  let total = 0;
  for (const t of s.transactions) {
    if (t.type !== "expense" || t.status !== "booked" || t.date < from || t.date > to) continue;
    const k = t.category_id ?? "none";
    byCat.set(k, (byCat.get(k) ?? 0) + t.amount_minor);
    total += t.amount_minor;
  }
  const cats = new Map(s.categories.map((c) => [c.id, c]));
  return {
    total,
    items: [...byCat.entries()]
      .map(([id, amount]) => {
        const c = cats.get(id);
        return { categoryId: id === "none" ? null : id, name: c?.name ?? "Non catégorisé", color: c?.color ?? "#CBD5E1", amount, percent: percent(amount, total) };
      })
      .sort((a, b) => b.amount - a.amount),
  };
}
