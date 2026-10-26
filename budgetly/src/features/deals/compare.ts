/**
 * Comparaison de coûts : à partir de montants SAISIS par l'utilisateur (coût actuel,
 * coût alternatif, frais de changement). Aucun prix n'est inventé.
 */
import { OCCURRENCES_PER_YEAR } from "@/lib/dates";
import { mulDiv } from "@/lib/money";
import type { Frequency, Minor, SubscriptionRow, TransactionRow, CategoryRow } from "@/types/db";
import { DEALS, type Deal } from "@/data/deals";

export interface ComparisonInput {
  currentMinor: Minor;
  currentFrequency: Frequency;
  alternativeMinor: Minor;
  alternativeFrequency: Frequency;
  switchingCostMinor: Minor;
}

export interface ComparisonResult {
  currentMonthly: Minor;
  alternativeMonthly: Minor;
  monthlySaving: Minor;
  annualSaving: Minor;
  /** Économie de la première année, frais de changement déduits. */
  firstYearNet: Minor;
  /** Nombre de mois avant que les frais de changement soient amortis (null si jamais). */
  breakEvenMonths: number | null;
  worthIt: boolean;
}

const toMonthly = (amount: Minor, f: Frequency) => mulDiv(amount * OCCURRENCES_PER_YEAR[f], 1, 12);

export function compareCosts(i: ComparisonInput): ComparisonResult {
  const currentMonthly = toMonthly(i.currentMinor, i.currentFrequency);
  const alternativeMonthly = toMonthly(i.alternativeMinor, i.alternativeFrequency);
  const annualSaving = i.currentMinor * OCCURRENCES_PER_YEAR[i.currentFrequency] - i.alternativeMinor * OCCURRENCES_PER_YEAR[i.alternativeFrequency];
  const monthlySaving = currentMonthly - alternativeMonthly;
  const firstYearNet = annualSaving - i.switchingCostMinor;
  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(i.switchingCostMinor / monthlySaving) : null;
  return { currentMonthly, alternativeMonthly, monthlySaving, annualSaving, firstYearNet, breakEvenMonths, worthIt: firstYearNet > 0 };
}

export interface DealSuggestion {
  deal: Deal;
  reason: string;
  /** Dépense mensuelle moyenne observée dans les catégories concernées. */
  observedMonthlyMinor: Minor;
}

/**
 * Personnalisation : propose les bons plans liés aux catégories où l'utilisateur dépense
 * réellement, ou à ses abonnements. Pas de suggestion qui pousse à consommer davantage :
 * on ne recommande que des alternatives à des dépenses existantes.
 */
export function suggestDeals(
  txs: TransactionRow[], categories: CategoryRow[], subs: SubscriptionRow[], from: string, to: string, months: number,
): DealSuggestion[] {
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  const spend = new Map<string, Minor>();
  for (const t of txs) {
    if (t.type !== "expense" || t.status !== "booked" || t.date < from || t.date > to || !t.category_id) continue;
    const slug = slugById.get(t.category_id);
    if (slug) spend.set(slug, (spend.get(slug) ?? 0) + t.amount_minor);
  }
  const kinds = new Set(subs.filter((s) => s.status === "active").map((s) => s.kind));
  const out: DealSuggestion[] = [];
  for (const deal of DEALS) {
    const subMatch = deal.matchesSubscriptionKinds?.find((k) => kinds.has(k as SubscriptionRow["kind"]));
    const monthly = mulDiv(deal.matchesSpending.reduce((s, c) => s + (spend.get(c) ?? 0), 0), 1, Math.max(1, months));
    if (subMatch) {
      out.push({ deal, reason: "Tu as un abonnement de ce type : compare-le avec cette offre.", observedMonthlyMinor: monthly });
    } else if (monthly >= 2000) {
      out.push({ deal, reason: `Tu dépenses en moyenne ${Math.round(monthly / 100)} € par mois dans ce domaine.`, observedMonthlyMinor: monthly });
    }
  }
  return out.sort((a, b) => b.observedMonthlyMinor - a.observedMonthlyMinor);
}
