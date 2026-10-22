import { normalizeSuperscripts, parseUnit, sameDim, describeDim, type ParsedUnit } from './units';
import type { ErrorCategory, NumericAnswer } from '@/types';

export interface ParsedQuantity {
  value: number;
  unitText: string;
  unit: ParsedUnit | null;
}

/**
 * Lit un nombre saisi par un étudiant français :
 * « 0,26 », « 1.845 », « 1 424 », « 1,66e20 », « 1,66·10^20 », « 1,66 × 10⁻¹⁹ », « 10^20 »…
 * Retourne aussi le reste de la chaîne (l'unité).
 */
export function parseQuantity(raw: string): ParsedQuantity | null {
  let s = normalizeSuperscripts(raw.trim())
    .replace(/[−–]/g, '-')
    .replace(/\u00a0|\u202f/g, ' ');
  if (!s) return null;

  // « 10^20 » ou « 10^-3 m » sans mantisse
  const pow10Only = /^([+-]?)10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?/.exec(s);
  let mantissa: number;
  let exponent = 0;
  let rest: string;
  if (pow10Only) {
    mantissa = pow10Only[1] === '-' ? -1 : 1;
    exponent = Number(pow10Only[2]);
    rest = s.slice(pow10Only[0].length);
  } else {
    // Mantisse : chiffres avec séparateurs de milliers (espaces) et décimale , ou .
    const mm = /^([+-]?)\s*(\d{1,3}(?:[ ]\d{3})+|\d+)?(?:[.,](\d+))?/.exec(s);
    if (!mm || (mm[2] === undefined && mm[3] === undefined)) return null;
    const intPart = (mm[2] ?? '0').replace(/ /g, '');
    const fracPart = mm[3] ?? '';
    mantissa = Number(`${intPart}.${fracPart || '0'}`) * (mm[1] === '-' ? -1 : 1);
    s = s.slice(mm[0].length);
    const em = /^\s*[eE]\s*([+-]?\d+)/.exec(s);
    const tm = /^\s*(?:[x×*·⋅.]|\s)\s*10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?/.exec(s);
    if (em) {
      exponent = Number(em[1]);
      s = s.slice(em[0].length);
    } else if (tm) {
      exponent = Number(tm[1]);
      s = s.slice(tm[0].length);
    }
    rest = s;
  }
  const value = mantissa * 10 ** exponent;
  if (!Number.isFinite(value)) return null;
  const unitText = rest.trim();
  return { value, unitText, unit: parseUnit(unitText) };
}

export interface NumericCheck {
  correct: boolean;
  feedback: string;
  category: ErrorCategory | null;
  /** Valeur saisie exprimée dans l'unité attendue (si convertible). */
  givenInExpected: number | null;
}

function relClose(a: number, b: number, tol: number): boolean {
  if (b === 0) return Math.abs(a) <= tol;
  return Math.abs(a - b) <= tol * Math.abs(b);
}

export function formatNumber(v: number, digits = 3): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e-3 && abs < 1e5) {
    return Number(v.toPrecision(digits)).toLocaleString('fr-FR', { maximumFractionDigits: 6 });
  }
  const exp = Math.floor(Math.log10(abs));
  const man = v / 10 ** exp;
  return `${Number(man.toPrecision(digits)).toLocaleString('fr-FR')}·10^${exp}`;
}

const SUP: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** Remplace « ^-7 » par « ⁻⁷ » pour l'affichage. */
export function prettyExp(s: string): string {
  return s.replace(/\^(-?\d+)/g, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(''));
}

export function formatPretty(v: number, digits = 3): string {
  return prettyExp(formatNumber(v, digits));
}

export function formatAnswer(a: NumericAnswer): string {
  return `${formatPretty(a.value)}${a.unit ? ` ${prettyExp(a.unit).replace(/\./g, '·')}` : ''}`;
}

/**
 * Compare une saisie à la réponse attendue :
 * - conversion des préfixes et unités équivalentes (0,26 Ω ≡ 260 mΩ),
 * - vérification dimensionnelle,
 * - tolérance relative,
 * - détection prudente de deux erreurs reconnaissables (facteur 10^k, signe).
 */
export function checkNumeric(input: string, expected: NumericAnswer): NumericCheck {
  const q = parseQuantity(input);
  if (!q) {
    return {
      correct: false,
      feedback: 'Réponse illisible : saisis un nombre (ex. « 0,26 Ω » ou « 1,6e-19 C »).',
      category: null,
      givenInExpected: null,
    };
  }
  const exp = parseUnit(expected.unit);
  if (!exp) throw new Error(`Unité attendue invalide dans le contenu : « ${expected.unit} »`);

  let siValue: number;
  if (q.unitText === '') {
    if (expected.unitRequired && expected.unit !== '') {
      const asIfExpected = q.value;
      const valueOk = relClose(asIfExpected, expected.value, expected.tolerance);
      return {
        correct: false,
        feedback: valueOk
          ? `La valeur est bonne, mais l'unité manque : précise-la (attendu en ${expected.unit} ou équivalent).`
          : `Unité manquante : précise l'unité de ton résultat.`,
        category: 'unites',
        givenInExpected: asIfExpected,
      };
    }
    siValue = q.value * exp.factor;
  } else {
    if (!q.unit) {
      return {
        correct: false,
        feedback: `Unité « ${q.unitText} » non reconnue. Exemples acceptés : Ω, mΩ, S/m, cm^-3, m/s, µC/m^2.`,
        category: null,
        givenInExpected: null,
      };
    }
    if (!sameDim(q.unit.dim, exp.dim)) {
      return {
        correct: false,
        feedback: `Unité incohérente : « ${q.unitText} » (${describeDim(q.unit.dim)}) n'est pas homogène à « ${expected.unit} » (${describeDim(exp.dim)}).`,
        category: 'unites',
        givenInExpected: null,
      };
    }
    siValue = q.value * q.unit.factor;
  }

  const given = siValue / exp.factor;
  if (relClose(given, expected.value, expected.tolerance)) {
    return { correct: true, feedback: 'Résultat correct.', category: null, givenInExpected: given };
  }
  if (relClose(-given, expected.value, expected.tolerance)) {
    return {
      correct: false,
      feedback: 'La valeur absolue est bonne mais le signe est faux.',
      category: 'signe',
      givenInExpected: given,
    };
  }
  if (given !== 0 && expected.value !== 0) {
    const ratio = given / expected.value;
    const k = Math.round(Math.log10(Math.abs(ratio)));
    if (k !== 0 && ratio > 0 && relClose(ratio, 10 ** k, expected.tolerance)) {
      return {
        correct: false,
        feedback: `Écart d'un facteur 10^${k} : vérifie tes conversions d'unités (cm ↔ m, mm² ↔ m², préfixes).`,
        category: 'unites',
        givenInExpected: given,
      };
    }
  }
  return {
    correct: false,
    feedback: 'Valeur incorrecte.',
    category: null,
    givenInExpected: given,
  };
}
