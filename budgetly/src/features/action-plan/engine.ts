/**
 * Moteur de plan d'action — déterministe, explicable et testable.
 *
 * 1. Des générateurs produisent des actions candidates à partir de l'instantané financier,
 *    des prévisions, des budgets, des objectifs, des abonnements, des aides et des bons plans.
 * 2. Chaque candidate reçoit un score de priorité (0-100) décomposé en facteurs :
 *      urgence (0-30) + impact (0-25) + faisabilité/temps (0-15) + confiance (0-15)
 *      + pertinence (0-10) + préférence utilisateur (0-5).
 * 3. On retient 3 à 5 actions, en limitant à 2 actions du même type.
 *
 * Les montants d'impact sont des POTENTIELS ou ESTIMATIONS, jamais des revenus acquis.
 */
import { AIDS } from "@/data/aids";
import { addDays, diffDays, endOfMonth, fmt, startOfMonth, startOfWeek } from "@/lib/dates";
import { formatMoney, mulDiv } from "@/lib/money";
import type { ActionItemRow, ActionType, AidApplicationRow, Insert, ISODate, Minor } from "@/types/db";
import { evaluateAid, factsFromProfile } from "../aids/eligibility";
import { budgetStatuses } from "../budgets/service";
import { suggestDeals } from "../deals/compare";
import { accountBalances, totals } from "../finance/balances";
import type { FinancialSnapshot } from "../finance/snapshot";
import { forecast } from "../forecasts/engine";
import { goalProgress } from "../goals/service";
import { findUnusualExpenses } from "../alerts/engine";
import { summarizeSubscriptions } from "../subscriptions/service";

export interface ScoreBreakdown {
  urgency: number;
  impact: number;
  feasibility: number;
  confidence: number;
  relevance: number;
  preference: number;
}

export interface ActionCandidate {
  key: string;
  type: ActionType;
  title: string;
  description: string;
  rationale: string;
  impactMinor: Minor | null;
  impactKind: "potential" | "estimated" | "avoided_risk" | null;
  timeMinutes: number;
  source: string;
  confidence: "low" | "medium" | "high";
  validUntil: ISODate | null;
  href: string;
  ctaLabel: string;
  /** Urgence 0-30 calculée par le générateur. */
  urgency: number;
  /** Pertinence 0-10 calculée par le générateur. */
  relevance: number;
}

export interface ScoredAction extends ActionCandidate {
  priority: number;
  breakdown: ScoreBreakdown;
}

export interface PlanContext {
  snapshot: FinancialSnapshot;
  aidApplications: AidApplicationRow[];
  /** Types d'actions écartés récemment par l'utilisateur (préférence négative). */
  dismissedTypes?: ActionType[];
  /** Objectifs déclarés à l'onboarding. */
  objectives?: string[];
}

const OBJECTIVE_TO_TYPES: Record<string, ActionType[]> = {
  budget: ["budget", "data_quality"],
  avoid_overdraft: ["cashflow", "budget"],
  save: ["savings", "goal"],
  find_job: ["earn"],
  increase_income: ["earn"],
  discover_aids: ["aid"],
  reduce_spending: ["subscription", "deal", "budget"],
  fund_project: ["goal", "savings"],
};

export function scoreCandidate(c: ActionCandidate, ctx: { monthlyIncome: Minor; dismissedTypes: ActionType[]; preferredTypes: ActionType[] }): ScoredAction {
  // Impact relatif aux revenus : 10 % des revenus mensuels ou plus = impact maximal.
  const ref = Math.max(ctx.monthlyIncome, 50000);
  const impact = c.impactMinor ? Math.min(25, Math.round((c.impactMinor * 25 * 10) / ref)) : 4;
  const feasibility = c.timeMinutes <= 10 ? 15 : c.timeMinutes <= 30 ? 12 : c.timeMinutes <= 90 ? 8 : 4;
  const confidence = c.confidence === "high" ? 15 : c.confidence === "medium" ? 10 : 5;
  const preference = ctx.dismissedTypes.includes(c.type) ? 0 : ctx.preferredTypes.includes(c.type) ? 5 : 2;
  const breakdown: ScoreBreakdown = {
    urgency: Math.max(0, Math.min(30, c.urgency)),
    impact,
    feasibility,
    confidence,
    relevance: Math.max(0, Math.min(10, c.relevance)),
    preference,
  };
  const priority = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { ...c, priority, breakdown };
}

export function generateCandidates(ctx: PlanContext): ActionCandidate[] {
  const s = ctx.snapshot;
  const out: ActionCandidate[] = [];
  const weekEnd = addDays(startOfWeek(s.today), 6);
  const monthEnd = endOfMonth(s.today);
  const hasData = s.accounts.length > 0;

  if (!hasData) {
    out.push({
      key: "setup:first-account", type: "data_quality", title: "Ajouter ton premier compte",
      description: "Renseigne ton compte courant et son solde pour que BUDGETLY calcule ta situation.",
      rationale: "Aucun compte n'est encore enregistré : aucun calcul n'est possible sans solde de départ.",
      impactMinor: null, impactKind: null, timeMinutes: 3, source: "Tes données BUDGETLY", confidence: "high",
      validUntil: null, href: "/app/accounts", ctaLabel: "Ajouter un compte", urgency: 30, relevance: 10,
    });
    return out;
  }

  // 1. Trésorerie : risque de découvert d'ici la fin du mois.
  const f = forecast(s, Math.max(7, diffDays(monthEnd, s.today)));
  const t = totals(accountBalances(s.accounts, s.transactions, s.today));
  if (f.minBalance.realistic.value < 0 || f.endBalance.realistic < 0) {
    const shortfall = -Math.min(f.minBalance.realistic.value, f.endBalance.realistic);
    const daysLeft = Math.max(1, diffDays(monthEnd, s.today));
    const fixedLeft = f.scheduledExpenses;
    const incomeLeft = f.expectedIncome;
    const daily = Math.max(0, mulDiv(t.available + incomeLeft - fixedLeft, 1, daysLeft));
    out.push({
      key: `cashflow:plan:${startOfMonth(s.today)}`, type: "cashflow",
      title: `Limiter tes dépenses à ${formatMoney(daily)} par jour jusqu'au ${fmt.day(monthEnd)}`,
      description: `Au rythme actuel, ton solde pourrait descendre à ${formatMoney(f.minBalance.realistic.value)}. Un plafond quotidien te permet de finir le mois sans découvert.`,
      rationale: `Prévision réaliste : écart de ${formatMoney(shortfall)} ; ${daysLeft} jours restants, ${formatMoney(fixedLeft)} de charges prévues et ${formatMoney(incomeLeft)} de revenus attendus.`,
      impactMinor: shortfall, impactKind: "avoided_risk", timeMinutes: 5, source: "Prévision BUDGETLY (calcul déterministe)",
      confidence: f.reliability.level === "low" ? "low" : "medium", validUntil: monthEnd, href: "/app/forecast",
      ctaLabel: "Voir la prévision", urgency: f.overdraftDate && diffDays(f.overdraftDate, s.today) <= 10 ? 30 : 24, relevance: 10,
    });
  } else if (f.belowThresholdDate) {
    out.push({
      key: `cashflow:threshold:${startOfMonth(s.today)}`, type: "cashflow",
      title: "Garder une marge avant la fin du mois",
      description: `Ton solde pourrait passer sous ton seuil de sécurité (${formatMoney(f.safetyThreshold)}) vers le ${fmt.day(f.belowThresholdDate)}.`,
      rationale: "Le seuil de sécurité est la réserve que tu souhaites conserver pour les imprévus.",
      impactMinor: null, impactKind: null, timeMinutes: 5, source: "Prévision BUDGETLY", confidence: "medium",
      validUntil: monthEnd, href: "/app/forecast", ctaLabel: "Voir la prévision", urgency: 16, relevance: 7,
    });
  }

  // 2. Échéance importante imminente.
  for (const big of f.largeUpcoming.filter((i) => i.date <= addDays(s.today, 10)).slice(0, 1)) {
    out.push({
      key: `cashflow:large:${big.sourceId}:${big.date}`, type: "cashflow",
      title: `Prévoir ${big.label} (${formatMoney(big.amount_minor)}) le ${fmt.day(big.date)}`,
      description: "Vérifie que le compte prélevé sera suffisamment approvisionné ce jour-là.",
      rationale: "Charge supérieure à 20 % de tes revenus mensuels déclarés.",
      impactMinor: big.amount_minor, impactKind: "avoided_risk", timeMinutes: 5, source: "Tes échéances déclarées",
      confidence: "high", validUntil: big.date, href: "/app/forecast", ctaLabel: "Voir l'échéancier", urgency: 20, relevance: 7,
    });
  }

  // 3. Budgets dépassés ou en passe de l'être.
  const statuses = budgetStatuses(s.budgets, s.categories, s.transactions, startOfMonth(s.today), s.today);
  if (!statuses.length) {
    out.push({
      key: "budget:create-first", type: "budget", title: "Créer ton premier budget mensuel",
      description: "BUDGETLY peut te suggérer une répartition à partir de tes dépenses réelles.",
      rationale: "Aucun budget pour ce mois : sans plafond, les dépassements passent inaperçus.",
      impactMinor: null, impactKind: null, timeMinutes: 10, source: "Tes données BUDGETLY", confidence: "high",
      validUntil: monthEnd, href: "/app/budgets", ctaLabel: "Créer un budget", urgency: 12, relevance: 8,
    });
  }
  for (const b of statuses.filter((x) => x.category && x.spent > x.expectedToDate && x.percentUsed >= 85).slice(0, 2)) {
    out.push({
      key: `budget:over:${b.budget.id}`, type: "budget",
      title: `Réorganiser ton budget ${b.category!.name}`,
      description: b.percentUsed > 100
        ? `Dépassé de ${formatMoney(-b.remaining)}. Décide où compenser ce mois-ci, sans toucher aux dépenses essentielles.`
        : `Déjà ${b.percentUsed} % consommés alors que le mois n'est pas fini.`,
      rationale: `Dépensé ${formatMoney(b.spent)} pour ${formatMoney(b.budget.amount_minor)} prévus (rythme attendu à date : ${formatMoney(b.expectedToDate)}).`,
      impactMinor: Math.max(0, b.spent - b.expectedToDate), impactKind: "estimated", timeMinutes: 10,
      source: "Tes budgets et opérations", confidence: "high", validUntil: monthEnd, href: "/app/budgets",
      ctaLabel: "Ajuster", urgency: b.percentUsed > 100 ? 20 : 14, relevance: 7,
    });
  }

  // 4. Abonnements.
  const subs = summarizeSubscriptions(s.subscriptions, s.today, s.profile?.monthly_income_minor ?? null);
  const video = s.subscriptions.filter((x) => x.status === "active" && x.kind === "streaming_video");
  if (video.length >= 2) {
    const cheapest = Math.min(...video.map((v) => v.amount_minor));
    out.push({
      key: "subscription:streaming-overlap", type: "subscription",
      title: `Comparer tes ${video.length} abonnements de streaming vidéo`,
      description: "Garder un seul service à la fois et alterner selon les contenus peut réduire la facture.",
      rationale: `Coût mensuel cumulé : ${formatMoney(video.reduce((a, v) => a + v.amount_minor, 0))}.`,
      impactMinor: video.reduce((a, v) => a + v.amount_minor, 0) - cheapest, impactKind: "potential",
      timeMinutes: 15, source: "Tes abonnements déclarés", confidence: "medium", validUntil: null,
      href: "/app/subscriptions", ctaLabel: "Comparer", urgency: 8, relevance: 8,
    });
  }
  for (const r of subs.renewingSoon.filter((x) => x.subscription.frequency === "yearly").slice(0, 1)) {
    out.push({
      key: `subscription:renewal:${r.subscription.id}:${r.date}`, type: "subscription",
      title: `Décider avant le renouvellement de ${r.subscription.service}`,
      description: `Renouvellement annuel de ${formatMoney(r.subscription.amount_minor)} le ${fmt.day(r.date)}.`,
      rationale: "Un abonnement annuel inutilisé coûte cher : c'est le bon moment pour vérifier.",
      impactMinor: r.subscription.amount_minor, impactKind: "potential", timeMinutes: 10,
      source: "Tes abonnements déclarés", confidence: "high", validUntil: r.date, href: "/app/subscriptions",
      ctaLabel: "Voir l'abonnement", urgency: 18, relevance: 7,
    });
  }

  // 5. Aides potentielles non encore suivies.
  const facts = factsFromProfile(s.profile);
  const tracked = new Set(ctx.aidApplications.map((a) => a.aid_slug));
  const potential = AIDS.filter((a) => !a.isTool && !tracked.has(a.slug) && evaluateAid(a, facts).status === "potential");
  for (const aid of potential.slice(0, 2)) {
    out.push({
      key: `aid:${aid.slug}`, type: "aid",
      title: `Vérifier ton éligibilité : ${aid.name}`,
      description: `${aid.summary} L'éligibilité réelle est déterminée uniquement par ${aid.organization}.`,
      rationale: `Selon ton profil, les critères connus semblent remplis : ${evaluateAid(aid, facts).met.join(", ").toLowerCase()}.`,
      impactMinor: null, impactKind: null, timeMinutes: 20, source: `${aid.source.provider} — ${aid.source.url}`,
      confidence: "low", validUntil: null, href: `/app/aids?aid=${aid.slug}`, ctaLabel: "Voir l'aide", urgency: 10, relevance: 8,
    });
  }
  if (!s.profile?.status) {
    out.push({
      key: "aid:complete-profile", type: "aid", title: "Compléter ton profil pour découvrir tes aides",
      description: "Statut, logement et tranche d'âge suffisent pour une première estimation.",
      rationale: "Sans ces informations, BUDGETLY ne peut pas estimer ton éligibilité.",
      impactMinor: null, impactKind: null, timeMinutes: 3, source: "Tes données BUDGETLY", confidence: "high",
      validUntil: null, href: "/app/settings", ctaLabel: "Compléter", urgency: 8, relevance: 6,
    });
  }

  // 6. Objectifs en retard.
  for (const g of s.goals.filter((x) => x.status === "active")) {
    const p = goalProgress(g, s.allocations, s.today);
    if (p.onTrack === false && p.requiredMonthly) {
      out.push({
        key: `goal:behind:${g.id}:${startOfMonth(s.today)}`, type: "goal",
        title: `Mettre de côté pour « ${g.name} »`,
        description: `Objectif de ${formatMoney(p.requiredMonthly)} par mois pour tenir ta date ; découvre les stratégies possibles.`,
        rationale: `Il manque ${formatMoney(p.missing)} et ton rythme récent est de ${formatMoney(p.observedMonthly)} par mois.`,
        impactMinor: p.requiredMonthly, impactKind: "estimated", timeMinutes: 10, source: "Tes objectifs",
        confidence: "high", validUntil: monthEnd, href: `/app/goals?goal=${g.id}`, ctaLabel: "Voir les stratégies",
        urgency: 9, relevance: 7,
      });
    }
  }
  const emergency = s.goals.find((g) => g.kind === "emergency" && g.status === "active");
  if (!emergency && t.savings < 30000) {
    out.push({
      key: "savings:emergency-fund", type: "savings", title: "Commencer une épargne de précaution",
      description: "Même 10 € par mois aident à absorber un imprévu sans découvert.",
      rationale: `Ton épargne disponible est de ${formatMoney(t.savings)}.`,
      impactMinor: 1000, impactKind: "estimated", timeMinutes: 5, source: "Bonnes pratiques budgétaires",
      confidence: "medium", validUntil: null, href: "/app/goals?new=emergency", ctaLabel: "Créer l'objectif", urgency: 6, relevance: 6,
    });
  }

  // 7. Dépense inhabituelle.
  for (const tx of findUnusualExpenses(s).slice(0, 1)) {
    out.push({
      key: `data:unusual:${tx.id}`, type: "data_quality", title: `Vérifier la dépense « ${tx.label} »`,
      description: `${formatMoney(tx.amount_minor)} le ${fmt.day(tx.date)} : bien plus que d'habitude dans cette catégorie. Erreur, fraude ou achat ponctuel ?`,
      rationale: "Montant supérieur à 3 fois ta dépense médiane dans cette catégorie.",
      impactMinor: tx.amount_minor, impactKind: "potential", timeMinutes: 5, source: "Tes opérations", confidence: "medium",
      validUntil: addDays(tx.date, 30), href: `/app/transactions?q=${encodeURIComponent(tx.label.slice(0, 30))}`,
      ctaLabel: "Vérifier", urgency: 14, relevance: 6,
    });
  }

  // 8. Qualité des données : opérations non catégorisées.
  const uncategorized = s.transactions.filter((x) => !x.category_id && (x.type === "expense" || x.type === "income") && x.date >= addDays(s.today, -60)).length;
  if (uncategorized >= 3) {
    out.push({
      key: `data:uncategorized:${startOfWeek(s.today)}`, type: "data_quality", title: `Catégoriser ${uncategorized} opérations`,
      description: "Des catégories précises rendent tes budgets et prévisions fiables.",
      rationale: `${uncategorized} opérations des 60 derniers jours sans catégorie.`,
      impactMinor: null, impactKind: null, timeMinutes: Math.min(30, uncategorized), source: "Tes opérations",
      confidence: "high", validUntil: weekEnd, href: "/app/transactions?uncategorized=1", ctaLabel: "Catégoriser", urgency: 7, relevance: 6,
    });
  }

  // 9. Bons plans liés à des dépenses réelles.
  const deals = suggestDeals(s.transactions, s.categories, s.subscriptions, addDays(s.today, -90), s.today, 3);
  for (const d of deals.slice(0, 1)) {
    out.push({
      key: `deal:${d.deal.slug}`, type: "deal", title: `Comparer : ${d.deal.title}`,
      description: `${d.deal.description} Calcule toi-même l'économie avec tes montants réels.`,
      rationale: d.reason,
      impactMinor: null, impactKind: null, timeMinutes: 10, source: `${d.deal.source.provider} — ${d.deal.source.url}`,
      confidence: "low", validUntil: null, href: `/app/deals?deal=${d.deal.slug}`, ctaLabel: "Comparer", urgency: 5, relevance: 6,
    });
  }

  // 10. Revenus complémentaires (uniquement si activé par l'utilisateur).
  if (s.preferences?.opportunities_enabled && (f.endBalance.realistic < f.safetyThreshold || (ctx.objectives ?? []).some((o) => o === "find_job" || o === "increase_income"))) {
    const hours = s.availability?.hours_per_week ?? null;
    out.push({
      key: `earn:search:${startOfWeek(s.today)}`, type: "earn", title: "Explorer une mission compatible avec tes disponibilités",
      description: hours ? `Tu as indiqué ${hours} h disponibles par semaine. Les offres sont triées selon leur compatibilité.` : "Renseigne tes disponibilités pour des suggestions adaptées.",
      rationale: "Revenu complémentaire possible, jamais garanti : il n'est pas intégré à tes prévisions tant qu'il n'est pas perçu.",
      impactMinor: null, impactKind: null, timeMinutes: 30, source: "Fournisseurs d'offres connectés", confidence: "low",
      validUntil: weekEnd, href: "/app/earn", ctaLabel: "Voir les opportunités", urgency: f.endBalance.realistic < 0 ? 14 : 6, relevance: 6,
    });
  }

  return out;
}

export function buildPlan(ctx: PlanContext, max = 5): ScoredAction[] {
  const preferredTypes = (ctx.objectives ?? ctx.snapshot.profile?.objectives ?? []).flatMap((o) => OBJECTIVE_TO_TYPES[o] ?? []);
  const scored = generateCandidates(ctx)
    .map((c) => scoreCandidate(c, { monthlyIncome: ctx.snapshot.profile?.monthly_income_minor ?? 0, dismissedTypes: ctx.dismissedTypes ?? [], preferredTypes }))
    .sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  const perType = new Map<ActionType, number>();
  const out: ScoredAction[] = [];
  for (const a of scored) {
    const n = perType.get(a.type) ?? 0;
    if (n >= 2) continue;
    perType.set(a.type, n + 1);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

export function toActionRow(a: ScoredAction, today: ISODate): Insert<"action_items"> {
  return {
    week_start: startOfWeek(today), key: a.key, type: a.type, title: a.title.slice(0, 140), description: a.description.slice(0, 600),
    rationale: a.rationale.slice(0, 600), priority: a.priority, score_breakdown: { ...a.breakdown }, impact_minor: a.impactMinor,
    impact_kind: a.impactKind, time_minutes: a.timeMinutes, source: a.source.slice(0, 200), confidence: a.confidence,
    valid_until: a.validUntil, href: a.href, cta_label: a.ctaLabel,
  };
}

/** Résultats : réalisations (montants confirmés) séparées des projections. */
export function planResults(items: ActionItemRow[]) {
  const done = items.filter((i) => i.status === "done");
  const sumKind = (k: ActionItemRow["realized_kind"]) => done.filter((i) => i.realized_kind === k).reduce((s, i) => s + (i.realized_minor ?? 0), 0);
  return {
    completed: done.length,
    total: items.length,
    realized: { savings: sumKind("saving"), extraIncome: sumKind("extra_income"), aidsReceived: sumKind("aid_received") },
    projected: items.filter((i) => i.status !== "done" && i.status !== "dismissed").reduce((s, i) => s + (i.impact_kind === "potential" || i.impact_kind === "estimated" ? i.impact_minor ?? 0 : 0), 0),
  };
}
