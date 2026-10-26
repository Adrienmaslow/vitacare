import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/dates";
import { amountMinor, frequency, isoDate, monthStart, optionalText, text, uuid } from "@/lib/validation";
import { loadSnapshot } from "./snapshot";
import { dashboardView } from "./dashboard";
import { budgetStatuses, suggestAllocation, totalExpenses } from "../budgets/service";
import { forecast } from "../forecasts/engine";
import { categoryBreakdown, kpis, monthlySeries, weeklyExpenses } from "../analytics/service";
import { accountBalances, totals } from "./balances";
import { summarizeSubscriptions, monthlyEquivalent, annualCost, nextPaymentFrom } from "../subscriptions/service";
import { goalProgress, goalStrategies } from "../goals/service";
import { spentByCategory } from "../budgets/service";
import { mulDiv } from "@/lib/money";

export const financeOps = {
  "dashboard.get": defineOp({
    name: "dashboard.get", mutation: false,
    input: z.object({ period: z.enum(["7d", "30d", "3m", "6m", "12m"]).default("30d"), from: isoDate.optional(), to: isoDate.optional() }),
    run: async ({ store, today }, { period, from, to }) => {
      const s = await loadSnapshot(store, today);
      return dashboardView(s, from && to && from <= to ? { from, to } : period);
    },
  }),

  "budgets.get": defineOp({
    name: "budgets.get", mutation: false, input: z.object({ month: monthStart.optional() }),
    run: async ({ store, today }, { month }) => {
      const s = await loadSnapshot(store, today);
      const m = month ?? startOfMonth(today);
      const statuses = budgetStatuses(s.budgets, s.categories, s.transactions, m, today);
      const history = [5, 4, 3, 2, 1, 0].map((i) => {
        const mm = addMonths(m, -i);
        const global = s.budgets.find((b) => b.month === mm && b.category_id === null);
        const planned = global?.amount_minor ?? s.budgets.filter((b) => b.month === mm && b.category_id).reduce((a, b) => a + b.amount_minor, 0);
        return { month: mm, planned, spent: totalExpenses(s.transactions, mm, endOfMonth(mm)) };
      });
      return {
        month: m,
        statuses,
        suggestion: suggestAllocation(s.transactions, s.categories, m, s.profile?.monthly_income_minor ?? 0),
        history,
        categories: s.categories.filter((c) => c.kind !== "income"),
        hasPreviousMonth: s.budgets.some((b) => b.month === addMonths(m, -1)),
      };
    },
  }),

  "budgets.upsert": defineOp({
    name: "budgets.upsert", mutation: true,
    input: z.object({ month: monthStart, category_id: uuid.nullable(), amount_minor: amountMinor, alert_thresholds: z.array(z.number().int().min(1).max(200)).max(5).default([70, 85, 100]) }),
    run: async ({ store }, input) => {
      if (input.category_id) {
        const c = (await store.list("transaction_categories")).find((x) => x.id === input.category_id);
        if (!c || c.kind === "income") throw new AppError("invalid", "Catégorie de dépense requise");
      }
      const existing = (await store.list("budgets", { eq: { month: input.month } })).find((b) => b.category_id === input.category_id);
      const thresholds = [...new Set(input.alert_thresholds)].sort((a, b) => a - b);
      if (existing) return store.update("budgets", existing.id, { amount_minor: input.amount_minor, alert_thresholds: thresholds });
      return (await store.insert("budgets", [{ ...input, alert_thresholds: thresholds }]))[0]!;
    },
  }),

  "budgets.delete": defineOp({
    name: "budgets.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("budgets", [id]) }),
  }),

  "budgets.duplicate": defineOp({
    name: "budgets.duplicate", mutation: true, input: z.object({ from: monthStart, to: monthStart }),
    run: async ({ store }, { from, to }) => {
      const src = await store.list("budgets", { eq: { month: from } });
      const dst = await store.list("budgets", { eq: { month: to } });
      const missing = src.filter((b) => !dst.some((d) => d.category_id === b.category_id));
      if (!missing.length) return { created: 0 };
      const rows = await store.insert("budgets", missing.map((b) => ({ month: to, category_id: b.category_id, amount_minor: b.amount_minor, alert_thresholds: b.alert_thresholds })));
      return { created: rows.length };
    },
  }),

  "budgets.applySuggestion": defineOp({
    name: "budgets.applySuggestion", mutation: true,
    input: z.object({ month: monthStart, allocations: z.array(z.object({ category_id: uuid, amount_minor: amountMinor })).min(1).max(40) }),
    run: async ({ store }, { month, allocations }) => {
      const existing = await store.list("budgets", { eq: { month } });
      const fresh = allocations.filter((a) => !existing.some((b) => b.category_id === a.category_id));
      if (fresh.length) await store.insert("budgets", fresh.map((a) => ({ month, ...a })));
      return { created: fresh.length, skipped: allocations.length - fresh.length };
    },
  }),

  "forecast.get": defineOp({
    name: "forecast.get", mutation: false, input: z.object({ horizonDays: z.number().int().min(7).max(365).default(30) }),
    run: async ({ store, today }, { horizonDays }) => {
      const s = await loadSnapshot(store, today);
      const result = forecast(s, horizonDays);
      const historyFrom = addMonths(today, -1);
      const { balanceSeries } = await import("./balances");
      return { ...result, history: balanceSeries(s.accounts, s.transactions, historyFrom, today, { excludeSavings: true }), hasData: s.accounts.length > 0 };
    },
  }),

  "analytics.get": defineOp({
    name: "analytics.get", mutation: false, input: z.object({ months: z.number().int().min(3).max(24).default(6), accountId: uuid.optional() }),
    run: async ({ store, today }, { months, accountId }) => {
      const full = await loadSnapshot(store, today);
      const s = accountId ? { ...full, accounts: full.accounts.filter((a) => a.id === accountId), transactions: full.transactions.filter((t) => t.account_id === accountId) } : full;
      const t = totals(accountBalances(s.accounts, s.transactions, today));
      const series = monthlySeries(s, months);
      const from = series[0]!.month;
      const budgets = series.map((p) => {
        const global = s.budgets.find((b) => b.month === p.month && b.category_id === null);
        const planned = global?.amount_minor ?? s.budgets.filter((b) => b.month === p.month && b.category_id).reduce((a, b) => a + b.amount_minor, 0);
        return { month: p.month, planned, spent: p.expenses };
      });
      let savingsRunning = 0;
      const savings = series.map((p) => ({ month: p.month, delta: p.savingsDelta, cumulative: (savingsRunning += p.savingsDelta) }));
      const f = forecast(s, 90);
      return {
        series, weekly: weeklyExpenses(s, 12), kpis: kpis(s, t.available), breakdown: categoryBreakdown(s, from, today),
        budgets, savings, forecast: f.points.filter((_, i) => i % 3 === 0).map((p) => ({ date: p.date, realistic: p.realistic })),
        accounts: full.accounts.map((a) => ({ id: a.id, name: a.name })),
      };
    },
  }),

  "subscriptions.list": defineOp({
    name: "subscriptions.list", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const [subs, profile, accounts] = await Promise.all([store.list("subscriptions", { order: { column: "service" } }), store.list("profiles", { limit: 1 }), store.list("financial_accounts")]);
      return {
        subscriptions: subs.map((s) => ({ ...s, monthly: monthlyEquivalent(s.amount_minor, s.frequency), annual: annualCost(s.amount_minor, s.frequency), nextPayment: nextPaymentFrom(s, today) })),
        summary: summarizeSubscriptions(subs, today, profile[0]?.monthly_income_minor ?? null),
        accounts: accounts.filter((a) => !a.is_archived).map((a) => ({ id: a.id, name: a.name })),
      };
    },
  }),

  "subscriptions.upsert": defineOp({
    name: "subscriptions.upsert", mutation: true,
    input: z.object({
      id: uuid.optional(), service: text(80, 1), amount_minor: amountMinor, frequency, next_payment_date: isoDate,
      account_id: uuid.nullish(), kind: z.enum(["streaming_video", "streaming_music", "phone", "internet", "cloud", "software", "sport", "press", "insurance", "transport", "other"]),
      status: z.enum(["active", "paused", "cancelled"]).default("active"), match_pattern: optionalText(80),
    }),
    run: async ({ store }, { id, ...input }) => {
      const catSlug = input.kind === "phone" || input.kind === "internet" ? "telephonie" : input.kind === "insurance" ? "assurance" : input.kind === "transport" ? "transport" : "abonnements";
      const cat = (await store.list("transaction_categories")).find((c) => c.slug === catSlug && !c.user_id);
      const row = { ...input, account_id: input.account_id ?? null, category_id: cat?.id ?? null };
      if (id) return store.update("subscriptions", id, row);
      return (await store.insert("subscriptions", [row]))[0]!;
    },
  }),

  "subscriptions.delete": defineOp({
    name: "subscriptions.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("subscriptions", [id]) }),
  }),

  "goals.list": defineOp({
    name: "goals.list", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const s = await loadSnapshot(store, today);
      const t = totals(accountBalances(s.accounts, s.transactions, today));
      const k = kpis(s, t.available);
      const nonEssential = new Set(s.categories.filter((c) => !c.is_essential && c.kind !== "income").map((c) => c.id));
      let ne = 0;
      for (let i = 1; i <= 3; i++) {
        const m = addMonths(startOfMonth(today), -i);
        for (const [cat, v] of spentByCategory(s.transactions, m, endOfMonth(m))) if (cat && nonEssential.has(cat)) ne += v;
      }
      const hours = s.availability?.hours_per_week ? Math.min(20, s.availability.hours_per_week * 2) : 0;
      const rate = s.availability?.min_hourly_rate_minor ?? 0;
      const goals = s.goals.map((g) => {
        const p = goalProgress(g, s.allocations, today);
        return {
          ...p,
          allocations: s.allocations.filter((a) => a.goal_id === g.id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10),
          strategies: goalStrategies({ missing: p.missing, monthsLeft: p.monthsLeft, savingCapacity: k.savingCapacity ?? 0, nonEssentialMonthly: mulDiv(ne, 1, 3), extraHoursPerMonth: hours, hourlyRateMinor: rate }),
        };
      });
      const allocatedTotal = s.allocations.reduce((a, x) => a + x.amount_minor, 0);
      return { goals, savingsAvailable: t.savings, allocatedTotal, savingCapacity: k.savingCapacity };
    },
  }),

  "goals.upsert": defineOp({
    name: "goals.upsert", mutation: true,
    input: z.object({ id: uuid.optional(), name: text(80, 1), description: optionalText(500), kind: z.enum(["computer", "travel", "license", "car", "emergency", "moving", "custom"]), target_minor: amountMinor, target_date: isoDate.nullish(), status: z.enum(["active", "achieved", "archived"]).default("active") }),
    run: async ({ store }, { id, ...input }) => {
      const row = { ...input, target_date: input.target_date ?? null };
      if (id) return store.update("savings_goals", id, row);
      return (await store.insert("savings_goals", [row]))[0]!;
    },
  }),

  "goals.delete": defineOp({
    name: "goals.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("savings_goals", [id]) }),
  }),

  "goals.allocate": defineOp({
    name: "goals.allocate", mutation: true,
    input: z.object({ goal_id: uuid, amount_minor: z.number().int().refine((v) => v !== 0, "Montant non nul").refine((v) => Math.abs(v) <= 99_999_999_999), date: isoDate, note: optionalText(200) }),
    run: async ({ store }, input) => {
      const goal = await store.get("savings_goals", input.goal_id);
      if (!goal) throw new AppError("not_found", "Objectif introuvable");
      const allocs = await store.list("savings_allocations", { eq: { goal_id: goal.id } });
      const current = allocs.reduce((a, x) => a + x.amount_minor, 0);
      if (current + input.amount_minor < 0) throw new AppError("invalid", "Impossible de retirer plus que le montant affecté");
      const [row] = await store.insert("savings_allocations", [input]);
      if (current + input.amount_minor >= goal.target_minor && goal.status === "active") await store.update("savings_goals", goal.id, { status: "achieved" });
      return row!;
    },
  }),
};
