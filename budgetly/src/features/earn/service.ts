/**
 * Pertinence des opportunités (score explicable) et calcul de rentabilité.
 */
import { mulDiv } from "@/lib/money";
import type { AvailabilityRow, Minor } from "@/types/db";
import type { Opportunity } from "./types";

export interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoredOpportunity extends Opportunity {
  score: number;
  factors: ScoreFactor[];
}

/** Score sur 100 : disponibilité (25), localisation (20), compétences (20), préférences (15), rémunération (20). */
export function scoreOpportunity(o: Opportunity, a: AvailabilityRow | null): ScoredOpportunity {
  const factors: ScoreFactor[] = [];
  if (!a) {
    return { ...o, score: 50, factors: [{ label: "Profil", points: 50, max: 100, detail: "Renseigne tes disponibilités pour un score personnalisé." }] };
  }
  // Disponibilité
  let dispo = 12;
  let dispoDetail = "Compatibilité horaire inconnue.";
  if (o.weekend === true) {
    dispo = a.weekend_ok ? 25 : 5;
    dispoDetail = a.weekend_ok ? "Mission le week-end, et tu es disponible le week-end." : "Mission le week-end alors que tu ne l'es pas.";
  } else if (o.durationHours !== null && a.hours_per_week !== null) {
    const fits = o.durationHours <= a.hours_per_week * 4;
    dispo = fits ? 22 : 8;
    dispoDetail = fits ? `${o.durationHours} h au total, compatible avec tes ${a.hours_per_week} h/semaine.` : `${o.durationHours} h : plus que ta disponibilité mensuelle.`;
  }
  factors.push({ label: "Disponibilité", points: dispo, max: 25, detail: dispoDetail });

  // Localisation
  let loc = 10;
  let locDetail = "Localisation à vérifier.";
  if (o.remote) {
    loc = a.remote_ok ? 20 : 8;
    locDetail = a.remote_ok ? "À distance : aucun déplacement." : "À distance, mais tu préfères le présentiel.";
  } else if (o.location && a.mobility === "none") {
    loc = 6;
    locDetail = "Déplacement nécessaire alors que ta mobilité est limitée.";
  } else if (o.location) {
    loc = 15;
    locDetail = `Sur place (${o.location}).`;
  }
  factors.push({ label: "Localisation", points: loc, max: 20, detail: locDetail });

  // Compétences
  const skills = a.skills.map((s) => s.toLowerCase());
  const matched = o.skills.filter((s) => skills.some((k) => s.toLowerCase().includes(k) || k.includes(s.toLowerCase())));
  const comp = o.skills.length === 0 ? 10 : Math.min(20, 8 + matched.length * 6);
  factors.push({ label: "Compétences", points: comp, max: 20, detail: matched.length ? `Correspond à : ${matched.join(", ")}.` : "Aucune compétence déclarée en commun." });

  // Préférences
  const pref = a.preferred_categories.length === 0 ? 8 : a.preferred_categories.includes(o.category) ? 15 : 3;
  factors.push({ label: "Préférences", points: pref, max: 15, detail: a.preferred_categories.includes(o.category) ? "Type de mission que tu as choisi." : "Hors de tes types de mission préférés." });

  // Rémunération
  let pay = 10;
  let payDetail = "Rémunération non précisée.";
  if (o.hourlyRateMinor !== null) {
    const min = a.min_hourly_rate_minor ?? 0;
    pay = o.hourlyRateMinor >= min ? 20 : 5;
    payDetail = min ? (o.hourlyRateMinor >= min ? "Au-dessus de ton taux horaire minimum." : "Sous ton taux horaire minimum.") : "Taux horaire annoncé.";
  }
  factors.push({ label: "Rémunération", points: pay, max: 20, detail: payDetail });

  return { ...o, score: factors.reduce((s, f) => s + f.points, 0), factors };
}

export interface ProfitabilityInput {
  /** Rémunération brute totale (si forfait) ou null pour utiliser taux × heures. */
  grossTotalMinor?: Minor | null;
  hourlyRateMinor?: Minor | null;
  workHours: number;
  travelHours: number;
  travelCostMinor: Minor;
  otherCostsMinor: Minor;
  /** Taux de cotisations/charges en pour mille (ex. 220 = 22 %) SAISI par l'utilisateur. */
  contributionRatePermille?: number | null;
}

export interface ProfitabilityResult {
  grossMinor: Minor;
  contributionsMinor: Minor | null;
  costsMinor: Minor;
  /** Revenu après frais (et après cotisations si un taux a été saisi). */
  netEstimateMinor: Minor;
  netIsBeforeContributions: boolean;
  totalHours: number;
  effectiveHourlyMinor: Minor | null;
  notes: string[];
}

export function profitability(i: ProfitabilityInput): ProfitabilityResult {
  const gross = i.grossTotalMinor ?? (i.hourlyRateMinor ? mulDiv(i.hourlyRateMinor, Math.round(i.workHours * 100), 100) : 0);
  const costs = i.travelCostMinor + i.otherCostsMinor;
  const hasRate = i.contributionRatePermille !== null && i.contributionRatePermille !== undefined;
  const contributions = hasRate ? mulDiv(gross, i.contributionRatePermille!, 1000) : null;
  const net = gross - (contributions ?? 0) - costs;
  const totalHours = i.workHours + i.travelHours;
  const notes = [
    hasRate
      ? "Cotisations calculées avec le taux que tu as saisi : vérifie-le sur ton contrat ou sur urssaf.fr."
      : "Montant AVANT cotisations sociales : le net réel dépend de ton contrat (salarié, CESU, micro-entreprise…).",
    "Estimation indicative : ce n'est pas un revenu garanti.",
  ];
  if (i.travelHours > i.workHours) notes.push("Le temps de trajet dépasse le temps de travail : la mission est peu rentable.");
  return {
    grossMinor: gross,
    contributionsMinor: contributions,
    costsMinor: costs,
    netEstimateMinor: net,
    netIsBeforeContributions: !hasRate,
    totalHours,
    effectiveHourlyMinor: totalHours > 0 ? mulDiv(net, 100, Math.round(totalHours * 100)) : null,
    notes,
  };
}
