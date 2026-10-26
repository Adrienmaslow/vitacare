/**
 * Budgetly Coach — niveau 1, sans IA : détection d'intention par règles,
 * puis réponse construite UNIQUEMENT à partir de calculs déterministes.
 * Chaque réponse distingue faits (calculés), estimations et hypothèses.
 */
import { AIDS } from "@/data/aids";
import { addDays, addMonths, diffDays, endOfMonth, fmt, startOfMonth, startOfWeek } from "@/lib/dates";
import { ceilTo, formatMoney, mulDiv, parseAmount } from "@/lib/money";
import type { Minor } from "@/types/db";
import { evaluateAid, factsFromProfile } from "../aids/eligibility";
import { kpis, monthlySeries } from "../analytics/service";
import { budgetStatuses, spentByCategory } from "../budgets/service";
import { accountBalances, totals } from "../finance/balances";
import type { FinancialSnapshot } from "../finance/snapshot";
import { forecast } from "../forecasts/engine";
import { goalProgress } from "../goals/service";
import { summarizeSubscriptions } from "../subscriptions/service";

export type CoachIntent =
  | "spend_capacity" | "why_spent" | "can_afford" | "save_target" | "subscriptions" | "aids"
  | "extra_income" | "overdraft" | "goal_plan" | "balance" | "help";

export interface CoachFact {
  label: string;
  value: string;
  kind: "fact" | "estimate";
}

export interface CoachAnswer {
  intent: CoachIntent;
  paragraphs: string[];
  facts: CoachFact[];
  assumptions: string[];
  actions: { label: string; href: string }[];
  sources: string[];
}

const N = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function detectIntent(question: string): CoachIntent {
  const q = N(question);
  if (/pourquoi|explique|autant depense|trop depense/.test(q)) return "why_spent";
  if (/economis\w* \d|mettre de cote \d|epargner \d|\d+ ?(€|euros?) en \d+ ?mois/.test(q)) return "save_target";
  if (/(acheter|achat|me payer|m'offrir|offrir|puis-je|est-ce que je peux|je peux).*(\d)/.test(q)) return "can_afford";
  if (/abonnement|streaming|netflix|spotify/.test(q)) return "subscriptions";
  if (/aide|bourse|apl|caf|crous|allocation/.test(q)) return "aids";
  if (/job|mission|revenu|travaill|gagner|complement/.test(q)) return "extra_income";
  if (/decouvert|negatif|fin de mois|finir le mois/.test(q)) return "overdraft";
  if (/objectif|plan|projet/.test(q)) return "goal_plan";
  if (/(combien|que) .*(depenser|reste)|reste a vivre|budget (de la |cette )?semaine/.test(q)) return "spend_capacity";
  if (/solde|combien (j'ai|ai-je)|mon argent/.test(q)) return "balance";
  return "help";
}

/** Extrait le premier montant en euros (« 700 € », « 300 euros », « 1 200€ »). */
export function extractAmount(question: string): Minor | null {
  const m = /(\d[\d\s.,]*)\s*(€|euros?|eur\b)/i.exec(question) ?? /(\d{2,}[\d\s.,]*)/.exec(question);
  if (!m) return null;
  const v = parseAmount(m[1]!.trim().replace(/\s+/g, " "));
  return v && v > 0 ? v : null;
}

export function extractMonths(question: string): number | null {
  const q = N(question);
  const m = /(\d+)\s*mois/.exec(q);
  if (m) return Number(m[1]);
  const words: Record<string, number> = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12 };
  const w = /\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\s+mois/.exec(q);
  if (w) return words[w[1]!]!;
  if (/\bun an\b|\b12 mois\b/.test(q)) return 12;
  return null;
}

export function answer(question: string, s: FinancialSnapshot): CoachAnswer {
  const intent = detectIntent(question);
  const t = totals(accountBalances(s.accounts, s.transactions, s.today));
  const eom = endOfMonth(s.today);
  const daysLeft = Math.max(1, diffDays(eom, s.today));
  const noData: CoachAnswer = {
    intent, paragraphs: ["Je n'ai pas encore assez de données pour te répondre précisément. Ajoute un compte et quelques opérations (ou importe un relevé CSV) : mes réponses seront calculées à partir de tes vrais chiffres."],
    facts: [], assumptions: [], actions: [{ label: "Ajouter un compte", href: "/app/accounts" }, { label: "Importer un relevé", href: "/app/import" }], sources: ["Tes données BUDGETLY"],
  };
  if (!s.accounts.length && intent !== "help" && intent !== "aids") return noData;
  const f = s.accounts.length ? forecast(s, daysLeft) : null;
  const fmtE = (v: Minor) => formatMoney(v);

  switch (intent) {
    case "balance": {
      return {
        intent,
        paragraphs: [`Ton solde disponible (comptes courants, opérations en attente incluses) est de ${fmtE(t.available)}. En comptant l'épargne, ton solde total est de ${fmtE(t.total)}.`],
        facts: [
          { label: "Solde disponible", value: fmtE(t.available), kind: "fact" },
          { label: "Épargne", value: fmtE(t.savings), kind: "fact" },
          { label: "En attente", value: fmtE(t.pending), kind: "fact" },
        ],
        assumptions: [], actions: [{ label: "Mon argent", href: "/app/accounts" }], sources: ["Tes comptes et opérations"],
      };
    }
    case "spend_capacity": {
      const weekEnd = addDays(startOfWeek(s.today), 6);
      const daysWeek = Math.max(1, diffDays(weekEnd, s.today) + 1);
      const free = f!.startingBalance + f!.expectedIncome - f!.scheduledExpenses - f!.safetyThreshold;
      const perDay = Math.max(0, mulDiv(free, 1, daysLeft));
      return {
        intent,
        paragraphs: [
          free > 0
            ? `Pour finir le mois en gardant ton seuil de sécurité de ${fmtE(f!.safetyThreshold)}, tu peux dépenser environ ${fmtE(perDay)} par jour, soit ${fmtE(perDay * Math.min(daysWeek, daysLeft))} d'ici dimanche.`
            : `Tes charges prévues d'ici la fin du mois dépassent déjà ce qui reste au-dessus de ton seuil de sécurité. Je te conseille de limiter les dépenses non essentielles et de consulter ton plan d'action.`,
        ],
        facts: [
          { label: "Solde disponible", value: fmtE(f!.startingBalance), kind: "fact" },
          { label: "Revenus récurrents attendus d'ici fin de mois", value: fmtE(f!.expectedIncome), kind: "fact" },
          { label: "Charges prévues d'ici fin de mois", value: fmtE(f!.scheduledExpenses), kind: "fact" },
          { label: "Montant dépensable par jour", value: fmtE(perDay), kind: "estimate" },
        ],
        assumptions: [`${daysLeft} jours restants dans le mois.`, "Seuls les revenus récurrents déclarés sont comptés.", "Le seuil de sécurité est conservé intact."],
        actions: [{ label: "Voir mes prévisions", href: "/app/forecast" }, { label: "Mes budgets", href: "/app/budgets" }],
        sources: ["Prévision BUDGETLY"],
      };
    }
    case "why_spent": {
      const cur = startOfMonth(s.today);
      const now = spentByCategory(s.transactions, cur, s.today);
      const past = [1, 2, 3].map((i) => addMonths(cur, -i));
      const avg = new Map<string | null, Minor>();
      for (const m of past) for (const [k, v] of spentByCategory(s.transactions, m, endOfMonth(m))) avg.set(k, (avg.get(k) ?? 0) + v);
      const elapsedRatio = [Number(s.today.slice(8, 10)), Number(eom.slice(8, 10))] as const;
      const cats = new Map(s.categories.map((c) => [c.id, c.name]));
      const diffs = [...now.entries()].map(([k, v]) => {
        const ref = mulDiv(mulDiv(avg.get(k) ?? 0, 1, 3), elapsedRatio[0], elapsedRatio[1]);
        return { name: k ? cats.get(k) ?? "Autre" : "Non catégorisé", now: v, ref, delta: v - ref };
      }).sort((a, b) => b.delta - a.delta);
      const top = diffs.filter((d) => d.delta > 0).slice(0, 3);
      return {
        intent,
        paragraphs: top.length
          ? [`Par rapport à ta moyenne des 3 derniers mois (ramenée à la même date), tes dépenses augmentent surtout en : ${top.map((d) => `${d.name} (+${fmtE(d.delta)})`).join(", ")}.`]
          : ["Ce mois-ci, tes dépenses ne sont pas au-dessus de ta moyenne des 3 derniers mois à date équivalente."],
        facts: top.map((d) => ({ label: d.name, value: `${fmtE(d.now)} (moyenne à date : ${fmtE(d.ref)})`, kind: "fact" as const })),
        assumptions: ["Comparaison au prorata des jours écoulés du mois.", "Transferts entre comptes exclus."],
        actions: [{ label: "Voir les analyses", href: "/app/analytics" }],
        sources: ["Tes opérations"],
      };
    }
    case "can_afford": {
      const price = extractAmount(question);
      if (!price) return { ...noData, intent, paragraphs: ["Indique-moi le montant de l'achat, par exemple : « Est-ce que je peux acheter un ordinateur à 700 € ? »"], actions: [] };
      const endBal = f!.endBalance.realistic;
      const afterBuy = endBal - price;
      const ok = afterBuy >= f!.safetyThreshold;
      const k = kpis(s, t.available);
      const capacity = k.savingCapacity;
      const months = capacity && capacity > 0 ? Math.ceil((price - Math.max(0, endBal - f!.safetyThreshold)) / capacity) : null;
      return {
        intent,
        paragraphs: [
          ok
            ? `Oui, a priori : d'après la prévision réaliste, il te resterait ${fmtE(afterBuy)} en fin de mois après cet achat, au-dessus de ton seuil de sécurité.`
            : `Ce n'est pas recommandé ce mois-ci : après cet achat, ton solde de fin de mois estimé serait de ${fmtE(afterBuy)}, sous ton seuil de sécurité de ${fmtE(f!.safetyThreshold)}.`,
          !ok && months !== null ? `Avec ta capacité d'épargne moyenne (${fmtE(capacity!)} / mois), tu pourrais le financer en environ ${months} mois. Tu peux en faire un objectif d'épargne.` : "",
          t.savings > price && !ok ? `Ton épargne (${fmtE(t.savings)}) le permettrait, mais elle sert aussi d'amortisseur en cas d'imprévu : à toi de décider.` : "",
        ].filter(Boolean),
        facts: [
          { label: "Prix", value: fmtE(price), kind: "fact" },
          { label: "Solde estimé fin de mois (sans l'achat)", value: fmtE(endBal), kind: "estimate" },
          { label: "Après l'achat", value: fmtE(afterBuy), kind: "estimate" },
        ],
        assumptions: f!.assumptions.slice(0, 3),
        actions: [{ label: "Créer un objectif", href: `/app/goals?new=custom&amount=${price}` }, { label: "Simuler", href: "/app/simulator" }],
        sources: ["Prévision BUDGETLY"],
      };
    }
    case "save_target": {
      const target = extractAmount(question) ?? 0;
      const months = extractMonths(question) ?? 3;
      const monthly = ceilTo(mulDiv(target, 1, months), 100);
      const k = kpis(s, t.available);
      const nonEssentialIds = new Set(s.categories.filter((c) => !c.is_essential && c.kind !== "income").map((c) => c.id));
      const series = monthlySeries(s, 4).slice(0, 3);
      let nonEss = 0;
      for (const m of series) for (const [cat, v] of spentByCategory(s.transactions, m.month, endOfMonth(m.month))) if (cat && nonEssentialIds.has(cat)) nonEss += v;
      const cut = mulDiv(mulDiv(nonEss, 1, 3), 15, 100);
      const cap = Math.max(0, k.savingCapacity ?? 0);
      const gap = Math.max(0, monthly - cap - cut);
      return {
        intent,
        paragraphs: [
          `Pour économiser ${fmtE(target)} en ${months} mois, il faut mettre de côté ${fmtE(monthly)} par mois.`,
          `Leviers identifiés : ta capacité d'épargne moyenne (${fmtE(cap)} / mois) et une réduction de 15 % de tes dépenses non essentielles (≈ ${fmtE(cut)} / mois).`,
          gap > 0 ? `Il manquerait environ ${fmtE(gap)} par mois : un revenu complémentaire ou un délai plus long serait nécessaire.` : "Ces leviers suffisent a priori à atteindre ton objectif.",
        ],
        facts: [
          { label: "Effort mensuel nécessaire", value: fmtE(monthly), kind: "fact" },
          { label: "Capacité d'épargne moyenne", value: fmtE(cap), kind: "estimate" },
          { label: "Réduction possible (15 % non essentiel)", value: fmtE(cut), kind: "estimate" },
        ],
        assumptions: ["Capacité = revenus moyens − dépenses moyennes des 3 derniers mois complets.", "Les dépenses essentielles ne sont jamais réduites."],
        actions: [{ label: "Créer cet objectif", href: `/app/goals?new=custom&amount=${target}` }, { label: "Simuler", href: "/app/simulator" }],
        sources: ["Tes opérations"],
      };
    }
    case "subscriptions": {
      const sum = summarizeSubscriptions(s.subscriptions, s.today, s.profile?.monthly_income_minor ?? null);
      return {
        intent,
        paragraphs: [
          sum.activeCount ? `Tu as ${sum.activeCount} abonnement(s) actif(s) pour ${fmtE(sum.monthlyTotal)} par mois, soit ${fmtE(sum.annualTotal)} par an.` : "Tu n'as déclaré aucun abonnement actif.",
          ...sum.insights.slice(0, 3),
        ],
        facts: [
          { label: "Coût mensuel", value: fmtE(sum.monthlyTotal), kind: "fact" },
          { label: "Coût annuel", value: fmtE(sum.annualTotal), kind: "fact" },
          ...(sum.shareOfIncome !== null ? [{ label: "Part des revenus", value: `${sum.shareOfIncome} %`, kind: "fact" as const }] : []),
        ],
        assumptions: ["Coûts mensuels équivalents calculés à partir de la fréquence de chaque abonnement."],
        actions: [{ label: "Mes abonnements", href: "/app/subscriptions" }, { label: "Bons plans", href: "/app/deals" }],
        sources: ["Tes abonnements déclarés"],
      };
    }
    case "aids": {
      const facts = factsFromProfile(s.profile);
      const results = AIDS.filter((a) => !a.isTool).map((a) => ({ a, r: evaluateAid(a, facts) }));
      const pot = results.filter((x) => x.r.status === "potential");
      const unk = results.filter((x) => x.r.status === "unknown");
      return {
        intent,
        paragraphs: [
          pot.length ? `D'après ton profil, il serait utile de vérifier : ${pot.map((x) => x.a.name).join(", ")}.` : "Aucune aide ne ressort comme potentiellement éligible avec les informations actuelles.",
          unk.length ? `${unk.length} autre(s) aide(s) nécessitent plus d'informations sur ton profil.` : "",
          "Seul l'organisme officiel peut confirmer ton éligibilité ; les montants ne sont jamais ajoutés à ton solde.",
        ].filter(Boolean),
        facts: pot.map((x) => ({ label: x.a.name, value: "Potentiellement éligible", kind: "estimate" as const })),
        assumptions: ["Estimation fondée sur les critères connus du catalogue BUDGETLY (liens et conditions à vérifier sur les sites officiels)."],
        actions: [{ label: "Mes aides", href: "/app/aids" }],
        sources: pot.map((x) => `${x.a.source.provider} — ${x.a.source.url}`),
      };
    }
    case "extra_income": {
      const a = s.availability;
      return {
        intent,
        paragraphs: [
          s.preferences?.opportunities_enabled
            ? a?.hours_per_week ? `Tu as indiqué ${a.hours_per_week} h disponibles par semaine. Dans l'espace « Gagner de l'argent », les offres des sources connectées sont triées selon ta compatibilité (disponibilités, localisation, compétences, rémunération).` : "Renseigne tes disponibilités dans « Gagner de l'argent » pour obtenir des suggestions adaptées."
            : "Active la recherche d'opportunités dans tes paramètres : BUDGETLY utilisera alors tes disponibilités pour trier les offres des sources connectées.",
          "Un revenu complémentaire n'est jamais intégré à tes prévisions tant qu'il n'est pas réellement perçu. Pense aussi à l'effet possible sur certaines aides et à préserver le temps consacré à tes études.",
        ],
        facts: [],
        assumptions: [],
        actions: [{ label: "Gagner de l'argent", href: "/app/earn" }],
        sources: ["Fournisseurs d'offres connectés"],
      };
    }
    case "overdraft": {
      const r = f!;
      return {
        intent,
        paragraphs: [
          r.overdraftDate ? `Attention : la prévision réaliste passe sous 0 € vers le ${fmt.day(r.overdraftDate)}.` : r.overdraftDatePessimistic ? `Le scénario réaliste reste positif, mais le scénario pessimiste passe sous 0 € vers le ${fmt.day(r.overdraftDatePessimistic)}.` : `Aucun découvert n'est prévu d'ici la fin du mois, même dans le scénario pessimiste (minimum : ${fmtE(r.minBalance.pessimistic.value)}).`,
          r.overdraftDate ? "Ton plan d'action te propose un plafond de dépenses quotidien et d'autres leviers concrets." : "Continue à enregistrer tes dépenses pour garder une prévision fiable.",
        ],
        facts: [
          { label: "Solde estimé fin de mois (réaliste)", value: fmtE(r.endBalance.realistic), kind: "estimate" },
          { label: "Point bas (réaliste)", value: `${fmtE(r.minBalance.realistic.value)} le ${fmt.day(r.minBalance.realistic.date)}`, kind: "estimate" },
        ],
        assumptions: r.assumptions,
        actions: [{ label: "Mon plan d'action", href: "/app/action-plan" }, { label: "Prévisions", href: "/app/forecast" }],
        sources: ["Prévision BUDGETLY"],
      };
    }
    case "goal_plan": {
      const goals = s.goals.filter((g) => g.status === "active").map((g) => goalProgress(g, s.allocations, s.today));
      return {
        intent,
        paragraphs: goals.length
          ? goals.map((g) => `« ${g.goal.name} » : ${g.percent} % atteint, il manque ${fmtE(g.missing)}${g.requiredMonthly !== null ? `, soit ${fmtE(g.requiredMonthly)} par mois pour tenir ta date` : ""}.`)
          : ["Tu n'as pas encore d'objectif d'épargne. Crée-en un : BUDGETLY te proposera plusieurs stratégies (épargne, économies, revenus complémentaires)."],
        facts: goals.map((g) => ({ label: g.goal.name, value: `${fmtE(g.allocated)} / ${fmtE(g.goal.target_minor)}`, kind: "fact" as const })),
        assumptions: ["Versement mensuel nécessaire = montant manquant ÷ mois restants, arrondi à l'euro supérieur."],
        actions: [{ label: "Mes objectifs", href: "/app/goals" }],
        sources: ["Tes objectifs"],
      };
    }
    case "help":
    default: {
      const statuses = budgetStatuses(s.budgets, s.categories, s.transactions, startOfMonth(s.today), s.today);
      return {
        intent: "help",
        paragraphs: [
          "Je suis Budgetly Coach. Je réponds à partir de tes vraies données et je t'indique toujours mes hypothèses. Essaie par exemple :",
          "• « Combien puis-je encore dépenser cette semaine ? »\n• « Pourquoi ai-je autant dépensé ce mois-ci ? »\n• « Est-ce que je peux acheter un ordinateur à 700 € ? »\n• « Comment économiser 300 € en deux mois ? »\n• « Quelles aides devrais-je vérifier ? »\n• « Comment éviter d'être à découvert ? »",
        ],
        facts: statuses.length ? [{ label: "Budgets suivis ce mois", value: String(statuses.length), kind: "fact" }] : [],
        assumptions: [], actions: [], sources: [],
      };
    }
  }
}
