/**
 * Moteur d'unités : analyse d'expressions comme « mΩ », « S/m », « cm²/(V·s) », « m^-3 »,
 * conversion vers le SI et vérification dimensionnelle.
 *
 * Dimension = exposants de (m, kg, s, A, K, mol).
 */

export type Dim = readonly [number, number, number, number, number, number];

export interface ParsedUnit {
  /** Facteur multiplicatif vers le SI. */
  factor: number;
  dim: Dim;
}

const ZERO: Dim = [0, 0, 0, 0, 0, 0];

const d = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0): Dim => [m, kg, s, A, K, mol];

/** Unités reconnues (symbole → facteur SI + dimension). */
const UNITS: Record<string, ParsedUnit> = {
  m: { factor: 1, dim: d(1) },
  g: { factor: 1e-3, dim: d(0, 1) },
  s: { factor: 1, dim: d(0, 0, 1) },
  A: { factor: 1, dim: d(0, 0, 0, 1) },
  K: { factor: 1, dim: d(0, 0, 0, 0, 1) },
  mol: { factor: 1, dim: d(0, 0, 0, 0, 0, 1) },
  Hz: { factor: 1, dim: d(0, 0, -1) },
  N: { factor: 1, dim: d(1, 1, -2) },
  J: { factor: 1, dim: d(2, 1, -2) },
  eV: { factor: 1.602176634e-19, dim: d(2, 1, -2) },
  W: { factor: 1, dim: d(2, 1, -3) },
  C: { factor: 1, dim: d(0, 0, 1, 1) },
  V: { factor: 1, dim: d(2, 1, -3, -1) },
  Ω: { factor: 1, dim: d(2, 1, -3, -2) },
  S: { factor: 1, dim: d(-2, -1, 3, 2) },
  F: { factor: 1, dim: d(-2, -1, 4, 2) },
  H: { factor: 1, dim: d(2, 1, -2, -2) },
  T: { factor: 1, dim: d(0, 1, -2, -1) },
  ppm: { factor: 1e-6, dim: ZERO },
  '%': { factor: 1e-2, dim: ZERO },
};

/** Alias textuels (en minuscules ou exacts). */
const ALIASES: Record<string, string> = {
  ohm: 'Ω',
  ohms: 'Ω',
  Ohm: 'Ω',
  Ohms: 'Ω',
  'Ω': 'Ω', // U+2126 (signe ohm) → U+03A9
  mho: 'S',
  siemens: 'S',
  volt: 'V',
  volts: 'V',
  farad: 'F',
  ampère: 'A',
  ampere: 'A',
  sec: 's',
  seconde: 's',
  secondes: 's',
};

/** Mots de comptage ignorés (grandeurs sans dimension). */
const COUNT_WORDS = new Set([
  'électrons',
  'électron',
  'electrons',
  'electron',
  'e-',
  'e⁻',
  'atomes',
  'atome',
  'paires',
  'porteurs',
  'trous',
]);

const PREFIXES: Record<string, number> = {
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 1e1,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  µ: 1e-6,
  μ: 1e-6,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
};

export function normalizeSuperscripts(input: string): string {
  let out = '';
  let inSup = false;
  for (const ch of input) {
    const mapped = SUPERSCRIPTS[ch];
    if (mapped !== undefined) {
      if (!inSup) {
        out += '^';
        inSup = true;
      }
      out += mapped;
    } else {
      inSup = false;
      out += ch;
    }
  }
  return out;
}

function mulDim(a: Dim, b: Dim, k = 1): Dim {
  return a.map((v, i) => v + k * (b[i] ?? 0)) as unknown as Dim;
}

function powUnit(u: ParsedUnit, exp: number): ParsedUnit {
  return { factor: u.factor ** exp, dim: u.dim.map((v) => v * exp) as unknown as Dim };
}

/** Résout un symbole simple, éventuellement préfixé (ex. « mΩ », « cm », « µs »). */
function resolveSymbol(sym: string): ParsedUnit | null {
  const aliased = ALIASES[sym] ?? ALIASES[sym.toLowerCase()] ?? sym;
  if (COUNT_WORDS.has(aliased.toLowerCase())) return { factor: 1, dim: ZERO };
  const direct = UNITS[aliased];
  if (direct) return direct;
  // Préfixe + unité (préfixes de 2 caractères d'abord).
  for (const plen of [2, 1]) {
    if (aliased.length <= plen) continue;
    const prefix = aliased.slice(0, plen);
    const rest = aliased.slice(plen);
    const pf = PREFIXES[prefix];
    const restAliased = ALIASES[rest] ?? rest;
    const unit = UNITS[restAliased];
    if (pf !== undefined && unit) {
      // « mol », « ppm » ne prennent pas de préfixe ici
      return { factor: pf * unit.factor, dim: unit.dim };
    }
  }
  return null;
}

/** Découpe un jeton collé (ex. « Vs », « Ωcm ») en unités connues, par plus long préfixe. */
function resolveConcatenated(token: string): ParsedUnit | null {
  const single = resolveSymbol(token);
  if (single) return single;
  for (let cut = token.length - 1; cut >= 1; cut--) {
    const head = resolveSymbol(token.slice(0, cut));
    if (!head) continue;
    const tail = resolveConcatenated(token.slice(cut));
    if (tail) return { factor: head.factor * tail.factor, dim: mulDim(head.dim, tail.dim) };
  }
  return null;
}

/**
 * Analyse une expression d'unité. Retourne null si elle n'est pas reconnue.
 * Une chaîne vide correspond à une grandeur sans dimension.
 */
export function parseUnit(raw: string): ParsedUnit | null {
  let s = normalizeSuperscripts(raw.trim())
    .replace(/[−–]/g, '-')
    .replace(/[⋅·•∙×*]/g, '.')
    .replace(/\bpar\b/g, '/');
  s = s.replace(/\s*\/\s*/g, '/').replace(/\s*\^\s*/g, '^');
  if (s === '') return { factor: 1, dim: ZERO };
  let pos = 0;

  function parseExpr(): ParsedUnit | null {
    let acc: ParsedUnit = { factor: 1, dim: ZERO };
    let sign = 1;
    while (pos < s.length) {
      const ch = s[pos]!;
      if (ch === ')') break;
      if (ch === '.' || ch === ' ') {
        pos++;
        continue;
      }
      if (ch === '/') {
        sign = -1;
        pos++;
        continue;
      }
      let term: ParsedUnit | null;
      if (ch === '(') {
        pos++;
        term = parseExpr();
        if (s[pos] !== ')') return null;
        pos++;
      } else {
        const m = /^(e-|%|[^\s./()^\d+-]+)/u.exec(s.slice(pos));
        if (!m) return null;
        pos += m[0].length;
        term = resolveConcatenated(m[0]);
      }
      if (!term) return null;
      // exposant : ^-3, ^2, ou chiffres collés (m2, cm-3)
      const em = /^\^?([+-]?\d+)/.exec(s.slice(pos));
      let exp = 1;
      if (em) {
        exp = Number(em[1]);
        pos += em[0].length;
      }
      const t = powUnit(term, exp * sign);
      acc = { factor: acc.factor * t.factor, dim: mulDim(acc.dim, t.dim) };
      // Après « / X », on revient au numérateur sauf si on enchaîne un séparateur « . »
      // (convention usuelle : « m2/V.s » = m²/(V·s)). On garde donc le signe jusqu'à un nouveau « / ».
    }
    return acc;
  }

  const result = parseExpr();
  if (!result || pos < s.length) return null;
  return result;
}

export function sameDim(a: Dim, b: Dim): boolean {
  return a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 1e-9);
}

export function isDimensionless(u: ParsedUnit): boolean {
  return sameDim(u.dim, ZERO);
}

/** Formatte une dimension lisible (pour les messages d'erreur). */
export function describeDim(dim: Dim): string {
  const names = ['m', 'kg', 's', 'A', 'K', 'mol'];
  const parts = dim
    .map((e, i) => (e === 0 ? '' : e === 1 ? names[i] : `${names[i]}^${e}`))
    .filter(Boolean);
  return parts.length ? parts.join('·') : 'sans dimension';
}
