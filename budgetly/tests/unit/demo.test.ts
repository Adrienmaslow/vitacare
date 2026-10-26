import { describe, expect, it } from "vitest";
import { createDemoData, DEMO_USER_ID } from "@/features/demo/seed";
import { LocalStore } from "@/lib/data/local-store";
import { loadSnapshot } from "@/features/finance/snapshot";
import { forecast } from "@/features/forecasts/engine";
import { accountBalances, totals } from "@/features/finance/balances";
import { makeCtx, op, TODAY } from "../helpers/context";

describe("mode démonstration", async () => {
  const data = await createDemoData(TODAY, new Date(`${TODAY}T10:00:00Z`));
  const store = () => new LocalStore(DEMO_USER_ID, structuredClone(data));

  it("respecte le cahier des charges de la démo", async () => {
    expect(data.financial_accounts).toHaveLength(3);
    expect(data.transactions.length).toBeGreaterThanOrEqual(100);
    expect(data.savings_goals).toHaveLength(3);
    expect(data.subscriptions.length).toBeGreaterThanOrEqual(4);
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(6);
  });

  it("est calibrée : fin de mois réaliste ≈ −80 € et solde actuel positif", async () => {
    const s = await loadSnapshot(store(), TODAY);
    const f = forecast(s, 5);
    expect(f.endBalance.realistic).toBeLessThan(0);
    expect(Math.abs(f.endBalance.realistic - -8000)).toBeLessThanOrEqual(3000);
    expect(totals(accountBalances(s.accounts, s.transactions, TODAY)).available).toBeGreaterThan(0);
  });

  it("calibre aussi pour d'autres dates (début et fin de mois)", async () => {
    for (const d of ["2026-11-02", "2026-02-27", "2027-01-15"]) {
      const dd = await createDemoData(d, new Date(`${d}T10:00:00Z`));
      const s = await loadSnapshot(new LocalStore(DEMO_USER_ID, dd), d);
      expect(totals(accountBalances(s.accounts, s.transactions, d)).available).toBeGreaterThanOrEqual(2000);
      expect(s.transactions.length).toBeGreaterThanOrEqual(100);
    }
  });

  it("exécute toutes les opérations principales sur les données de démo", async () => {
    const ctx = makeCtx(store());
    const dash = await op(ctx, "dashboard.get", { period: "30d" });
    expect(dash.hasData).toBe(true);
    expect(dash.cards.forecastEndOfMonth).toBeLessThan(0);
    const plan = await op(ctx, "plan.get", {});
    expect(plan.items.length).toBeGreaterThanOrEqual(3);
    expect(plan.items.length).toBeLessThanOrEqual(5);
    expect(plan.items.some((i) => i.type === "cashflow")).toBe(true);
    const alerts = await op(ctx, "alerts.refresh", {});
    expect(alerts.created).toBeGreaterThan(0);
    const again = await op(ctx, "alerts.refresh", {});
    expect(again.created).toBe(0); // déduplication
    const coach = await op(ctx, "coach.ask", { question: "Est-ce que je peux acheter un ordinateur à 700 € ?" });
    expect(coach.intent).toBe("can_afford");
    const sync = await op(ctx, "recurring.sync", {});
    expect(sync.created).toBe(0); // échéances déjà matérialisées : idempotent
    const earn = await op(ctx, "earn.search", {});
    expect(earn.results.every((r) => r.isExample)).toBe(true);
    const aids = await op(ctx, "aids.list", {});
    expect(aids.aids.length).toBeGreaterThan(5);
    for (const name of ["budgets.get", "forecast.get", "analytics.get", "subscriptions.list", "goals.list", "deals.list", "plan.results", "achievements.get", "notifications.list", "accounts.list"] as const) {
      await op(ctx, name, {} as never);
    }
  });

  it("une modification de transaction modifie réellement les calculs", async () => {
    const ctx = makeCtx(store());
    const before = await op(ctx, "dashboard.get", {});
    const accounts = await op(ctx, "accounts.list", {});
    const checking = accounts.accounts.find((a) => a.type === "checking")!;
    await op(ctx, "transactions.create", { account_id: checking.id, date: TODAY, type: "expense", amount_minor: 4250, label: "CB LIDL" });
    const after = await op(ctx, "dashboard.get", {});
    expect(after.cards.availableBalance).toBe(before.cards.availableBalance - 4250);
    expect(after.cards.monthExpenses).toBe(before.cards.monthExpenses + 4250);
  });
});
