/** Abonnements : coûts équivalents, renouvellements, part des revenus. */
import { addDays, nextOccurrence, OCCURRENCES_PER_YEAR } from "@/lib/dates";
import { mulDiv, percent } from "@/lib/money";
import type { Frequency, ISODate, Minor, SubscriptionRow } from "@/types/db";

export function annualCost(amount: Minor, f: Frequency): Minor {
  return amount * OCCURRENCES_PER_YEAR[f];
}

export function monthlyEquivalent(amount: Minor, f: Frequency): Minor {
  return mulDiv(amount * OCCURRENCES_PER_YEAR[f], 1, 12);
}

/** Prochaine date de paiement ≥ aujourd'hui (si la date saisie est passée). */
export function nextPaymentFrom(s: Pick<SubscriptionRow, "next_payment_date" | "frequency">, today: ISODate): ISODate {
  let d = s.next_payment_date;
  const anchor = Number(d.slice(8, 10));
  let guard = 0;
  while (d < today && guard++ < 1000) d = nextOccurrence(d, s.frequency, anchor);
  return d;
}

export interface SubscriptionSummary {
  activeCount: number;
  monthlyTotal: Minor;
  annualTotal: Minor;
  shareOfIncome: number | null;
  renewingSoon: { subscription: SubscriptionRow; date: ISODate }[];
  byKind: Record<string, { count: number; monthly: Minor }>;
  insights: string[];
}

export function summarizeSubscriptions(subs: SubscriptionRow[], today: ISODate, monthlyIncome: Minor | null): SubscriptionSummary {
  const active = subs.filter((s) => s.status === "active");
  let monthly = 0, annual = 0;
  const byKind: SubscriptionSummary["byKind"] = {};
  const renewingSoon: SubscriptionSummary["renewingSoon"] = [];
  for (const s of active) {
    monthly += monthlyEquivalent(s.amount_minor, s.frequency);
    annual += annualCost(s.amount_minor, s.frequency);
    const k = (byKind[s.kind] ??= { count: 0, monthly: 0 });
    k.count++;
    k.monthly += monthlyEquivalent(s.amount_minor, s.frequency);
    const next = nextPaymentFrom(s, today);
    const window = s.frequency === "yearly" || s.frequency === "quarterly" ? 30 : 7;
    if (next <= addDays(today, window)) renewingSoon.push({ subscription: s, date: next });
  }
  const insights: string[] = [];
  const video = byKind.streaming_video;
  if (video && video.count >= 2) insights.push(`Tu as ${video.count} abonnements de streaming vidéo : alterner les services selon les contenus que tu regardes peut réduire la facture.`);
  const music = byKind.streaming_music;
  if (music && music.count >= 2) insights.push(`Tu as ${music.count} abonnements musicaux : un seul suffit généralement.`);
  for (const s of active) {
    if (s.frequency === "monthly" && (s.kind === "software" || s.kind === "cloud")) {
      // Pas de prix annuel inventé : simple suggestion de vérification.
      insights.push(`${s.service} : vérifie s'il existe une offre étudiante ou une formule annuelle moins chère sur le site officiel.`);
    }
  }
  return {
    activeCount: active.length,
    monthlyTotal: monthly,
    annualTotal: annual,
    shareOfIncome: monthlyIncome && monthlyIncome > 0 ? percent(monthly, monthlyIncome) : null,
    renewingSoon: renewingSoon.sort((a, b) => (a.date < b.date ? -1 : 1)),
    byKind,
    insights,
  };
}
