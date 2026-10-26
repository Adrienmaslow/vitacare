/**
 * Tests d'intégration sur un vrai PostgreSQL (migrations Supabase + RLS).
 * Prérequis : TEST_DATABASE_URL (npm run db:test:start en local, service PostgreSQL en CI).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { PgStore } from "@/lib/data/pg-store";
import { executeOp } from "@/lib/ops/execute";
import { systemCategoryId } from "@/data/categories";
import { makeCtx, op } from "../helpers/context";
import { asUser, createUser, setupDatabase, TEST_DB_URL } from "./db";

const d = TEST_DB_URL ? describe : describe.skip;
if (!TEST_DB_URL) console.warn("TEST_DATABASE_URL absent : tests d'intégration PostgreSQL ignorés.");

d("PostgreSQL + Row Level Security", () => {
  let pool: Pool;
  let alice: string;
  let bob: string;
  let aliceAccount: string;

  beforeAll(async () => {
    pool = await setupDatabase();
    alice = await createUser(pool, "alice@example.test");
    bob = await createUser(pool, "bob@example.test");
  }, 60_000);
  afterAll(async () => pool?.end());

  it("crée automatiquement profil et préférences à l'inscription", async () => {
    const p = await asUser(pool, alice, "select user_id from profiles");
    expect(p).toEqual([{ user_id: alice }]);
    expect(await asUser(pool, alice, "select count(*)::int as n from user_preferences")).toEqual([{ n: 1 }]);
  });

  it("Alice crée un compte et des opérations via les opérations métier (RLS active)", async () => {
    const ctx = makeCtx(new PgStore(pool, alice));
    const acc = await op(ctx, "accounts.create", { name: "Courant Alice", type: "checking", initial_balance_minor: 100000 });
    aliceAccount = acc.id;
    await op(ctx, "transactions.create", { account_id: acc.id, date: "2026-10-03", type: "expense", amount_minor: 4500, label: "CB CARREFOUR" });
    await op(ctx, "transactions.create", { account_id: acc.id, date: "2026-10-05", type: "income", amount_minor: 60000, label: "VIR SALAIRE" });
    const dash = await op(ctx, "dashboard.get", {});
    expect(dash.cards.availableBalance).toBe(100000 - 4500 + 60000);
    expect(dash.breakdown.items[0]!.name).toBe("Alimentation");
  });

  it("Bob ne voit aucune donnée d'Alice", async () => {
    const bobStore = new PgStore(pool, bob);
    expect(await bobStore.list("financial_accounts")).toEqual([]);
    expect(await bobStore.list("transactions")).toEqual([]);
    expect(await bobStore.get("financial_accounts", aliceAccount)).toBeNull();
    // Même sans le filtre applicatif, RLS bloque la lecture.
    expect(await asUser(pool, bob, "select * from transactions")).toEqual([]);
    expect(await asUser(pool, bob, "select * from profiles where user_id = $1", [alice])).toEqual([]);
  });

  it("Bob ne peut ni modifier, ni supprimer, ni écrire pour Alice", async () => {
    const upd = await asUser(pool, bob, "update financial_accounts set name = 'pirate' where id = $1 returning id", [aliceAccount]);
    expect(upd).toEqual([]);
    const del = await asUser(pool, bob, "delete from transactions where account_id = $1 returning id", [aliceAccount]);
    expect(del).toEqual([]);
    await expect(asUser(pool, bob, "insert into financial_accounts (user_id, name, type) values ($1, 'x', 'checking')", [alice])).rejects.toThrow(/row-level security/);
    // Clé étrangère composite : impossible d'insérer une opération sur le compte d'Alice.
    await expect(asUser(pool, bob, "insert into transactions (user_id, account_id, date, type, amount_minor, label) values ($1, $2, '2026-10-01', 'expense', 100, 'x')", [bob, aliceAccount])).rejects.toThrow();
    const r = await executeOp(makeCtx(new PgStore(pool, bob)), "transactions.create", { account_id: aliceAccount, date: "2026-10-01", type: "expense", amount_minor: 100, label: "x" });
    expect(r.ok).toBe(false);
    const still = await asUser<{ name: string }>(pool, alice, "select name from financial_accounts where id = $1", [aliceAccount]);
    expect(still[0]!.name).toBe("Courant Alice");
  });

  it("le rôle anonyme n'a accès à rien", async () => {
    await expect(asUser(pool, null, "select * from transactions")).rejects.toThrow(/permission denied/);
  });

  it("catégories : système partagées en lecture, personnelles isolées et non réutilisables par autrui", async () => {
    const aliceCat = await op(makeCtx(new PgStore(pool, alice)), "categories.create", { name: "Escalade", kind: "expense" });
    expect((await new PgStore(pool, bob).list("transaction_categories")).some((c) => c.id === aliceCat.id)).toBe(false);
    expect((await new PgStore(pool, bob).list("transaction_categories")).length).toBe(20);
    const bobAcc = await op(makeCtx(new PgStore(pool, bob)), "accounts.create", { name: "Bob", type: "checking" });
    await expect(asUser(pool, bob, "insert into transactions (user_id, account_id, date, type, amount_minor, label, category_id) values ($1, $2, '2026-10-01', 'expense', 100, 'x', $3)", [bob, bobAcc.id, aliceCat.id])).rejects.toThrow(/transactions_category_owner/);
    await expect(asUser(pool, bob, "update transaction_categories set name = 'x' where user_id is null returning id")).resolves.toEqual([]);
  });

  it("contraintes : montants entiers positifs, transferts cohérents, mois de budget", async () => {
    const ins = (sql: string, p: unknown[]) => asUser(pool, alice, sql, p);
    await expect(ins("insert into transactions (user_id, account_id, date, type, amount_minor, label) values ($1,$2,'2026-10-01','expense',-5,'x')", [alice, aliceAccount])).rejects.toThrow(/check/);
    // Valeur transmise comme le fait l'API (paramètre texte) : un montant décimal est refusé par bigint.
    await expect(ins("insert into transactions (user_id, account_id, date, type, amount_minor, label) values ($1,$2,'2026-10-01','expense',$3,'x')", [alice, aliceAccount, "1.5"])).rejects.toThrow(/invalid input syntax/);
    await expect(ins("insert into transactions (user_id, account_id, date, type, amount_minor, label) values ($1,$2,'2026-10-01','transfer_in',100,'x')", [alice, aliceAccount])).rejects.toThrow(/check/);
    await expect(ins("insert into budgets (user_id, month, amount_minor) values ($1,'2026-10-15',100)", [alice])).rejects.toThrow(/check/);
  });

  it("génération d'échéances idempotente au niveau base (index unique)", async () => {
    const ctx = makeCtx(new PgStore(pool, alice));
    await op(ctx, "recurring.create", { account_id: aliceAccount, label: "Loyer", type: "expense", amount_minor: 45000, frequency: "monthly", start_date: "2026-08-03", category_id: systemCategoryId("logement") });
    expect((await op(ctx, "recurring.sync", {})).created).toBe(3);
    expect((await op(ctx, "recurring.sync", {})).created).toBe(0);
    const [rec] = await asUser<{ id: string }>(pool, alice, "select id from recurring_transactions");
    await expect(asUser(pool, alice, "insert into transactions (user_id, account_id, date, type, amount_minor, label, recurring_id) values ($1,$2,'2026-08-03','expense',45000,'Loyer',$3)", [alice, aliceAccount, rec!.id])).rejects.toThrow(/transactions_recurring_once/);
  });

  it("transfert, budgets, import CSV et annulation sur PostgreSQL", async () => {
    const ctx = makeCtx(new PgStore(pool, alice));
    const sav = await op(ctx, "accounts.create", { name: "Livret", type: "savings" });
    const tr = await op(ctx, "transfers.create", { from_account_id: aliceAccount, to_account_id: sav.id, amount_minor: 10000, date: "2026-10-06" });
    expect(tr.rows).toHaveLength(2);
    await op(ctx, "budgets.upsert", { month: "2026-10-01", category_id: systemCategoryId("alimentation"), amount_minor: 5000 });
    await op(ctx, "budgets.upsert", { month: "2026-10-01", category_id: systemCategoryId("alimentation"), amount_minor: 6000 });
    const b = await op(ctx, "budgets.get", { month: "2026-10-01" });
    expect(b.statuses).toHaveLength(1);
    expect(b.statuses[0]!.spent).toBe(4500);
    const rows = [
      { line: 2, date: "2026-10-03", bookingDate: null, label: "CB CARREFOUR", type: "expense" as const, amount_minor: 4500 },
      { line: 3, date: "2026-10-07", bookingDate: "2026-10-08", label: "CB SNCF", type: "expense" as const, amount_minor: 3500 },
    ];
    const a = await op(ctx, "imports.analyze", { account_id: aliceAccount, rows });
    expect(a.rows[0]!.duplicate).toBe("exact");
    const res = await op(ctx, "imports.commit", { account_id: aliceAccount, filename: "releve.csv", totalRows: 2, errorCount: 0, rows: a.rows.map((r) => ({ ...r, include: true, category_id: r.categorization.categoryId })) });
    expect(res.imported).toBe(1);
    expect((await op(ctx, "imports.revert", { id: res.import.id })).removed).toBe(1);
  });

  it("plan d'action, alertes, objectifs, aides et coach fonctionnent de bout en bout", async () => {
    const ctx = makeCtx(new PgStore(pool, alice));
    await op(ctx, "profile.update", { status: "student", age_range: "21_25", housing: "private_rent", receives_housing_aid: false, monthly_income_minor: 60000 });
    const plan = await op(ctx, "plan.get", {});
    expect(plan.items.length).toBeGreaterThanOrEqual(3);
    const again = await op(ctx, "plan.get", {});
    expect(again.items.map((i) => i.id).sort()).toEqual(plan.items.map((i) => i.id).sort());
    await op(ctx, "plan.updateItem", { id: plan.items[0]!.id, status: "done", realized_minor: 1500, realized_kind: "saving" });
    expect((await op(ctx, "plan.results", {})).results.realized.savings).toBe(1500);
    const al = await op(ctx, "alerts.refresh", {});
    expect((await op(ctx, "alerts.refresh", {})).created).toBe(0);
    expect(al.created).toBeGreaterThanOrEqual(0);
    const g = await op(ctx, "goals.upsert", { name: "Voyage", kind: "travel", target_minor: 50000, target_date: "2027-07-01" });
    await op(ctx, "goals.allocate", { goal_id: g.id, amount_minor: 10000, date: "2026-10-10" });
    expect((await op(ctx, "goals.list", {})).goals[0]!.allocated).toBe(10000);
    await op(ctx, "aids.track", { aid_slug: "apl", status: "to_check" });
    expect((await op(ctx, "aids.list", {})).aids.find((x) => x.slug === "apl")!.application!.status).toBe("to_check");
    const c = await op(ctx, "coach.ask", { question: "Quelle est mon solde ?" });
    expect(c.facts.length).toBeGreaterThan(0);
    const exp = await op(ctx, "account.export", {});
    expect((exp.data.audit_events as unknown[]).length).toBeGreaterThan(0);
  });

  it("la suppression du compte utilisateur efface toutes ses données (cascade)", async () => {
    await pool.query("delete from auth.users where id = $1", [alice]);
    const { rows } = await pool.query("select count(*)::int as n from transactions where user_id = $1", [alice]);
    expect(rows[0].n).toBe(0);
    const left = await pool.query("select count(*)::int as n from financial_accounts where user_id = $1", [bob]);
    expect(left.rows[0].n).toBe(1);
  });
});
