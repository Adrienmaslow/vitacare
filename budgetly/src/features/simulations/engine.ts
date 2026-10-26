/**
 * Simulateur « et si… ? » : applique des variations FICTIVES à la situation actuelle
 * et compare la projection avec la situation de référence. Ne modifie aucune donnée.
 */
import { diffDays, endOfMonth } from "@/lib/dates";
import { mulDiv } from "@/lib/money";
import type { ISODate, Minor } from "@/types/db";
import type { FinancialSnapshot } from "../finance/snapshot";
import { forecast } from "../forecasts/engine";
import { kpis } from "../analytics/service";
import { accountBalances, totals } from "../finance/balances";
import { goalProgress } from "../goals/service";

export interface SimulationParams {
  incomeDeltaMinor: Minor;
  rentDeltaMinor: Minor;
  expensesDeltaMinor: Minor;
  subscriptionsDeltaMinor: Minor;
  monthlySavingMinor: Minor;
  extraHoursPerMonth: number;
  hourlyRateMinor: Minor;
  exceptionalChargeMinor: Minor;
  exceptionalChargeDate: ISODate | null;
  horizonMonths: number;
}

export const DEFAULT_SIMULATION: SimulationParams = {
  incomeDeltaMinor: 0, rentDeltaMinor: 0, expensesDeltaMinor: 0, subscriptionsDeltaMinor: 0, monthlySavingMinor: 0,
  extraHoursPerMonth: 0, hourlyRateMinor: 0, exceptionalChargeMinor: 0, exceptionalChargeDate: null, horizonMonths: 3,
};

export interface SimulationOutcome {
  baseline: { endOfMonth: Minor; horizonEnd: Minor; minBalance: Minor; overdraftDate: ISODate | null; monthlyCapacity: Minor | null };
  scenario: { endOfMonth: Minor; horizonEnd: Minor; minBalance: Minor; overdraftDate: ISODate | null; monthlyCapacity: Minor | null };
  monthlyNetChange: Minor;
  series: { date: ISODate; baseline: Minor; scenario: Minor }[];
  goals: { name: string; baselineMonths: number | null; scenarioMonths: number | null }[];
  explanation: string[];
}

/** Variation mensuelle nette du scénario (positive = plus d'argent disponible). */
export function monthlyNetDelta(p: SimulationParams): Minor {
  const extraIncome = mulDiv(p.hourlyRateMinor, Math.round(p.extraHoursPerMonth * 100), 100);
  return p.incomeDeltaMinor + extraIncome - p.rentDeltaMinor - p.expensesDeltaMinor - p.subscriptionsDeltaMinor - p.monthlySavingMinor;
}

export function simulate(s: FinancialSnapshot, p: SimulationParams): SimulationOutcome {
  const horizon = Math.min(365, Math.max(30, p.horizonMonths * 30));
  const base = forecast(s, horizon);
  const delta = monthlyNetDelta(p);
  // Répartition quotidienne exacte du delta mensuel : cumul arrondi jour par jour (pas de dérive).
  const series = base.points.map((pt, i) => {
    let scenario = pt.realistic + mulDiv(delta * i, 12, 365);
    if (p.exceptionalChargeMinor && p.exceptionalChargeDate && pt.date >= p.exceptionalChargeDate) scenario -= p.exceptionalChargeMinor;
    return { date: pt.date, baseline: pt.realistic, scenario };
  });
  const eom = endOfMonth(s.today);
  const at = (d: ISODate, k: "baseline" | "scenario") => series.find((x) => x.date === d)?.[k] ?? series[series.length - 1]![k];
  const minOf = (k: "baseline" | "scenario") => Math.min(...series.map((x) => x[k]));
  const firstNeg = (k: "baseline" | "scenario") => series.find((x) => x[k] < 0)?.date ?? null;
  const k = kpis(s, totals(accountBalances(s.accounts, s.transactions, s.today)).available);

  const goals = s.goals.filter((g) => g.status === "active").map((g) => {
    const gp = goalProgress(g, s.allocations, s.today);
    const baseMonthly = gp.observedMonthly;
    const scenMonthly = baseMonthly + p.monthlySavingMinor;
    return {
      name: g.name,
      baselineMonths: gp.missing === 0 ? 0 : baseMonthly > 0 ? Math.ceil(gp.missing / baseMonthly) : null,
      scenarioMonths: gp.missing === 0 ? 0 : scenMonthly > 0 ? Math.ceil(gp.missing / scenMonthly) : null,
    };
  });

  const explanation = [
    "Simulation fictive : aucune donnée n'est modifiée tant que tu n'appliques pas explicitement un changement.",
    `Variation mensuelle nette simulée : ${delta >= 0 ? "+" : ""}${(delta / 100).toFixed(2).replace(".", ",")} € (répartie uniformément sur le mois).`,
    "Base de comparaison : la prévision réaliste (même méthode que la page Prévisions).",
  ];
  if (p.extraHoursPerMonth > 0) explanation.push("Les heures supplémentaires sont valorisées avant cotisations : le net réel sera inférieur.");
  if (p.monthlySavingMinor > 0) explanation.push("L'épargne programmée réduit le solde courant mais accélère tes objectifs.");

  return {
    baseline: { endOfMonth: at(eom, "baseline"), horizonEnd: series[series.length - 1]!.baseline, minBalance: minOf("baseline"), overdraftDate: firstNeg("baseline"), monthlyCapacity: k.savingCapacity },
    scenario: { endOfMonth: at(eom, "scenario"), horizonEnd: series[series.length - 1]!.scenario, minBalance: minOf("scenario"), overdraftDate: firstNeg("scenario"), monthlyCapacity: k.savingCapacity === null ? null : k.savingCapacity + delta + p.monthlySavingMinor },
    monthlyNetChange: delta,
    series: series.filter((_, i) => i % Math.max(1, Math.floor(horizon / 90)) === 0 || i === series.length - 1),
    goals,
    explanation,
  };
}

export function daysUntil(today: ISODate, d: ISODate | null): number | null {
  return d ? diffDays(d, today) : null;
}
