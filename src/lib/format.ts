import { formatNumber } from '@/engines/units/quantity';

/** Nombre formaté pour KaTeX, à la française (virgule décimale, ·10^{n}). */
export function texNum(v: number, digits = 3): string {
  return formatNumber(v, digits)
    .replace(/·10\^(-?\d+)/, '\\cdot10^{$1}')
    .replace(/,/g, '{,}')
    .replace(/[\u202f\u00a0\s]/g, '\\,');
}
