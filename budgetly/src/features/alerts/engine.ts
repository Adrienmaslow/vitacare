/**
 * Moteur d'alertes : produit des alertes déterministes à partir de l'instantané.
 * Chaque alerte porte une clé de déduplication stable : une même situation ne
 * génère qu'une notification (contrainte unique (user_id, dedup_key)).
 */
import { addDays, endOfMonth, fmt, monthKey, startOfMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { NotificationSettings, Priority } from "@/types/db";
import { accountBalances, totals } from "../finance/balances";
import type { FinancialSnapshot } from "../finance/snapshot";
import { upcoming } from "../finance/schedule";
import { budgetStatuses } from "../budgets/service";
import { forecast } from "../forecasts/engine";
import { goalProgress } from "../goals/service";
import { nextPaymentFrom } from "../subscriptions/service";

export type AlertKind =
  | "budget_near" | "budget_over" | "low_balance" | "overdraft_risk" | "unusual_expense"
  | "upcoming_debit" | "subscription_renewal" | "goal_behind" | "import_duplicates" | "large_charge";

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  budget_near: "Budget presque atteint",
  budget_over: "Budget dépassé",
  low_balance: "Solde faible",
  overdraft_risk: "Risque de découvert",
  unusual_expense: "Dépense inhabituelle",
  upcoming_debit: "Prélèvement imminent",
  subscription_renewal: "Renouvellement d'abonnement",
  goal_behind: "Objectif en retard",
  import_duplicates: "Doublons à l'import",
  large_charge: "Charge exceptionnelle imminente",
};

export interface Alert {
  kind: AlertKind;
  title: string;
  body: string;
  priority: Priority;
  dedupKey: string;
  actionLabel: string;
  actionHref: string;
}

const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Dépense inhabituelle : > 3 × la médiane de la catégorie (≥ 5 opérations) et ≥ 30 €. */
export function findUnusualExpenses(s: FinancialSnapshot, sinceDays = 7) {
  const since = addDays(s.today, -sinceDays);
  const byCat = new Map<string, number[]>();
  for (const t of s.transactions) {
    if (t.type !== "expense" || t.status !== "booked" || !t.category_id || t.date >= since) continue;
    byCat.set(t.category_id, [...(byCat.get(t.category_id) ?? []), t.amount_minor]);
  }
  const median = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m]! : Math.round((a[m - 1]! + a[m]!) / 2);
  };
  return s.transactions.filter((t) => {
    if (t.type !== "expense" || t.status !== "booked" || !t.category_id || t.date < since || t.date > s.today) return false;
    if (t.recurring_id || t.subscription_id) return false;
    const hist = byCat.get(t.category_id) ?? [];
    return hist.length >= 5 && t.amount_minor >= 3000 && t.amount_minor > 3 * median(hist);
  });
}

export function computeAlerts(s: FinancialSnapshot): Alert[] {
  const alerts: Alert[] = [];
  const month = monthKey(s.today);
  const t = totals(accountBalances(s.accounts, s.transactions, s.today));
  const threshold = s.profile?.safety_threshold_minor ?? 5000;

  for (const b of budgetStatuses(s.budgets, s.categories, s.transactions, startOfMonth(s.today), s.today)) {
    const name = b.category?.name ?? "global";
    if (b.percentUsed > 100) {
      alerts.push({
        kind: "budget_over", priority: "high", dedupKey: `budget_over:${b.budget.id}:${month}`,
        title: `Budget ${name} dépassé`,
        body: `Tu as dépensé ${formatMoney(b.spent)} pour un budget de ${formatMoney(b.budget.amount_minor)} (${b.percentUsed} %).`,
        actionLabel: "Voir le budget", actionHref: "/app/budgets",
      });
    } else if (b.thresholdReached !== null) {
      alerts.push({
        kind: "budget_near", priority: b.thresholdReached >= 100 ? "high" : b.thresholdReached >= 85 ? "medium" : "low",
        dedupKey: `budget_near:${b.budget.id}:${month}:${b.thresholdReached}`,
        title: `Budget ${name} à ${b.percentUsed} %`,
        body: `Il te reste ${formatMoney(Math.max(0, b.remaining))} jusqu'au ${fmt.day(endOfMonth(s.today))}.`,
        actionLabel: "Ajuster", actionHref: "/app/budgets",
      });
    }
  }

  if (s.accounts.length && t.available < threshold) {
    alerts.push({
      kind: "low_balance", priority: t.available < 0 ? "critical" : "high", dedupKey: `low_balance:${s.today}`,
      title: t.available < 0 ? "Solde négatif" : "Solde faible",
      body: `Ton solde disponible est de ${formatMoney(t.available)}, sous ton seuil de sécurité de ${formatMoney(threshold)}.`,
      actionLabel: "Voir les prévisions", actionHref: "/app/forecast",
    });
  }

  if (s.accounts.length) {
    const f = forecast(s, 30);
    if (f.overdraftDate && f.overdraftDate > s.today) {
      alerts.push({
        kind: "overdraft_risk", priority: "critical", dedupKey: `overdraft_risk:${monthKey(f.overdraftDate)}`,
        title: "Risque de découvert",
        body: `Au rythme actuel, ton solde pourrait passer sous 0 € vers le ${fmt.day(f.overdraftDate)} (scénario réaliste). Fiabilité : ${f.reliability.level === "high" ? "bonne" : f.reliability.level === "medium" ? "moyenne" : "faible"}.`,
        actionLabel: "Voir mon plan d'action", actionHref: "/app/action-plan",
      });
    }
    for (const big of f.largeUpcoming.filter((i) => i.date <= addDays(s.today, 7))) {
      alerts.push({
        kind: "large_charge", priority: "medium", dedupKey: `large_charge:${big.sourceId}:${big.date}`,
        title: `Charge importante le ${fmt.day(big.date)}`,
        body: `${big.label} : ${formatMoney(big.amount_minor)} prévu. Vérifie que ton compte est suffisamment approvisionné.`,
        actionLabel: "Voir l'échéancier", actionHref: "/app/forecast",
      });
    }
  }

  for (const tx of findUnusualExpenses(s)) {
    alerts.push({
      kind: "unusual_expense", priority: "medium", dedupKey: `unusual:${tx.id}`,
      title: "Dépense inhabituelle",
      body: `${tx.label} : ${formatMoney(tx.amount_minor)} le ${fmt.day(tx.date)}, nettement au-dessus de tes dépenses habituelles dans cette catégorie.`,
      actionLabel: "Vérifier", actionHref: `/app/transactions?q=${encodeURIComponent(tx.label.slice(0, 30))}`,
    });
  }

  for (const item of upcoming(s.recurring, [], s.transactions, s.today, 3)) {
    if (item.type !== "expense") continue;
    alerts.push({
      kind: "upcoming_debit", priority: "low", dedupKey: `upcoming:${item.sourceId}:${item.date}`,
      title: `Prélèvement le ${fmt.day(item.date)}`,
      body: `${item.label} : ${formatMoney(item.amount_minor)}.`,
      actionLabel: "Voir les prévisions", actionHref: "/app/forecast",
    });
  }

  for (const sub of s.subscriptions.filter((x) => x.status === "active")) {
    const next = nextPaymentFrom(sub, s.today);
    const window = sub.frequency === "yearly" || sub.frequency === "quarterly" ? 14 : 3;
    if (next <= addDays(s.today, window)) {
      alerts.push({
        kind: "subscription_renewal", priority: sub.frequency === "yearly" ? "medium" : "low",
        dedupKey: `sub_renewal:${sub.id}:${next}`,
        title: `${sub.service} se renouvelle le ${fmt.day(next)}`,
        body: `Montant : ${formatMoney(sub.amount_minor)}. C'est le moment de vérifier si tu l'utilises toujours.`,
        actionLabel: "Mes abonnements", actionHref: "/app/subscriptions",
      });
    }
  }

  for (const g of s.goals.filter((x) => x.status === "active")) {
    const p = goalProgress(g, s.allocations, s.today);
    if (p.onTrack === false && p.requiredMonthly !== null) {
      alerts.push({
        kind: "goal_behind", priority: "low", dedupKey: `goal_behind:${g.id}:${month}`,
        title: `Objectif « ${g.name} » en retard`,
        body: `Il faudrait ${formatMoney(p.requiredMonthly)} par mois pour l'atteindre à temps ; ton rythme récent est de ${formatMoney(p.observedMonthly)}.`,
        actionLabel: "Voir les stratégies", actionHref: `/app/goals?goal=${g.id}`,
      });
    }
  }

  return alerts.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
}

/**
 * Filtre anti-spam : préférences (types désactivés, priorité minimale),
 * déduplication sur les clés existantes et plafond quotidien.
 */
export function selectNewAlerts(
  alerts: Alert[], existingKeys: Set<string>, sentToday: number, settings: NotificationSettings = {},
): Alert[] {
  const disabled = new Set(settings.disabledKinds ?? []);
  const min = PRIORITY_RANK[settings.minPriority ?? "low"];
  const cap = Math.max(0, (settings.maxPerDay ?? 6) - sentToday);
  const seen = new Set<string>();
  const out: Alert[] = [];
  for (const a of alerts) {
    if (disabled.has(a.kind) || PRIORITY_RANK[a.priority] < min) continue;
    if (existingKeys.has(a.dedupKey) || seen.has(a.dedupKey)) continue;
    seen.add(a.dedupKey);
    // Les alertes critiques passent toujours le plafond.
    if (out.length >= cap && a.priority !== "critical") continue;
    out.push(a);
  }
  return out;
}
