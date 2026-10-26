/**
 * Arithmétique monétaire exacte.
 * Tous les montants sont des entiers en unités mineures (centimes). Aucun calcul
 * monétaire n'utilise de flottant : les conversions texte → centimes se font
 * par manipulation de chaînes, et les divisions utilisent un arrondi explicite
 * (demi-unité éloignée de zéro), documenté dans docs/FINANCIAL_CALCULATIONS.md.
 */
import type { Minor } from "@/types/db";

export const MAX_AMOUNT_MINOR = 99_999_999_999; // < 1 milliard d'euros, aligné sur la contrainte SQL

export function assertMinor(value: number, label = "montant"): Minor {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} invalide : doit être un entier en centimes`);
  return value;
}

export function sum(values: readonly Minor[]): Minor {
  let total = 0;
  for (const v of values) total += v;
  return assertMinor(total, "somme");
}

/**
 * Multiplie un montant par num/den avec arrondi à la demi-unité éloignée de zéro.
 * Calcul entièrement en BigInt pour éviter toute erreur de flottant.
 */
export function mulDiv(amount: Minor, num: number, den: number): Minor {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) throw new Error("mulDiv : facteurs entiers requis");
  const a = BigInt(amount) * BigInt(num);
  const d = BigInt(den);
  const negative = (a < 0n) !== (d < 0n);
  const absA = a < 0n ? -a : a;
  const absD = d < 0n ? -d : d;
  let q = absA / absD;
  const r = absA % absD;
  if (r * 2n >= absD) q += 1n;
  return assertMinor(Number(negative ? -q : q), "résultat");
}

/** Pourcentage entier (pour affichage) : part/total × 100, arrondi. 0 si total nul. */
export function percent(part: Minor, total: Minor): number {
  if (total === 0) return 0;
  return mulDiv(part, 100, total);
}

/** Arrondit au multiple de step centimes le plus proche (ex. 500 = 5 €). */
export function roundTo(amount: Minor, step: Minor): Minor {
  return mulDiv(amount, 1, step) * step;
}

/** Arrondit au multiple supérieur de step. */
export function ceilTo(amount: Minor, step: Minor): Minor {
  if (amount <= 0) return 0;
  return Math.ceil(amount / step) * step; // amount et step entiers : quotient exact puis ceil sûr
}

const AMOUNT_RE = /^([+-])?(\d{1,3}(?:[ .  ']\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;
const AMOUNT_RE_COMMA_THOUSANDS = /^([+-])?(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;

/**
 * Convertit une saisie ou une cellule CSV en centimes.
 * Accepte : "12", "12,5", "12.50", "-1 234,56", "1.234,56", "1,234.56", "12,50 €", "€12.50", "(12,00)".
 * Retourne null si la valeur n'est pas un montant non ambigu.
 */
export function parseAmount(raw: string | number | null | undefined): Minor | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    raw = raw.toFixed(2);
  }
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/(EUR|€|eur)/g, "").trim();
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(/^([+-])\s+/, "$1");
  let m = AMOUNT_RE.exec(s);
  let intPart: string;
  let frac = "";
  let sign: string | undefined;
  if (m) {
    sign = m[1];
    intPart = m[2]!.replace(/[ .  ']/g, "");
    frac = m[3] ?? "";
  } else {
    m = AMOUNT_RE_COMMA_THOUSANDS.exec(s);
    if (!m) return null;
    // "12,345" est ambigu (12,345 € ou 12 345 €) : on refuse plutôt que de deviner.
    if (!m[3] && (m[2]!.match(/,/g) ?? []).length === 1) return null;
    sign = m[1];
    intPart = m[2]!.replace(/,/g, "");
    frac = m[3] ?? "";
  }
  if (sign === "-") negative = !negative;
  const cents = BigInt(intPart) * 100n + BigInt((frac + "00").slice(0, 2));
  if (cents > BigInt(MAX_AMOUNT_MINOR)) return null;
  const n = Number(cents);
  return negative ? -n : n;
}

/** Conversion d'un nombre décimal saisi dans un formulaire (ex. input type=number) — passe par la chaîne. */
export function toMinor(value: string | number): Minor {
  const parsed = parseAmount(value);
  if (parsed === null) throw new Error("Montant invalide");
  return parsed;
}

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, compact: boolean, signDisplay: "auto" | "always" | "exceptZero") {
  const key = `${currency}|${compact}|${signDisplay}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 0 : 2,
      signDisplay,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Formate des centimes (affichage uniquement ; la division par 100 est exacte en représentation décimale du format). */
export function formatMoney(
  amount: Minor,
  opts: { currency?: string; compact?: boolean; sign?: boolean } = {},
): string {
  const { currency = "EUR", compact = false, sign = false } = opts;
  const value = compact ? Math.round(amount / 100) : amount / 100;
  return formatter(currency, compact, sign ? "exceptZero" : "auto").format(value).replace(/ /g, " ");
}

/** Valeur décimale pour pré-remplir un champ de formulaire ("12.50"). */
export function minorToInput(amount: Minor | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const s = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}
