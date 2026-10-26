/**
 * Import CSV côté serveur. Le fichier est lu et analysé dans le navigateur :
 * seules les lignes normalisées (date, libellé, montant) sont transmises, jamais le fichier brut.
 * Le serveur revalide chaque ligne, recalcule les doublons et catégorise.
 */
import { z } from "zod";
import { audit, defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { amountMinor, isoDate, text, uuid } from "@/lib/validation";
import type { Insert } from "@/types/db";
import { createCategorizer, normalizeLabel } from "../transactions/categorize";
import { dedupHash, detectDuplicates, MAX_CSV_ROWS, sanitizeCell, type NormalizedRow } from "./csv";

const row = z.object({
  line: z.number().int().min(1),
  date: isoDate,
  bookingDate: isoDate.nullable(),
  label: text(200, 1),
  type: z.enum(["income", "expense"]),
  amount_minor: amountMinor,
});

function normalize(accountId: string, rows: z.infer<typeof row>[]): NormalizedRow[] {
  return rows.map((r) => {
    const label = sanitizeCell(r.label);
    return { ...r, label, dedupHash: dedupHash(accountId, r.date, r.type === "income" ? r.amount_minor : -r.amount_minor, label) };
  });
}

export const importOps = {
  "imports.analyze": defineOp({
    name: "imports.analyze", mutation: false, sensitive: true,
    input: z.object({ account_id: uuid, rows: z.array(row).min(1).max(MAX_CSV_ROWS) }),
    run: async ({ store }, { account_id, rows }) => {
      if (!(await store.get("financial_accounts", account_id))) throw new AppError("not_found", "Compte introuvable");
      const [existing, rules, categories] = await Promise.all([store.list("transactions"), store.list("categorization_rules"), store.list("transaction_categories")]);
      const normalized = normalize(account_id, rows);
      const dups = detectDuplicates(normalized, existing, account_id);
      const categorize = createCategorizer({ rules, categories, history: existing });
      return {
        rows: normalized.map((r, i) => ({ ...r, duplicate: dups[i] ?? null, categorization: categorize(r.label, r.type) })),
        categories,
      };
    },
  }),

  "imports.commit": defineOp({
    name: "imports.commit", mutation: true, sensitive: true,
    input: z.object({
      account_id: uuid,
      filename: text(200, 1),
      totalRows: z.number().int().min(0).max(MAX_CSV_ROWS * 2),
      errorCount: z.number().int().min(0),
      rows: z.array(row.extend({ category_id: uuid.nullable(), include: z.boolean() })).min(1).max(MAX_CSV_ROWS),
      rememberRules: z.boolean().default(false),
    }),
    run: async (ctx, input) => {
      const { store } = ctx;
      if (!(await store.get("financial_accounts", input.account_id))) throw new AppError("not_found", "Compte introuvable");
      const categories = await store.list("transaction_categories");
      const catIds = new Map(categories.map((c) => [c.id, c]));
      const selected = input.rows.filter((r) => r.include);
      // Recalcul serveur : les doublons exacts sont toujours écartés, même si le client les a cochés.
      const existing = await store.list("transactions");
      const normalized = normalize(input.account_id, selected);
      const dups = detectDuplicates(normalized, existing, input.account_id);
      const toInsert = selected.filter((_, i) => dups[i] !== "exact");
      const [imp] = await store.insert("csv_imports", [{
        account_id: input.account_id, filename: input.filename.replace(/[^\w.\- ()À-ÿ]/g, "_"), row_count: input.totalRows,
        imported_count: toInsert.length, duplicate_count: input.totalRows - input.errorCount - toInsert.length, error_count: input.errorCount,
      }]);
      const subs = await store.list("subscriptions", { eq: { status: "active" } });
      const txRows: Insert<"transactions">[] = toInsert.map((r) => {
        const cat = r.category_id ? catIds.get(r.category_id) : undefined;
        const validCat = cat && (cat.kind === "both" || cat.kind === r.type) ? cat.id : null;
        const n = normalizeLabel(r.label);
        const sub = r.type === "expense" ? subs.find((s) => { const p = normalizeLabel(s.match_pattern || s.service); return p.length >= 3 && n.includes(p); }) : undefined;
        return {
          account_id: input.account_id, date: r.date, booking_date: r.bookingDate && r.bookingDate >= r.date ? r.bookingDate : null, type: r.type,
          amount_minor: r.amount_minor, label: sanitizeCell(r.label), category_id: validCat, source: "csv", import_id: imp!.id,
          dedup_hash: normalized.find((x) => x.line === r.line)?.dedupHash ?? null, subscription_id: sub?.id ?? null,
        };
      });
      try {
        // Insertion en une seule instruction : tout ou rien.
        if (txRows.length) await store.insert("transactions", txRows);
      } catch (e) {
        await store.remove("csv_imports", [imp!.id]);
        throw e;
      }
      if (input.rememberRules) {
        const rules = await store.list("categorization_rules");
        const learned = new Map<string, string>();
        for (const r of toInsert) if (r.category_id) learned.set(normalizeLabel(r.label).split(" ").slice(0, 3).join(" "), r.category_id);
        const fresh = [...learned.entries()].filter(([p]) => p.length >= 3 && !rules.some((x) => x.pattern === p)).slice(0, 50);
        if (fresh.length) await store.insert("categorization_rules", fresh.map(([pattern, category_id]) => ({ pattern, category_id, match_type: "contains" as const, priority: 80 })));
      }
      await audit(ctx, "import.completed", { rows: toInsert.length });
      return { import: imp!, imported: toInsert.length, skippedDuplicates: selected.length - toInsert.length };
    },
  }),

  "imports.list": defineOp({
    name: "imports.list", mutation: false, input: z.object({}),
    run: async ({ store }) => store.list("csv_imports", { order: { column: "created_at", ascending: false }, limit: 50 }),
  }),

  /** Annulation : supprime toutes les opérations de l'import (réversible). */
  "imports.revert": defineOp({
    name: "imports.revert", mutation: true, sensitive: true, input: z.object({ id: uuid }),
    run: async (ctx, { id }) => {
      const imp = await ctx.store.get("csv_imports", id);
      if (!imp) throw new AppError("not_found", "Import introuvable");
      const removed = await ctx.store.removeWhere("transactions", { import_id: id });
      await ctx.store.update("csv_imports", id, { status: "reverted" });
      await audit(ctx, "import.reverted", { rows: removed });
      return { removed };
    },
  }),
};
