import { describe, expect, it } from "vitest";
import { ceilTo, formatMoney, minorToInput, mulDiv, parseAmount, percent, roundTo, sum } from "@/lib/money";

describe("parseAmount — conversion texte → centimes sans flottant", () => {
  it.each([
    ["12", 1200], ["12,5", 1250], ["12.50", 1250], ["-1 234,56", -123456], ["1.234,56", 123456], ["1,234.56", 123456],
    ["12,50 €", 1250], ["€12.50", 1250], ["(12,00)", -1200], ["+3", 300], ["0,01", 1], ["1 000", 100000], ["45-", -4500], ["- 7,30", -730],
  ])("%s → %d", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(["", "abc", "12,345", "1.2.3", "12,5,6", "1e5", "--3"])("rejette %s", (input) => expect(parseAmount(input)).toBeNull());

  it("évite l'erreur classique 0,1 + 0,2", () => {
    expect(parseAmount("0,1")! + parseAmount("0,2")!).toBe(30);
  });

  it("gère les nombres en entrée sans erreur binaire", () => {
    expect(parseAmount(19.99)).toBe(1999);
    expect(parseAmount(0.07)).toBe(7);
  });

  it("refuse les montants hors limite", () => {
    expect(parseAmount("1000000000000")).toBeNull();
  });
});

describe("arithmétique", () => {
  it("mulDiv arrondit à la demi-unité éloignée de zéro", () => {
    expect(mulDiv(100, 1, 3)).toBe(33);
    expect(mulDiv(5, 1, 2)).toBe(3);
    expect(mulDiv(-5, 1, 2)).toBe(-3);
    expect(mulDiv(1999, 12, 52)).toBe(461);
  });
  it("mulDiv reste exact sur de grands montants", () => {
    expect(mulDiv(99_999_999_999, 100, 100)).toBe(99_999_999_999);
  });
  it("percent, roundTo, ceilTo, sum", () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(1, 0)).toBe(0);
    expect(roundTo(1249, 500)).toBe(1000);
    expect(roundTo(1250, 500)).toBe(1500);
    expect(ceilTo(1201, 100)).toBe(1300);
    expect(ceilTo(-5, 100)).toBe(0);
    expect(sum([1, 2, 3])).toBe(6);
    expect(() => sum([0.5])).toThrow();
  });
  it("formatMoney et minorToInput", () => {
    expect(formatMoney(123456)).toBe("1 234,56 €");
    expect(formatMoney(-500, { sign: true })).toBe("-5,00 €");
    expect(minorToInput(-1205)).toBe("-12.05");
    expect(minorToInput(null)).toBe("");
    expect(parseAmount(minorToInput(98765))).toBe(98765);
  });
});
