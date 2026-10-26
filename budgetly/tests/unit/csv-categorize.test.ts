import { describe, expect, it } from "vitest";
import { decodeCsv, detectDelimiter, detectDuplicates, detectMapping, looksLikeCsv, normalizeRows, parseCsv, parseDate, sanitizeCell } from "@/features/imports/csv";
import { buildHistoryIndex, createCategorizer, normalizeLabel } from "@/features/transactions/categorize";
import { account, catId, cats, tx } from "../helpers/factory";
import type { CategorizationRuleRow } from "@/types/db";

const ACC = "acc";

describe("import CSV", () => {
  it("décode UTF-8 (avec BOM) et Windows-1252", () => {
    expect(decodeCsv(new TextEncoder().encode("﻿Date;Libellé")).text).toBe("Date;Libellé");
    const latin1 = new Uint8Array([0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9]); // "Libellé" en cp1252
    const r = decodeCsv(latin1);
    expect(r.encoding).toBe("windows-1252");
    expect(r.text).toBe("Libellé");
  });

  it("rejette les contenus non tabulaires", () => {
    expect(looksLikeCsv("<html><body>x</body></html>")).toBe(false);
    expect(looksLikeCsv("une seule ligne")).toBe(false);
    expect(looksLikeCsv("a;b\n1;2")).toBe(true);
  });

  it("détecte le séparateur", () => {
    expect(detectDelimiter("a;b;c\n1;2,5;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("format français : point-virgule, débit/crédit séparés, dates JJ/MM/AAAA", () => {
    const text = [
      "Relevé de compte",
      "Date opération;Date valeur;Libellé;Débit;Crédit",
      "03/10/2026;03/10/2026;CB CARREFOUR CITY;23,40;",
      "05/10/2026;05/10/2026;VIR SALAIRE;;1 200,00",
      "32/10/2026;;LIGNE INVALIDE;1,00;",
      "06/10/2026;;\"CB SNCF; trajet Lyon-Paris avec une description longue\";35,00;",
    ].join("\n");
    const p = parseCsv(text);
    expect(p.hasHeader).toBe(true);
    const m = detectMapping(p)!;
    expect(m).toMatchObject({ date: 0, bookingDate: 1, label: 2, debit: 3, credit: 4, dateFormat: "dmy" });
    const { rows, errors } = normalizeRows(p, m, ACC);
    expect(rows.map((r) => [r.type, r.amount_minor])).toEqual([["expense", 2340], ["income", 120000], ["expense", 3500]]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.reason).toBe("Date illisible");
    expect(rows[2]!.label).toContain("trajet Lyon-Paris");
  });

  it("format anglo-saxon : virgule, montant signé, dates ISO", () => {
    const p = parseCsv("Date,Description,Amount\n2026-10-03,NETFLIX.COM,-7.99\n2026-10-04,Refund,12.50");
    const m = detectMapping(p)!;
    expect(m.dateFormat).toBe("ymd");
    const { rows } = normalizeRows(p, m, ACC);
    expect(rows.map((r) => r.amount_minor)).toEqual([799, 1250]);
  });

  it("parseDate", () => {
    expect(parseDate("03/10/26", "dmy")).toBe("2026-10-03");
    expect(parseDate("2026-02-30", "ymd")).toBeNull();
    expect(parseDate("10/31/2026", "mdy")).toBe("2026-10-31");
  });

  it("neutralise les injections de formules", () => {
    expect(sanitizeCell("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(sanitizeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeCell("-12,50")).toBe("-12,50");
  });

  it("détecte doublons exacts, probables et internes au fichier", () => {
    const a = account();
    const p = parseCsv("Date;Libellé;Montant\n03/10/2026;CB CARREFOUR;-23,40\n03/10/2026;CB CARREFOUR;-23,40\n04/10/2026;CB LIDL MARSEILLE;-10,00\n09/10/2026;CB FNAC;-50,00");
    const { rows } = normalizeRows(p, detectMapping(p)!, a.id);
    const existing = [
      tx({ account_id: a.id, date: "2026-10-03", amount_minor: 2340, label: "CB CARREFOUR" }),
      tx({ account_id: a.id, date: "2026-10-05", amount_minor: 1000, label: "CB LIDL" }),
    ];
    expect(detectDuplicates(rows, existing, a.id)).toEqual(["exact", "in_file", "probable", null]);
  });
});

describe("catégorisation", () => {
  const base = { categories: cats, rules: [] as CategorizationRuleRow[], history: [] };

  it("normalise les libellés bancaires", () => {
    expect(normalizeLabel("CB CARREFOUR 03/10 CARTE X1234")).toBe("CARREFOUR");
    expect(normalizeLabel("Prlv Sépa Free Mobile 123456789")).toBe("FREE MOBILE");
  });

  it.each([
    ["CB CARREFOUR MARKET", "expense", "alimentation"],
    ["SNCF CONNECT", "expense", "transport"],
    ["PRLV NETFLIX.COM", "expense", "abonnements"],
    ["SPOTIFY P1234", "expense", "abonnements"],
    ["VIR SALAIRE OCTOBRE", "income", "salaire"],
    ["CB CROUS LYON", "expense", "restaurants"],
  ])("%s → %s", (label, type, slug) => {
    expect(createCategorizer(base)(label, type as "income" | "expense").categorySlug).toBe(slug);
  });

  it("signale l'ambiguïté CROUS avec une alternative", () => {
    const r = createCategorizer(base)("CROUS", "expense");
    expect(r.confidence).toBe("medium");
    expect(r.alternativeSlug).toBe("etudes");
  });

  it("ne devine pas : catégorie inconnue si aucune règle", () => {
    expect(createCategorizer(base)("PAIEMENT LYDIA M DURAND", "expense")).toMatchObject({ categoryId: null, reason: "none" });
  });

  it("priorité : règle utilisateur > historique > commerçant", () => {
    const rule: CategorizationRuleRow = { id: "r", user_id: "u", created_at: "", updated_at: "", pattern: "carrefour", match_type: "contains", category_id: catId("shopping"), priority: 1 };
    expect(createCategorizer({ ...base, rules: [rule] })("CB CARREFOUR", "expense").categorySlug).toBe("shopping");
    const history = [{ label: "CB CARREFOUR", category_id: catId("loisirs"), source: "manual" as const }];
    expect(createCategorizer({ ...base, history })("CB CARREFOUR", "expense")).toMatchObject({ categorySlug: "loisirs", reason: "history" });
  });

  it("un historique ambigu n'est pas utilisé", () => {
    const idx = buildHistoryIndex([{ label: "X SHOP", category_id: "a", source: "manual" }, { label: "X SHOP", category_id: "b", source: "manual" }]);
    expect(idx.has("X SHOP")).toBe(false);
  });

  it("respecte le type d'opération (pas de catégorie de dépense sur un revenu)", () => {
    expect(createCategorizer(base)("REMBOURSEMENT CARREFOUR", "income").categorySlug).not.toBe("alimentation");
  });
});
