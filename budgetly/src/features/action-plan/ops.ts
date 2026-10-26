import { z } from "zod";
import { defineOp, type OpContext } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { addDays, startOfWeek } from "@/lib/dates";
import { nonNegMinor, uuid } from "@/lib/validation";
import { loadSnapshot } from "../finance/snapshot";
import { buildPlan, planResults, toActionRow } from "./engine";
import type { ActionType } from "@/types/db";
import { flows, accountBalances, totals } from "../finance/balances";
import { goalProgress } from "../goals/service";

async function generate(ctx: OpContext) {
  const { store, today } = ctx;
  const s = await loadSnapshot(store, today);
  const [aidApplications, history] = await Promise.all([store.list("user_aid_applications"), store.list("action_items", { gte: { column: "week_start", value: addDays(today, -60) } })]);
  const dismissedTypes = [...new Set(history.filter((h) => h.status === "dismissed").map((h) => h.type))] as ActionType[];
  const plan = buildPlan({ snapshot: s, aidApplications, dismissedTypes, objectives: s.profile?.objectives });
  // Upsert idempotent : le statut des actions déjà présentes cette semaine est préservé.
  const week = startOfWeek(today);
  const existing = await store.list("action_items", { eq: { week_start: week } });
  const fresh = plan.filter((p) => !existing.some((e) => e.key === p.key)).map((p) => toActionRow(p, today));
  if (fresh.length) await store.insert("action_items", fresh);
  return { generated: fresh.length };
}

export const planOps = {
  "plan.get": defineOp({
    name: "plan.get", mutation: true, input: z.object({ regenerate: z.boolean().default(false) }),
    run: async (ctx, { regenerate }) => {
      const week = startOfWeek(ctx.today);
      let items = await ctx.store.list("action_items", { eq: { week_start: week } });
      if (!items.length || regenerate) {
        await generate(ctx);
        items = await ctx.store.list("action_items", { eq: { week_start: week } });
      }
      // Les actions reportées des semaines précédentes restent visibles.
      const postponed = (await ctx.store.list("action_items", { eq: { status: "postponed" } })).filter((i) => i.week_start < week);
      const order = { in_progress: 0, todo: 1, postponed: 2, done: 3, dismissed: 4 } as const;
      return {
        week,
        items: [...items, ...postponed].sort((a, b) => order[a.status] - order[b.status] || b.priority - a.priority),
      };
    },
  }),

  "plan.updateItem": defineOp({
    name: "plan.updateItem", mutation: true,
    input: z.object({
      id: uuid, status: z.enum(["todo", "in_progress", "postponed", "done", "dismissed"]),
      realized_minor: nonNegMinor.nullish(), realized_kind: z.enum(["saving", "extra_income", "aid_received"]).nullish(),
    }),
    run: async ({ store, now }, { id, status, realized_minor, realized_kind }) => {
      if ((realized_minor ?? null) !== null && !realized_kind) throw new AppError("invalid", "Précise la nature du résultat obtenu");
      return store.update("action_items", id, {
        status, realized_minor: status === "done" ? realized_minor ?? null : null, realized_kind: status === "done" ? realized_kind ?? null : null,
        completed_at: status === "done" ? now.toISOString() : null,
      });
    },
  }),

  "plan.results": defineOp({
    name: "plan.results", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const [items, s, aidApps, jobs, records] = await Promise.all([
        store.list("action_items", { order: { column: "week_start", ascending: false } }),
        loadSnapshot(store, today),
        store.list("user_aid_applications"),
        store.list("job_applications"),
        store.list("savings_records"),
      ]);
      const t = totals(accountBalances(s.accounts, s.transactions, today));
      const weeks = [...new Set(items.map((i) => i.week_start))].slice(0, 8).reverse();
      return {
        results: planResults(items),
        // Réalisations déclarées dans chaque module (séparées des projections).
        realized: {
          aidsReceived: aidApps.filter((a) => a.status === "granted").reduce((x, a) => x + (a.amount_received_minor ?? 0), 0),
          extraIncome: jobs.filter((j) => j.status === "completed").reduce((x, j) => x + (j.earned_minor ?? 0), 0),
          verifiedSavingsMonthly: records.filter((r) => r.status === "verified").reduce((x, r) => x + r.monthly_amount_minor, 0),
          declaredSavingsMonthly: records.filter((r) => r.status === "declared").reduce((x, r) => x + r.monthly_amount_minor, 0),
        },
        goals: s.goals.filter((g) => g.status !== "archived").map((g) => goalProgress(g, s.allocations, today)),
        cash: { available: t.available, savings: t.savings, last30: flows(s.transactions, addDays(today, -29), today, s.accounts) },
        weekly: weeks.map((w) => ({ week: w, done: items.filter((i) => i.week_start === w && i.status === "done").length, total: items.filter((i) => i.week_start === w).length })),
      };
    },
  }),
};
