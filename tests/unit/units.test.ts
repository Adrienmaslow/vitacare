import { describe, expect, it } from 'vitest';
import { parseUnit, sameDim } from '@/engines/units/units';
import { checkNumeric, parseQuantity } from '@/engines/units/quantity';
import type { NumericAnswer } from '@/types';

const ans = (value: number, unit: string, extra: Partial<NumericAnswer> = {}): NumericAnswer => ({
  value,
  unit,
  tolerance: 0.02,
  unitRequired: true,
  ...extra,
});

describe('parseQuantity — saisie à la française', () => {
  it.each([
    ['0,26', 0.26],
    ['0.26', 0.26],
    ['1 424', 1424],
    ['1,66e20', 1.66e20],
    ['1,66E+20', 1.66e20],
    ['1,66·10^20', 1.66e20],
    ['1,66 × 10^20', 1.66e20],
    ['1,66x10⁻¹⁹', 1.66e-19],
    ['1.6*10^-19', 1.6e-19],
    ['10^20', 1e20],
    ['-5', -5],
    ['−5', -5],
    ['.5', 0.5],
    ['2,85.10^-6', 2.85e-6],
  ])('%s → %d', (input, expected) => {
    const q = parseQuantity(input);
    expect(q).not.toBeNull();
    expect(q!.value).toBeCloseTo(expected, 30);
    expect(q!.value / expected).toBeCloseTo(1, 10);
  });

  it('sépare la valeur de l’unité', () => {
    expect(parseQuantity('260 mΩ')!.unitText).toBe('mΩ');
    expect(parseQuantity('35 m/s')!.unitText).toBe('m/s');
    expect(parseQuantity('5 eV')!.unitText).toBe('eV');
  });

  it('refuse une saisie illisible', () => {
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });
});

describe('parseUnit — unités, préfixes, dimensions', () => {
  it('reconnaît les préfixes SI', () => {
    expect(parseUnit('mΩ')!.factor).toBeCloseTo(1e-3);
    expect(parseUnit('kΩ')!.factor).toBeCloseTo(1e3);
    expect(parseUnit('µC')!.factor).toBeCloseTo(1e-6);
    expect(parseUnit('uC')!.factor).toBeCloseTo(1e-6);
    expect(parseUnit('pF')!.factor).toBeCloseTo(1e-12);
  });
  it('gère puissances et quotients', () => {
    expect(parseUnit('mm^2')!.factor).toBeCloseTo(1e-6);
    expect(parseUnit('mm²')!.factor).toBeCloseTo(1e-6);
    expect(parseUnit('cm-3')!.factor).toBeCloseTo(1e6);
    expect(parseUnit('cm⁻³')!.factor).toBeCloseTo(1e6);
    expect(parseUnit('µΩ.cm')!.factor).toBeCloseTo(1e-8);
    expect(parseUnit('µΩ·cm')!.factor).toBeCloseTo(1e-8);
  });
  it('ohm écrit en toutes lettres et unités collées', () => {
    expect(sameDim(parseUnit('ohm')!.dim, parseUnit('Ω')!.dim)).toBe(true);
    expect(sameDim(parseUnit('Ωm')!.dim, parseUnit('Ω.m')!.dim)).toBe(true);
    expect(sameDim(parseUnit('cm²/Vs')!.dim, parseUnit('m^2/(V.s)')!.dim)).toBe(true);
    expect(parseUnit('cm²/Vs')!.factor).toBeCloseTo(1e-4);
  });
  it('vérifie les dimensions : S/m = Ω⁻¹·m⁻¹', () => {
    expect(sameDim(parseUnit('S/m')!.dim, parseUnit('Ω^-1.m^-1')!.dim)).toBe(true);
    expect(sameDim(parseUnit('S/m')!.dim, parseUnit('Ω.m')!.dim)).toBe(false);
  });
  it('V/m homogène à N/C ; eV homogène à J', () => {
    expect(sameDim(parseUnit('V/m')!.dim, parseUnit('N/C')!.dim)).toBe(true);
    expect(sameDim(parseUnit('eV')!.dim, parseUnit('J')!.dim)).toBe(true);
  });
  it('unité inconnue → null', () => {
    expect(parseUnit('bananes')).toBeNull();
  });
});

describe('checkNumeric — validation des résultats', () => {
  it('0,26 Ω ≡ 260 mΩ', () => {
    const a = ans(0.261, 'Ω');
    expect(checkNumeric('0,26 Ω', a).correct).toBe(true);
    expect(checkNumeric('260 mΩ', a).correct).toBe(true);
    expect(checkNumeric('0.261 ohm', a).correct).toBe(true);
  });
  it('accepte les unités équivalentes et conversions', () => {
    expect(checkNumeric('5e14 cm^-3', ans(5e20, 'm^-3')).correct).toBe(true);
    expect(checkNumeric('1,845e-8 Ω.m', ans(1.845, 'µΩ.cm', { tolerance: 0.01 })).correct).toBe(
      true,
    );
    expect(checkNumeric('3,98 pF', ans(3.9825e-12, 'F')).correct).toBe(true);
    expect(checkNumeric('0,333 µC/m²', ans(3.333e-7, 'C/m^2')).correct).toBe(true);
    expect(checkNumeric('13 cm²/Vs', ans(13.05, 'cm^2/(V.s)')).correct).toBe(true);
    expect(checkNumeric('1,3e-3 m²/(V.s)', ans(13.05, 'cm^2/(V.s)')).correct).toBe(true);
  });
  it('respecte la tolérance', () => {
    const a = ans(100, 'V');
    expect(checkNumeric('101,9 V', a).correct).toBe(true);
    expect(checkNumeric('103 V', a).correct).toBe(false);
  });
  it('détecte une unité manquante quand elle est exigée', () => {
    const r = checkNumeric('0,26', ans(0.261, 'Ω'));
    expect(r.correct).toBe(false);
    expect(r.category).toBe('unites');
    expect(r.feedback).toMatch(/unité manque/);
  });
  it('accepte l’absence d’unité si elle n’est pas exigée', () => {
    expect(checkNumeric('1,66e20', ans(1.666e20, 's^-1', { unitRequired: false })).correct).toBe(
      true,
    );
    expect(
      checkNumeric('1,66e20 électrons/s', ans(1.666e20, 's^-1', { unitRequired: false })).correct,
    ).toBe(true);
  });
  it('refuse une unité non homogène', () => {
    const r = checkNumeric('0,26 S', ans(0.261, 'Ω'));
    expect(r.correct).toBe(false);
    expect(r.category).toBe('unites');
  });
  it('signale un facteur 10^k (erreur de conversion)', () => {
    const r = checkNumeric('5e14', ans(5e20, 'm^-3', { unitRequired: false }));
    expect(r.correct).toBe(false);
    expect(r.category).toBe('unites');
    expect(r.feedback).toContain('10^-6');
  });
  it('signale une erreur de signe', () => {
    const r = checkNumeric('5 V', ans(-5, 'V'));
    expect(r.category).toBe('signe');
  });
  it('ne devine pas de cause pour une valeur simplement fausse', () => {
    const r = checkNumeric('42 V', ans(5, 'V'));
    expect(r.correct).toBe(false);
    expect(r.category).toBeNull();
  });
});
