/**
 * Objectifs d'épargne : progression, versement mensuel nécessaire, date estimée
 * et stratégies combinant épargne, économies et revenus complémentaires.
 * Aucune stratégie ne garantit l'obtention d'une mission ou d'une aide.
 */
import { addMonths, diffDays } from "@/lib/dates";
import { ceilTo, mulDiv, percent } from "@/lib/money";
import type { ISODate, Minor, SavingsAllocationRow, SavingsGoalRow } from "@/types/db";

export interface GoalProgress {
  goal: SavingsGoalRow;
  allocated: Minor;
  missing: Minor;
  percent: number;
  monthsLeft: number | null;
  daysLeft: number | null;
  requiredMonthly: Minor | null;
  /** Rythme observé : moyenne mensuelle des versements des 3 derniers mois. */
  observedMonthly: Minor;
  estimatedDate: ISODate | null;
  onTrack: boolean | null;
}

/** Nombre de mois entamés entre deux dates (minimum 1 si la date est future). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const m = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
  return Math.max(m + (Number(to.slice(8, 10)) >= Number(from.slice(8, 10)) ? 0 : -1), 0);
}

export function goalProgress(goal: SavingsGoalRow, allocations: SavingsAllocationRow[], today: ISODate): GoalProgress {
  const own = allocations.filter((a) => a.goal_id === goal.id);
  const allocated = own.reduce((s, a) => s + a.amount_minor, 0);
  const missing = Math.max(0, goal.target_minor - allocated);
  const threeMonthsAgo = addMonths(today, -3);
  const recent = own.filter((a) => a.date > threeMonthsAgo && a.date <= today).reduce((s, a) => s + a.amount_minor, 0);
  const observedMonthly = Math.max(0, mulDiv(recent, 1, 3));

  let monthsLeft: number | null = null;
  let daysLeft: number | null = null;
  let requiredMonthly: Minor | null = null;
  if (goal.target_date) {
    daysLeft = Math.max(0, diffDays(goal.target_date, today));
    monthsLeft = Math.max(1, monthsBetween(today, goal.target_date));
    requiredMonthly = missing === 0 ? 0 : ceilTo(mulDiv(missing, 1, monthsLeft), 100);
  }
  let estimatedDate: ISODate | null = null;
  if (missing === 0) estimatedDate = today;
  else if (observedMonthly > 0) estimatedDate = addMonths(today, Math.ceil(missing / observedMonthly));

  const onTrack = requiredMonthly === null ? null : missing === 0 || observedMonthly >= requiredMonthly;
  return { goal, allocated, missing, percent: Math.min(100, percent(allocated, goal.target_minor)), monthsLeft, daysLeft, requiredMonthly, observedMonthly, estimatedDate, onTrack };
}

export interface GoalStrategy {
  id: "A" | "B" | "C" | "D";
  title: string;
  monthlySaving: Minor;
  monthlyCutback: Minor;
  monthlyExtraIncome: Minor;
  months: number | null;
  feasible: boolean;
  assumptions: string[];
}

/**
 * Stratégies pour combler `missing` :
 *  A. épargner sur les revenus existants (dans la limite de la capacité d'épargne observée) ;
 *  B. réduire des dépenses non essentielles (au plus 15 % de leur moyenne) ;
 *  C. revenus complémentaires (heures × taux horaire renseigné, sans garantie) ;
 *  D. combinaison des trois.
 */
export function goalStrategies(input: {
  missing: Minor;
  monthsLeft: number | null;
  savingCapacity: Minor;
  nonEssentialMonthly: Minor;
  extraHoursPerMonth: number;
  hourlyRateMinor: Minor;
}): GoalStrategy[] {
  const { missing, savingCapacity } = input;
  const cut = mulDiv(input.nonEssentialMonthly, 15, 100);
  const extra = input.extraHoursPerMonth * input.hourlyRateMinor;
  const target = input.monthsLeft ? ceilTo(mulDiv(missing, 1, input.monthsLeft), 100) : null;
  const months = (monthly: Minor) => (monthly > 0 ? Math.ceil(missing / monthly) : null);
  const capA = Math.max(0, savingCapacity);
  const feasible = (monthly: Minor) => (target === null ? monthly > 0 : monthly >= target);

  const combo = capA + cut + extra;
  return [
    {
      id: "A", title: "Épargner sur tes revenus actuels", monthlySaving: capA, monthlyCutback: 0, monthlyExtraIncome: 0,
      months: months(capA), feasible: feasible(capA),
      assumptions: ["Capacité d'épargne = revenus moyens − dépenses moyennes des 3 derniers mois.", capA === 0 ? "Ta capacité actuelle est nulle ou négative." : "Montant maximum, à ajuster selon ton confort."],
    },
    {
      id: "B", title: "Réduire certaines dépenses non essentielles", monthlySaving: 0, monthlyCutback: cut, monthlyExtraIncome: 0,
      months: months(cut), feasible: feasible(cut),
      assumptions: ["Réduction de 15 % des dépenses non essentielles (loisirs, shopping, restaurants, abonnements…).", "Les dépenses essentielles (logement, alimentation, santé, études) ne sont jamais réduites."],
    },
    {
      id: "C", title: "Obtenir un revenu complémentaire", monthlySaving: 0, monthlyCutback: 0, monthlyExtraIncome: extra,
      months: months(extra), feasible: feasible(extra),
      assumptions: [
        input.extraHoursPerMonth > 0 ? `${input.extraHoursPerMonth} h/mois au taux horaire renseigné, avant cotisations et frais.` : "Renseigne tes disponibilités pour estimer ce levier.",
        "Aucune mission n'est garantie : ce levier dépend des offres disponibles et de ta candidature.",
      ],
    },
    {
      id: "D", title: "Combiner les leviers", monthlySaving: capA, monthlyCutback: cut, monthlyExtraIncome: extra,
      months: months(combo), feasible: feasible(combo),
      assumptions: ["Somme des trois leviers précédents.", "Les montants restent des estimations, non des revenus acquis."],
    },
  ];
}
