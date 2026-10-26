import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { addDays } from "@/lib/dates";
import { amountMinor, frequency, isoDate, nonNegMinor, optionalText, text, uuid } from "@/lib/validation";
import { DEAL_BY_SLUG, DEALS } from "@/data/deals";
import { effectiveStatus } from "@/data/sources";
import { compareCosts, suggestDeals } from "./compare";
import { loadSnapshot } from "../finance/snapshot";

export const dealOps = {
  "deals.list": defineOp({
    name: "deals.list", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const s = await loadSnapshot(store, today);
      const [saved, records] = await Promise.all([store.list("saved_deals"), store.list("savings_records", { order: { column: "started_on", ascending: false } })]);
      const savedSet = new Set(saved.map((d) => d.deal_slug));
      const suggestions = suggestDeals(s.transactions, s.categories, s.subscriptions, addDays(today, -90), today, 3);
      return {
        deals: DEALS.map((d) => ({ ...d, sourceStatus: effectiveStatus(d.source, today), saved: savedSet.has(d.slug) })),
        suggestions: suggestions.map((x) => ({ slug: x.deal.slug, reason: x.reason, observedMonthlyMinor: x.observedMonthlyMinor })),
        records,
        // Économies séparées par niveau de certitude : jamais additionnées entre elles.
        totals: {
          declaredMonthly: records.filter((r) => r.status === "declared").reduce((a, r) => a + r.monthly_amount_minor, 0),
          verifiedMonthly: records.filter((r) => r.status === "verified").reduce((a, r) => a + r.monthly_amount_minor, 0),
        },
      };
    },
  }),

  "deals.toggleSave": defineOp({
    name: "deals.toggleSave", mutation: true, input: z.object({ deal_slug: z.string().regex(/^[a-z0-9_-]{2,60}$/) }),
    run: async ({ store }, { deal_slug }) => {
      if (!DEAL_BY_SLUG.has(deal_slug)) throw new AppError("not_found", "Bon plan inconnu");
      const removed = await store.removeWhere("saved_deals", { deal_slug });
      if (removed) return { saved: false };
      await store.insert("saved_deals", [{ deal_slug }]);
      return { saved: true };
    },
  }),

  "deals.compare": defineOp({
    name: "deals.compare", mutation: false,
    input: z.object({ currentMinor: nonNegMinor, currentFrequency: frequency, alternativeMinor: nonNegMinor, alternativeFrequency: frequency, switchingCostMinor: nonNegMinor }),
    run: async (_ctx, input) => compareCosts(input),
  }),

  "savings.record": defineOp({
    name: "savings.record", mutation: true,
    input: z.object({ label: text(120, 1), deal_slug: z.string().max(60).nullish(), monthly_amount_minor: amountMinor, started_on: isoDate, evidence: optionalText(300) }),
    run: async ({ store }, input) => (await store.insert("savings_records", [{ ...input, deal_slug: input.deal_slug ?? null, status: "declared" }]))[0]!,
  }),

  "savings.verify": defineOp({
    name: "savings.verify", mutation: true, input: z.object({ id: uuid, evidence: text(300, 3) }),
    run: async ({ store }, { id, evidence }) => store.update("savings_records", id, { status: "verified", evidence }),
  }),

  "savings.delete": defineOp({
    name: "savings.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("savings_records", [id]) }),
  }),
};
