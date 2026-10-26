import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { isoDate, nonNegMinor, optionalText, text, uuid } from "@/lib/validation";
import { JOB_PLATFORMS } from "@/data/job-platforms";
import { profitability, scoreOpportunity } from "./service";
import { addMonths, startOfMonth } from "@/lib/dates";

const jobStatus = z.enum(["saved", "applied", "interview", "accepted", "rejected", "withdrawn", "completed"]);

export const earnOps = {
  "earn.search": defineOp({
    name: "earn.search", mutation: false,
    input: z.object({
      keywords: z.string().trim().max(80).optional(), location: z.string().trim().max(60).optional(), radiusKm: z.number().int().min(0).max(200).optional(),
      remote: z.boolean().optional(), category: z.string().max(40).optional(), minHourlyMinor: nonNegMinor.optional(), contractType: z.string().max(10).optional(),
      sort: z.enum(["score", "date", "pay"]).default("score"), page: z.number().int().min(0).max(20).default(0),
    }),
    run: async ({ store, opportunityProviders }, { sort, ...q }) => {
      const [availability] = await store.list("availability_preferences", { limit: 1 });
      const enabled = opportunityProviders.filter((p) => p.isEnabled());
      const errors: string[] = [];
      const results = (await Promise.all(enabled.map((p) => p.search(q).catch((e: Error) => { errors.push(`${p.name} : indisponible`); void e; return []; })))).flat();
      const scored = results.map((o) => scoreOpportunity(o, availability ?? null));
      scored.sort((a, b) => sort === "date" ? (b.postedAt ?? "").localeCompare(a.postedAt ?? "") : sort === "pay" ? (b.hourlyRateMinor ?? 0) - (a.hourlyRateMinor ?? 0) : b.score - a.score);
      return {
        providers: opportunityProviders.map((p) => ({ id: p.id, name: p.name, enabled: p.isEnabled() })),
        results: scored,
        errors,
        platforms: JOB_PLATFORMS,
        hasAvailability: !!availability,
      };
    },
  }),

  "earn.applications": defineOp({
    name: "earn.applications", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const [apps, target] = await Promise.all([store.list("job_applications", { order: { column: "updated_at", ascending: false } }), store.list("earning_targets", { limit: 1 })]);
      const monthStart = startOfMonth(today);
      // Revenus réalisés : uniquement les montants saisis comme perçus sur des missions terminées.
      const earnedThisMonth = apps.filter((a) => a.status === "completed" && a.updated_at.slice(0, 10) >= monthStart).reduce((s, a) => s + (a.earned_minor ?? 0), 0);
      const earnedTotal = apps.filter((a) => a.status === "completed").reduce((s, a) => s + (a.earned_minor ?? 0), 0);
      const history = [5, 4, 3, 2, 1, 0].map((i) => {
        const m = addMonths(monthStart, -i);
        const next = addMonths(m, 1);
        return { month: m, earned: apps.filter((a) => a.status === "completed" && a.updated_at.slice(0, 10) >= m && a.updated_at.slice(0, 10) < next).reduce((s, a) => s + (a.earned_minor ?? 0), 0) };
      });
      return { applications: apps, target: target[0]?.monthly_target_minor ?? null, earnedThisMonth, earnedTotal, history };
    },
  }),

  "earn.save": defineOp({
    name: "earn.save", mutation: true,
    input: z.object({
      provider: z.string().regex(/^[a-z0-9_-]{2,40}$/), external_id: text(120, 1), is_example: z.boolean(), title: text(200, 1), employer: optionalText(200),
      location: optionalText(200), url: z.string().url().startsWith("https://").nullish(), category: optionalText(40), pay_label: optionalText(120),
      snapshot: z.record(z.string(), z.unknown()).default({}),
    }),
    run: async ({ store }, input) => {
      const snapshot = JSON.parse(JSON.stringify(input.snapshot)) as Record<string, unknown>;
      if (JSON.stringify(snapshot).length > 8000) throw new AppError("invalid", "Données d'offre trop volumineuses");
      return (await store.upsert("job_applications", [{ ...input, url: input.url ?? null, snapshot }], ["provider", "external_id"]))[0]!;
    },
  }),

  "earn.update": defineOp({
    name: "earn.update", mutation: true,
    input: z.object({ id: uuid, status: jobStatus.optional(), notes: optionalText(2000).optional(), reminder_date: isoDate.nullish(), applied_at: isoDate.nullish(), earned_minor: nonNegMinor.nullish() }),
    run: async ({ store }, { id, ...patch }) => store.update("job_applications", id, patch),
  }),

  "earn.delete": defineOp({
    name: "earn.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("job_applications", [id]) }),
  }),

  "earn.setTarget": defineOp({
    name: "earn.setTarget", mutation: true, input: z.object({ monthly_target_minor: nonNegMinor }),
    run: async ({ store }, input) => (await store.upsert("earning_targets", [input], ["user_id"]))[0]!,
  }),

  "earn.profitability": defineOp({
    name: "earn.profitability", mutation: false,
    input: z.object({
      grossTotalMinor: nonNegMinor.nullish(), hourlyRateMinor: nonNegMinor.nullish(), workHours: z.number().min(0).max(500), travelHours: z.number().min(0).max(500),
      travelCostMinor: nonNegMinor, otherCostsMinor: nonNegMinor, contributionRatePermille: z.number().int().min(0).max(900).nullish(),
    }),
    run: async (_ctx, input) => profitability(input),
  }),
};
