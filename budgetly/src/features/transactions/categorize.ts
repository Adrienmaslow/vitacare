/**
 * Moteur de catégorisation déterministe, par ordre de priorité :
 *   1. règles définies par l'utilisateur ;
 *   2. historique validé (même libellé normalisé déjà catégorisé) ;
 *   3. dictionnaire de commerçants ;
 *   4. expressions de libellés ;
 *   5. sinon : aucune catégorie (jamais de supposition silencieuse).
 */
import type { CategorizationRuleRow, CategoryRow, TransactionRow } from "@/types/db";

export type CategorizationReason = "user_rule" | "history" | "merchant" | "keyword" | "none";

export interface CategorizationResult {
  categorySlug: string | null;
  categoryId: string | null;
  reason: CategorizationReason;
  confidence: "high" | "medium" | "low";
  /** Libellé lisible de la règle appliquée (explicabilité). */
  explanation: string;
  /** Alternative plausible quand le libellé est ambigu (ex. CROUS). */
  alternativeSlug?: string;
}

/** Normalise un libellé bancaire : majuscules, sans accents, sans numéros de carte/dates/références. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(CB|CARTE|PRLV|PRELEVEMENT|SEPA|VIR|VIREMENT|INST|PAIEMENT|ACHAT|FACTURE|RETRAIT|DAB)\b/g, " ")
    .replace(/\b[X*]+\d{3,}\b/g, " ")
    .replace(/\b\d{2}[/.-]\d{2}([/.-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^A-Z0-9 &'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MerchantRule {
  pattern: RegExp;
  slug: string;
  name: string;
  alternativeSlug?: string;
}

/** Correspondances commerçants (enseignes courantes en France). */
export const MERCHANT_RULES: readonly MerchantRule[] = [
  { pattern: /\b(CARREFOUR|LECLERC|AUCHAN|INTERMARCHE|LIDL|ALDI|MONOPRIX|FRANPRIX|CASINO|SUPER U|HYPER U|SYSTEME U|NETTO|BIOCOOP|PICARD|GRAND FRAIS|LEADER PRICE|CORA|NATURALIA|G20|SPAR|COCCINELLE)\b/, slug: "alimentation", name: "Supermarché" },
  { pattern: /\b(SNCF|OUIGO|TGV|TER|RATP|NAVIGO|TRANSILIEN|BLABLACAR|FLIXBUS|TCL|TISSEO|KEOLIS|TRANSDEV|STAR RENNES|TAG GRENOBLE|LIME|DOTT|VELIB|UBER(?! ?EATS)|BOLT|HEETCH|TOTAL ?ENERGIES|ESSO|SHELL|AVIA)\b/, slug: "transport", name: "Transport" },
  { pattern: /\bCROUS\b/, slug: "restaurants", name: "CROUS", alternativeSlug: "etudes" },
  { pattern: /\b(NETFLIX|SPOTIFY|DEEZER|DISNEY|CANAL|PRIME VIDEO|AMAZON PRIME|APPLE\.COM|ICLOUD|GOOGLE ?STORAGE|GOOGLE ONE|YOUTUBE PREMIUM|CRUNCHYROLL|PARAMOUNT|ADOBE|MICROSOFT 365|CHATGPT|OPENAI|NOTION|DROPBOX)\b/, slug: "abonnements", name: "Abonnement numérique" },
  { pattern: /\b(FREE MOBILE|FREE TELECOM|ORANGE|SFR|BOUYGUES|SOSH|RED BY SFR|B AND YOU|PRIXTEL|LA POSTE MOBILE|SYMA)\b/, slug: "telephonie", name: "Opérateur télécom" },
  { pattern: /\b(SALAIRE|PAIE|REMUNERATION|PAYFIT|INTERIM|ADECCO|MANPOWER|RANDSTAD|STUDENTPOP|STAFFME)\b/, slug: "salaire", name: "Rémunération" },
  { pattern: /\b(CAF|ALLOCATION|APL|ALS)\b/, slug: "aides", name: "Prestation sociale" },
  { pattern: /\b(BOURSE|CNOUS)\b/, slug: "bourse", name: "Bourse" },
  { pattern: /\b(LOYER|AGENCE|FONCIA|NEXITY|CITYA|STUDEFI|STUDEA|NEXITY STUDEA|ESTUDINES|SERGIC|EDF|ENGIE|TOTALENERGIES ELEC|EAU)\b/, slug: "logement", name: "Logement & énergie" },
  { pattern: /\b(PHARMACIE|MEDECIN|DOCTOLIB|DENTISTE|MUTUELLE|CPAM|AMELI|LABORATOIRE|OPTICIEN)\b/, slug: "sante", name: "Santé" },
  { pattern: /\b(MCDONALD|MC DO|BURGER KING|KFC|QUICK|SUBWAY|DOMINOS|PIZZA|SUSHI|UBER ?EATS|DELIVEROO|JUST EAT|STARBUCKS|BRIOCHE DOREE|COLUMBUS|RESTAURANT|BRASSERIE|KEBAB|BOULANGERIE)\b/, slug: "restaurants", name: "Restauration" },
  { pattern: /\b(FNAC|DARTY|AMAZON|ZALANDO|H&M|H & M|ZARA|PRIMARK|DECATHLON|KIABI|SHEIN|VINTED|IKEA|ACTION|CDISCOUNT|BOULANGER|UNIQLO|SEPHORA)\b/, slug: "shopping", name: "Shopping" },
  { pattern: /\b(CINEMA|UGC|PATHE|GAUMONT|MK2|FNAC SPECTACLES|TICKETMASTER|STEAM|PLAYSTATION|NINTENDO|BAR|CONCERT|MUSEE|BOWLING|ESCAPE)\b/, slug: "loisirs", name: "Loisirs" },
  { pattern: /\b(MAAF|MACIF|MATMUT|AXA|ALLIANZ|GMF|MAIF|HEYME|LUKO|ASSURANCE|SMERRA|LMDE)\b/, slug: "assurance", name: "Assurance" },
  { pattern: /\b(UNIVERSITE|SCOLARITE|CVEC|INSCRIPTION|LIBRAIRIE|GIBERT|PAPETERIE|BUREAU VALLEE)\b/, slug: "etudes", name: "Études" },
  { pattern: /\b(AIRBNB|BOOKING|EASYJET|RYANAIR|AIR FRANCE|TRANSAVIA|VUELING|HOSTELWORLD|HOTEL)\b/, slug: "voyage", name: "Voyage" },
  { pattern: /\b(FRAIS|COTISATION CARTE|COMMISSION|AGIOS|INTERETS DEBITEURS)\b/, slug: "frais-bancaires", name: "Frais bancaires" },
];

/** Expressions génériques (moins fiables que les commerçants). */
const KEYWORD_RULES: readonly MerchantRule[] = [
  { pattern: /\b(COURSES|MARCHE|EPICERIE|SUPERETTE|PRIMEUR)\b/, slug: "alimentation", name: "mot-clé courses" },
  { pattern: /\b(PARKING|PEAGE|CARBURANT|ESSENCE|TAXI|BUS|METRO|TRAIN)\b/, slug: "transport", name: "mot-clé transport" },
  { pattern: /\b(ABONNEMENT|ABO|MENSUALITE)\b/, slug: "abonnements", name: "mot-clé abonnement" },
  { pattern: /\b(REMBOURSEMENT|REMB)\b/, slug: "revenus-autres", name: "mot-clé remboursement" },
];

export interface CategorizeContext {
  rules: CategorizationRuleRow[];
  categories: CategoryRow[];
  /** Transactions déjà catégorisées par l'utilisateur (historique validé). */
  history: Pick<TransactionRow, "label" | "category_id" | "source">[];
}

export function matchesRule(rule: Pick<CategorizationRuleRow, "pattern" | "match_type">, normalized: string): boolean {
  const p = normalizeLabel(rule.pattern);
  if (!p) return false;
  switch (rule.match_type) {
    case "exact":
      return normalized === p;
    case "starts_with":
      return normalized.startsWith(p);
    case "contains":
      return normalized.includes(p);
  }
}

/** Construit un index d'historique : libellé normalisé → catégorie la plus fréquente. */
export function buildHistoryIndex(history: CategorizeContext["history"]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const t of history) {
    if (!t.category_id) continue;
    const key = normalizeLabel(t.label);
    if (!key) continue;
    const m = counts.get(key) ?? new Map<string, number>();
    m.set(t.category_id, (m.get(t.category_id) ?? 0) + 1);
    counts.set(key, m);
  }
  const out = new Map<string, string>();
  for (const [k, m] of counts) {
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]);
    // Historique ambigu (égalité) : on ne tranche pas.
    if (sorted.length > 1 && sorted[0]![1] === sorted[1]![1]) continue;
    out.set(k, sorted[0]![0]);
  }
  return out;
}

export function createCategorizer(ctx: CategorizeContext) {
  const bySlug = new Map(ctx.categories.map((c) => [c.slug, c]));
  const byId = new Map(ctx.categories.map((c) => [c.id, c]));
  const rules = [...ctx.rules].sort((a, b) => a.priority - b.priority);
  const historyIndex = buildHistoryIndex(ctx.history);

  return function categorize(label: string, type: "income" | "expense"): CategorizationResult {
    const normalized = normalizeLabel(label);
    const compatible = (slug: string | undefined) => {
      const c = slug ? bySlug.get(slug) : undefined;
      return !!c && (c.kind === "both" || c.kind === type);
    };

    for (const r of rules) {
      const c = byId.get(r.category_id);
      if (c && matchesRule(r, normalized)) {
        return { categorySlug: c.slug, categoryId: c.id, reason: "user_rule", confidence: "high", explanation: `Règle personnelle « ${r.pattern} »` };
      }
    }

    const hist = historyIndex.get(normalized);
    if (hist) {
      const c = byId.get(hist);
      if (c && (c.kind === "both" || c.kind === type)) {
        return { categorySlug: c.slug, categoryId: c.id, reason: "history", confidence: "high", explanation: "Libellé déjà catégorisé par toi" };
      }
    }

    for (const m of MERCHANT_RULES) {
      if (m.pattern.test(normalized) && compatible(m.slug)) {
        const c = bySlug.get(m.slug)!;
        return {
          categorySlug: c.slug, categoryId: c.id, reason: "merchant",
          confidence: m.alternativeSlug ? "medium" : "high",
          explanation: `Commerçant reconnu (${m.name})`,
          alternativeSlug: m.alternativeSlug,
        };
      }
    }

    for (const k of KEYWORD_RULES) {
      if (k.pattern.test(normalized) && compatible(k.slug)) {
        const c = bySlug.get(k.slug)!;
        return { categorySlug: c.slug, categoryId: c.id, reason: "keyword", confidence: "low", explanation: `Expression reconnue (${k.name})` };
      }
    }

    return { categorySlug: null, categoryId: null, reason: "none", confidence: "low", explanation: "Aucune règle ne correspond : à catégoriser" };
  };
}
