/**
 * Budgets mensuels : consommation, alertes de seuil, comparaison et répartition suggérée.
 * Seules les dépenses « booked » (hors transferts) du mois comptent.
 */
import { addMonths, endOfMonth, startOfMonth } from "@/lib/dates";
import { mulDiv, percent, roundTo } from "@/lib/money";
import type { BudgetRow, CategoryRow, ISODate, Minor, TransactionRow } from "@/types/db";

export interface BudgetStatus {
  budget: BudgetRow;
  category: CategoryRow | null;
  spent: Minor;
  remaining: Minor;
  percentUsed: number;
  previousSpent: Minor;
  /** Seuil le plus élevé franchi (70, 85, 100…) ou null. */
  thresholdReached: number | null;
  level: "ok" | "warning" | "danger" | "over";
  /** Rythme : dépense attendue à date si linéaire. */
  expectedToDate: Minor;
}

export function spentByCategory(txs: TransactionRow[], from: ISODate, to: ISODate): Map<string | null, Minor> {
  const m = new Map<string | null, Minor>();
  for (const t of txs) {
    if (t.type !== "expense" || t.status !== "booked" || t.date < from || t.date > to) continue;
    m.set(t.category_id, (m.get(t.category_id) ?? 0) + t.amount_minor);
  }
  return m;
}

export function totalExpenses(txs: TransactionRow[], from: ISODate, to: ISODate): Minor {
  let s = 0;
  for (const t of txs) if (t.type === "expense" && t.status === "booked" && t.date >= from && t.date <= to) s += t.amount_minor;
  return s;
}

export function levelFor(pct: number): BudgetStatus["level"] {
  if (pct > 100) return "over";
  if (pct >= 85) return "danger";
  if (pct >= 70) return "warning";
  return "ok";
}

export function budgetStatuses(
  budgets: BudgetRow[], categories: CategoryRow[], txs: TransactionRow[], month: ISODate, today: ISODate,
): BudgetStatus[] {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const prevFrom = addMonths(from, -1);
  const prevTo = endOfMonth(prevFrom);
  const spent = spentByCategory(txs, from, to);
  const prev = spentByCategory(txs, prevFrom, prevTo);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const daysTotal = Number(to.slice(8, 10));
  const elapsed = today < from ? 0 : today > to ? daysTotal : Number(today.slice(8, 10));

  return budgets
    .filter((b) => b.month === from)
    .map((b) => {
      const s = b.category_id ? spent.get(b.category_id) ?? 0 : totalExpenses(txs, from, to);
      const p = b.category_id ? prev.get(b.category_id) ?? 0 : totalExpenses(txs, prevFrom, prevTo);
      const pct = percent(s, b.amount_minor);
      const reached = [...b.alert_thresholds].sort((x, y) => y - x).find((th) => pct >= th) ?? null;
      return {
        budget: b,
        category: b.category_id ? catById.get(b.category_id) ?? null : null,
        spent: s,
        remaining: b.amount_minor - s,
        percentUsed: pct,
        previousSpent: p,
        thresholdReached: reached,
        level: levelFor(pct),
        expectedToDate: mulDiv(b.amount_minor, elapsed, daysTotal),
      };
    })
    .sort((a, b) => (a.category === null ? -1 : b.category === null ? 1 : b.percentUsed - a.percentUsed));
}

export interface SuggestedAllocation {
  categoryId: string;
  categoryName: string;
  averageMinor: Minor;
  suggestedMinor: Minor;
  essential: boolean;
}

/**
 * Répartition suggérée : moyenne des 3 derniers mois complets par catégorie,
 * arrondie à 5 €. Si le total dépasse le revenu disponible après épargne cible (10 %),
 * les catégories non essentielles sont réduites proportionnellement — jamais les essentielles.
 */
export function suggestAllocation(
  txs: TransactionRow[], categories: CategoryRow[], month: ISODate, monthlyIncome: Minor,
): { allocations: SuggestedAllocation[]; monthsObserved: number; explanation: string[] } {
  const start = startOfMonth(month);
  const months = [1, 2, 3].map((i) => addMonths(start, -i));
  const firstTx = txs.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null);
  const observed = months.filter((m) => firstTx !== null && endOfMonth(m) >= firstTx);
  const sums = new Map<string, Minor>();
  for (const m of observed) {
    for (const [cat, v] of spentByCategory(txs, m, endOfMonth(m))) if (cat) sums.set(cat, (sums.get(cat) ?? 0) + v);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  let allocations: SuggestedAllocation[] = [...sums.entries()]
    .map(([id, total]) => {
      const c = catById.get(id);
      const avg = observed.length ? mulDiv(total, 1, observed.length) : 0;
      return { categoryId: id, categoryName: c?.name ?? "Catégorie", averageMinor: avg, suggestedMinor: Math.max(500, roundTo(avg, 500)), essential: !!c?.is_essential };
    })
    .filter((a) => a.averageMinor > 0)
    .sort((a, b) => b.averageMinor - a.averageMinor);

  const explanation = [`Moyenne de tes dépenses sur ${observed.length} mois complet(s), arrondie à 5 €.`];
  const savingsTarget = mulDiv(monthlyIncome, 10, 100);
  const capacity = monthlyIncome - savingsTarget;
  const total = allocations.reduce((s, a) => s + a.suggestedMinor, 0);
  if (monthlyIncome > 0 && total > capacity) {
    const essentials = allocations.filter((a) => a.essential).reduce((s, a) => s + a.suggestedMinor, 0);
    const flexible = total - essentials;
    const room = Math.max(0, capacity - essentials);
    if (flexible > 0) {
      allocations = allocations.map((a) =>
        a.essential ? a : { ...a, suggestedMinor: Math.max(500, roundTo(mulDiv(a.suggestedMinor, room, flexible), 500)) },
      );
      explanation.push("Le total dépassait tes revenus moins 10 % d'épargne : seules les catégories non essentielles ont été réduites.");
    }
  }
  if (!observed.length) explanation.push("Pas encore de mois complet observé : ajoute des opérations pour obtenir une suggestion.");
  return { allocations, monthsObserved: observed.length, explanation };
}
