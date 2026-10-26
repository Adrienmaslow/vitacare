import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { executeOp } from "@/lib/ops/execute";
import { registry } from "@/lib/ops/registry";
import { SYSTEM_CATEGORIES } from "@/data/categories";
import { makeCtx, op } from "../helpers/context";

async function setup() {
  const ctx = makeCtx();
  const checking = await op(ctx, "accounts.create", { name: "Courant", type: "checking", initial_balance_minor: 50000 });
  const savings = await op(ctx, "accounts.create", { name: "Livret", type: "savings", initial_balance_minor: 0 });
  return { ctx, checking, savings };
}

describe("opérations métier", () => {
  it("valide les entrées et renvoie des erreurs structurées sans fuite", async () => {
    const ctx = makeCtx();
    const r = await executeOp(ctx, "accounts.create", { name: "", type: "nope", initial_balance_minor: 1.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("invalid");
      expect(Object.keys(r.error.fields ?? {})).toEqual(expect.arrayContaining(["name", "type", "initial_balance_minor"]));
    }
    const nf = await executeOp(ctx, "transactions.create", { account_id: "11111111-1111-4111-8111-111111111111", date: "2026-10-01", type: "expense", amount_minor: 100, label: "x" });
    expect(nf).toEqual({ ok: false, error: { code: "not_found", message: "Compte introuvable" } });
  });

  it("refuse les montants flottants ou négatifs", async () => {
    const { ctx, checking } = await setup();
    for (const amount_minor of [12.5, -100, 0]) {
      const r = await executeOp(ctx, "transactions.create", { account_id: checking.id, date: "2026-10-01", type: "expense", amount_minor, label: "x" });
      expect(r.ok).toBe(false);
    }
  });

  it("ajout d'une transaction : catégorisation automatique et rattachement à l'abonnement", async () => {
    const { ctx, checking } = await setup();
    const sub = await op(ctx, "subscriptions.upsert", { service: "Netflix", amount_minor: 799, frequency: "monthly", next_payment_date: "2026-11-05", kind: "streaming_video", account_id: checking.id });
    const t = await op(ctx, "transactions.create", { account_id: checking.id, date: "2026-10-05", type: "expense", amount_minor: 799, label: "PRLV NETFLIX.COM" });
    expect(t.subscription_id).toBe(sub.id);
    expect(t.category_id).toBe(SYSTEM_CATEGORIES.find((c) => c.slug === "abonnements")!.id);
  });

  it("refuse une catégorie de revenu sur une dépense", async () => {
    const { ctx, checking } = await setup();
    const r = await executeOp(ctx, "transactions.create", { account_id: checking.id, date: "2026-10-05", type: "expense", amount_minor: 100, label: "x", category_id: SYSTEM_CATEGORIES.find((c) => c.slug === "salaire")!.id });
    expect(r.ok).toBe(false);
  });

  it("transfert : deux jambes atomiques, aucun revenu ni dépense, suppression conjointe", async () => {
    const { ctx, checking, savings } = await setup();
    const tr = await op(ctx, "transfers.create", { from_account_id: checking.id, to_account_id: savings.id, amount_minor: 5000, date: "2026-10-10", label: null });
    expect(tr.rows.map((r) => r.type).sort()).toEqual(["transfer_in", "transfer_out"]);
    const dash = await op(ctx, "dashboard.get", {});
    expect(dash.cards.monthIncome).toBe(0);
    expect(dash.cards.monthExpenses).toBe(0);
    expect(dash.cards.totalBalance).toBe(50000);
    expect(dash.cards.savingsAvailable).toBe(5000);
    expect((await executeOp(ctx, "transfers.create", { from_account_id: checking.id, to_account_id: checking.id, amount_minor: 1, date: "2026-10-10" })).ok).toBe(false);
    await op(ctx, "transactions.update", { id: tr.rows[0]!.id, amount_minor: 7000 });
    const legs = (await op(ctx, "transactions.list", { type: "transfer" })).rows;
    expect(legs.every((l) => l.amount_minor === 7000)).toBe(true);
    await op(ctx, "transactions.bulk", { action: "delete", ids: [legs[0]!.id] });
    expect((await op(ctx, "transactions.list", { type: "transfer" })).total).toBe(0);
  });

  it("génération des échéances récurrentes idempotente", async () => {
    const { ctx, checking } = await setup();
    await op(ctx, "recurring.create", { account_id: checking.id, label: "Loyer", type: "expense", amount_minor: 45000, frequency: "monthly", start_date: "2026-08-03" });
    expect((await op(ctx, "recurring.sync", {})).created).toBe(3);
    expect((await op(ctx, "recurring.sync", {})).created).toBe(0);
    const rec = await op(ctx, "recurring.list", {});
    expect(rec[0]!.next_date).toBe("2026-11-03");
    // Les échéances déjà matérialisées ne sont pas recomptées dans les prévisions.
    const f = await op(ctx, "forecast.get", { horizonDays: 30 });
    expect(f.scheduledExpenses).toBe(45000);
  });

  it("import CSV : analyse, doublons, import transactionnel, règles mémorisées et annulation", async () => {
    const { ctx, checking } = await setup();
    await op(ctx, "transactions.create", { account_id: checking.id, date: "2026-10-03", type: "expense", amount_minor: 2340, label: "CB CARREFOUR" });
    const rows = [
      { line: 2, date: "2026-10-03", bookingDate: null, label: "CB CARREFOUR", type: "expense" as const, amount_minor: 2340 },
      { line: 3, date: "2026-10-04", bookingDate: null, label: "CB MYSTERE SARL", type: "expense" as const, amount_minor: 1500 },
      { line: 4, date: "2026-10-05", bookingDate: null, label: "=cmd|' /C calc'!A0", type: "expense" as const, amount_minor: 100 },
    ];
    const a = await op(ctx, "imports.analyze", { account_id: checking.id, rows });
    expect(a.rows.map((r) => r.duplicate)).toEqual(["exact", null, null]);
    expect(a.rows[2]!.label.startsWith("'")).toBe(true);
    const loisirs = SYSTEM_CATEGORIES.find((c) => c.slug === "loisirs")!.id;
    const res = await op(ctx, "imports.commit", {
      account_id: checking.id, filename: "releve.csv", totalRows: 4, errorCount: 1, rememberRules: true,
      // Le client tente d'inclure le doublon exact : le serveur l'écarte quand même.
      rows: a.rows.map((r) => ({ ...r, include: true, category_id: r.line === 3 ? loisirs : r.categorization.categoryId })),
    });
    expect(res.imported).toBe(2);
    expect(res.skippedDuplicates).toBe(1);
    const rules = (await op(ctx, "categories.list", {})).rules;
    expect(rules.some((r) => r.pattern.includes("MYSTERE"))).toBe(true);
    expect((await op(ctx, "transactions.list", {})).total).toBe(3);
    expect((await op(ctx, "imports.revert", { id: res.import.id })).removed).toBe(2);
    expect((await op(ctx, "transactions.list", {})).total).toBe(1);
    expect((await op(ctx, "imports.list", {}))[0]!.status).toBe("reverted");
  });

  it("budgets : création unique par mois et catégorie, duplication", async () => {
    const { ctx } = await setup();
    const food = SYSTEM_CATEGORIES.find((c) => c.slug === "alimentation")!.id;
    await op(ctx, "budgets.upsert", { month: "2026-09-01", category_id: food, amount_minor: 20000 });
    await op(ctx, "budgets.upsert", { month: "2026-09-01", category_id: food, amount_minor: 25000 });
    await op(ctx, "budgets.upsert", { month: "2026-09-01", category_id: null, amount_minor: 90000 });
    expect((await op(ctx, "budgets.duplicate", { from: "2026-09-01", to: "2026-10-01" })).created).toBe(2);
    expect((await op(ctx, "budgets.duplicate", { from: "2026-09-01", to: "2026-10-01" })).created).toBe(0);
    const b = await op(ctx, "budgets.get", { month: "2026-10-01" });
    expect(b.statuses.map((s) => s.budget.amount_minor).sort()).toEqual([25000, 90000]);
    expect((await executeOp(ctx, "budgets.upsert", { month: "2026-10-15", category_id: null, amount_minor: 1 })).ok).toBe(false);
  });

  it("objectifs : affectation, retrait borné, objectif atteint", async () => {
    const { ctx } = await setup();
    const g = await op(ctx, "goals.upsert", { name: "PC", kind: "computer", target_minor: 10000, target_date: "2027-06-01" });
    await op(ctx, "goals.allocate", { goal_id: g.id, amount_minor: 4000, date: "2026-10-01" });
    expect((await executeOp(ctx, "goals.allocate", { goal_id: g.id, amount_minor: -5000, date: "2026-10-02" })).ok).toBe(false);
    await op(ctx, "goals.allocate", { goal_id: g.id, amount_minor: 6000, date: "2026-10-03" });
    const list = await op(ctx, "goals.list", {});
    expect(list.goals[0]!.goal.status).toBe("achieved");
    expect(list.goals[0]!.percent).toBe(100);
  });

  it("candidatures et démarches d'aide", async () => {
    const { ctx } = await setup();
    const app = await op(ctx, "earn.save", { provider: "demo", external_id: "ex-1", is_example: true, title: "Exemple", employer: null, location: null, url: null, category: "cours", pay_label: null });
    await op(ctx, "earn.update", { id: app.id, status: "completed", earned_minor: 7200 });
    expect((await op(ctx, "earn.applications", {})).earnedTotal).toBe(7200);
    expect((await executeOp(ctx, "aids.track", { aid_slug: "inexistante" })).ok).toBe(false);
    await op(ctx, "aids.track", { aid_slug: "apl", status: "granted", amount_received_minor: 20000 });
    const aids = await op(ctx, "aids.list", {});
    expect(aids.receivedTotal).toBe(20000);
    // Une aide potentielle n'est jamais ajoutée au solde.
    expect((await op(ctx, "dashboard.get", {})).cards.availableBalance).toBe(50000);
  });

  it("export des données personnelles", async () => {
    const { ctx } = await setup();
    const e = await op(ctx, "account.export", {});
    expect(e.format).toBe("budgetly-export-v1");
    expect(e.data.financial_accounts).toHaveLength(2);
  });

  it("chaque opération du registre porte un schéma et un nom cohérent", () => {
    for (const [name, def] of Object.entries(registry)) {
      expect(def.name).toBe(name);
      expect(typeof def.input.parse).toBe("function");
    }
  });
});

describe("cohérence des catalogues", () => {
  it("la migration des catégories système est synchronisée avec le code", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261026000300_system_categories.sql", import.meta.url), "utf8");
    for (const c of SYSTEM_CATEGORIES) expect(sql).toContain(`'${c.id}', null, '${c.slug}'`);
  });
});
