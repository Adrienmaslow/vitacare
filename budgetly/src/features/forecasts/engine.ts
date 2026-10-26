/**
 * Moteur de prévision de trésorerie déterministe, calculé jour par jour.
 *
 *   solde(j) = solde(j-1) + revenus attendus(j) − charges prévues(j) − dépenses variables estimées(j)
 *
 * - Point de départ : solde disponible des comptes hors épargne (comptable + en attente).
 * - Revenus attendus : UNIQUEMENT les revenus récurrents déclarés (jamais une mission
 *   disponible, une aide potentielle ou un revenu hypothétique).
 * - Charges prévues : récurrences de dépense + abonnements actifs, non encore enregistrés.
 * - Dépenses variables : moyenne quotidienne observée des dépenses non récurrentes
 *   (fenêtre de 90 jours, minimum 14 jours d'historique), modulée par scénario.
 */
import { addDays, diffDays, eachDay } from "@/lib/dates";
import { mulDiv } from "@/lib/money";
import type { ISODate, Minor } from "@/types/db";
import { accountBalances, SAVINGS_ACCOUNT_TYPES, totals } from "../finance/balances";
import { scheduledBetween, type ScheduledItem } from "../finance/schedule";
import type { FinancialSnapshot } from "../finance/snapshot";

export type Scenario = "optimistic" | "realistic" | "pessimistic";

/** Multiplicateurs entiers (en %) appliqués aux dépenses variables. */
export const SCENARIO_FACTORS: Record<Scenario, number> = { optimistic: 85, realistic: 100, pessimistic: 120 };

export const HISTORY_WINDOW_DAYS = 90;
export const MIN_HISTORY_DAYS = 14;

export interface VariableSpendEstimate {
  /** Dépense variable quotidienne moyenne (centimes). */
  dailyMinor: Minor;
  observedDays: number;
  observedTransactions: number;
  from: ISODate | null;
  to: ISODate;
  sufficient: boolean;
}

/**
 * Estime la dépense variable quotidienne : dépenses « booked » non liées à une
 * récurrence/un abonnement, hors transferts, sur les HISTORY_WINDOW_DAYS derniers jours.
 */
export function estimateVariableSpend(s: FinancialSnapshot): VariableSpendEstimate {
  const windowStart = addDays(s.today, -HISTORY_WINDOW_DAYS + 1);
  const accountIds = new Set(s.accounts.filter((a) => !SAVINGS_ACCOUNT_TYPES.includes(a.type)).map((a) => a.id));
  const allDates = s.transactions.filter((t) => t.status === "booked" && t.date <= s.today).map((t) => t.date);
  const firstData = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : null;
  const from = firstData && firstData > windowStart ? firstData : firstData ? windowStart : null;
  if (!from) return { dailyMinor: 0, observedDays: 0, observedTransactions: 0, from: null, to: s.today, sufficient: false };
  let total = 0;
  let n = 0;
  for (const t of s.transactions) {
    if (t.type !== "expense" || t.status !== "booked" || t.date < from || t.date > s.today) continue;
    if (t.recurring_id || t.subscription_id) continue;
    if (!accountIds.has(t.account_id)) continue;
    total += t.amount_minor;
    n++;
  }
  const observedDays = diffDays(s.today, from) + 1;
  return {
    dailyMinor: mulDiv(total, 1, observedDays),
    observedDays,
    observedTransactions: n,
    from,
    to: s.today,
    sufficient: observedDays >= MIN_HISTORY_DAYS,
  };
}

export interface ForecastPoint {
  date: ISODate;
  optimistic: Minor;
  realistic: Minor;
  pessimistic: Minor;
  /** Événements planifiés ce jour-là. */
  events: ScheduledItem[];
}

export interface ForecastResult {
  start: ISODate;
  end: ISODate;
  startingBalance: Minor;
  safetyThreshold: Minor;
  points: ForecastPoint[];
  endBalance: Record<Scenario, Minor>;
  minBalance: Record<Scenario, { value: Minor; date: ISODate }>;
  /** Premier jour où le scénario réaliste passe sous le seuil de sécurité. */
  belowThresholdDate: ISODate | null;
  /** Premier jour où le scénario réaliste devient négatif. */
  overdraftDate: ISODate | null;
  overdraftDatePessimistic: ISODate | null;
  variable: VariableSpendEstimate;
  expectedIncome: Minor;
  scheduledExpenses: Minor;
  largeUpcoming: ScheduledItem[];
  reliability: { level: "low" | "medium" | "high"; reasons: string[] };
  assumptions: string[];
}

export function reliabilityOf(v: VariableSpendEstimate, hasRecurring: boolean): ForecastResult["reliability"] {
  const reasons: string[] = [];
  let score = 0;
  if (v.observedDays >= 60) score += 2;
  else if (v.observedDays >= MIN_HISTORY_DAYS) score += 1;
  else reasons.push(`Moins de ${MIN_HISTORY_DAYS} jours d'historique : dépenses variables peu fiables.`);
  if (v.observedTransactions >= 30) score += 1;
  else reasons.push("Peu d'opérations enregistrées.");
  if (hasRecurring) score += 1;
  else reasons.push("Aucun revenu ni charge récurrente déclaré.");
  const level = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
  if (level === "high") reasons.push("Historique suffisant et échéances déclarées.");
  return { level, reasons };
}

export function forecast(s: FinancialSnapshot, horizonDays: number, opts: { extraDailyMinor?: Minor } = {}): ForecastResult {
  const start = s.today;
  const end = addDays(start, horizonDays);
  const balances = accountBalances(s.accounts, s.transactions, s.today);
  const t = totals(balances);
  // Les opérations futures déjà saisies (date > aujourd'hui) sont intégrées comme événements.
  const futureTx = s.transactions.filter((x) => x.date > s.today && x.date <= end && !x.type.startsWith("transfer"));
  const scheduled = scheduledBetween(s.recurring, s.subscriptions, s.transactions, addDays(start, 1), end);
  const savingsIds = new Set(s.accounts.filter((a) => SAVINGS_ACCOUNT_TYPES.includes(a.type)).map((a) => a.id));
  const relevant = scheduled.filter((i) => !i.account_id || !savingsIds.has(i.account_id));
  const events = new Map<ISODate, ScheduledItem[]>();
  for (const i of relevant) events.set(i.date, [...(events.get(i.date) ?? []), i]);
  for (const x of futureTx) {
    if (savingsIds.has(x.account_id)) continue;
    const item: ScheduledItem = {
      date: x.date, label: x.label, type: x.type as "income" | "expense", amount_minor: x.amount_minor,
      category_id: x.category_id, account_id: x.account_id, source: "recurring", sourceId: x.id,
    };
    events.set(x.date, [...(events.get(x.date) ?? []), item]);
  }

  const variable = estimateVariableSpend(s);
  const extra = opts.extraDailyMinor ?? 0;
  const daily: Record<Scenario, Minor> = {
    optimistic: mulDiv(variable.dailyMinor, SCENARIO_FACTORS.optimistic, 100) + extra,
    realistic: mulDiv(variable.dailyMinor, SCENARIO_FACTORS.realistic, 100) + extra,
    pessimistic: mulDiv(variable.dailyMinor, SCENARIO_FACTORS.pessimistic, 100) + extra,
  };

  const startingBalance = t.available;
  const run: Record<Scenario, Minor> = { optimistic: startingBalance, realistic: startingBalance, pessimistic: startingBalance };
  const minBalance: ForecastResult["minBalance"] = {
    optimistic: { value: startingBalance, date: start },
    realistic: { value: startingBalance, date: start },
    pessimistic: { value: startingBalance, date: start },
  };
  const threshold = s.profile?.safety_threshold_minor ?? 5000;
  let belowThresholdDate: ISODate | null = startingBalance < threshold ? start : null;
  let overdraftDate: ISODate | null = startingBalance < 0 ? start : null;
  let overdraftDatePessimistic: ISODate | null = startingBalance < 0 ? start : null;
  let expectedIncome = 0;
  let scheduledExpenses = 0;
  const points: ForecastPoint[] = [{ date: start, ...run, events: [] }];

  for (const d of eachDay(addDays(start, 1), end)) {
    const ev = events.get(d) ?? [];
    let delta = 0;
    for (const e of ev) {
      if (e.type === "income") {
        delta += e.amount_minor;
        expectedIncome += e.amount_minor;
      } else {
        delta -= e.amount_minor;
        scheduledExpenses += e.amount_minor;
      }
    }
    for (const sc of ["optimistic", "realistic", "pessimistic"] as const) {
      run[sc] += delta - daily[sc];
      if (run[sc] < minBalance[sc].value) minBalance[sc] = { value: run[sc], date: d };
    }
    if (!belowThresholdDate && run.realistic < threshold) belowThresholdDate = d;
    if (!overdraftDate && run.realistic < 0) overdraftDate = d;
    if (!overdraftDatePessimistic && run.pessimistic < 0) overdraftDatePessimistic = d;
    points.push({ date: d, ...run, events: ev });
  }

  const monthlyIncome = s.profile?.monthly_income_minor ?? 0;
  const largeLimit = Math.max(mulDiv(monthlyIncome, 20, 100), 10000);
  const largeUpcoming = relevant.filter((i) => i.type === "expense" && i.amount_minor >= largeLimit).slice(0, 5);

  const assumptions = [
    `Solde de départ : solde disponible des comptes courants (hors épargne), opérations en attente incluses.`,
    `Revenus attendus : uniquement tes revenus récurrents déclarés. Aucune mission, aide potentielle ou revenu hypothétique n'est compté.`,
    `Charges prévues : échéances récurrentes et abonnements actifs non encore enregistrés.`,
    variable.sufficient
      ? `Dépenses variables : ${variable.observedTransactions} opérations sur ${variable.observedDays} jours, soit une moyenne quotidienne réelle.`
      : `Dépenses variables : historique insuffisant (${variable.observedDays} jours) — estimation fragile.`,
    `Scénarios : optimiste = ${SCENARIO_FACTORS.optimistic} % des dépenses variables moyennes, réaliste = 100 %, pessimiste = ${SCENARIO_FACTORS.pessimistic} %.`,
  ];

  return {
    start, end, startingBalance, safetyThreshold: threshold, points,
    endBalance: { optimistic: run.optimistic, realistic: run.realistic, pessimistic: run.pessimistic },
    minBalance, belowThresholdDate, overdraftDate, overdraftDatePessimistic, variable,
    expectedIncome, scheduledExpenses, largeUpcoming,
    reliability: reliabilityOf(variable, s.recurring.some((r) => r.is_active) || s.subscriptions.some((x) => x.status === "active")),
    assumptions,
  };
}
