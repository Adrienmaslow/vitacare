import { describe, expect, it } from "vitest";
import { accountBalances, balanceSeries, flows, totals } from "@/features/finance/balances";
import { dashboardCards } from "@/features/finance/dashboard";
import { account, catId, recurring, snapshot, subscription, tx } from "../helpers/factory";

const TODAY = "2026-10-26";

describe("soldes", () => {
  const checking = account({ initial_balance_minor: 10000 });
  const savings = account({ type: "savings", initial_balance_minor: 50000, name: "Livret" });
  const g = "11111111-1111-4111-8111-111111111111";
  const txs = [
    tx({ account_id: checking.id, date: "2026-10-01", type: "income", amount_minor: 120000 }),
    tx({ account_id: checking.id, date: "2026-10-03", amount_minor: 45000 }),
    tx({ account_id: checking.id, date: "2026-10-06", type: "transfer_out", amount_minor: 5000, transfer_group_id: g }),
    tx({ account_id: savings.id, date: "2026-10-06", type: "transfer_in", amount_minor: 5000, transfer_group_id: g }),
    tx({ account_id: checking.id, date: "2026-10-25", amount_minor: 2000, status: "pending" }),
    tx({ account_id: checking.id, date: "2026-10-30", amount_minor: 9999 }),
  ];

  it("calcule solde comptable, en attente, disponible et programmé", () => {
    const [c, s] = accountBalances([checking, savings], txs, TODAY);
    expect(c!.booked).toBe(10000 + 120000 - 45000 - 5000);
    expect(c!.pending).toBe(-2000);
    expect(c!.available).toBe(c!.booked - 2000);
    expect(c!.scheduled).toBe(-9999);
    expect(s!.booked).toBe(55000);
  });

  it("les transferts ne créent ni revenu ni dépense", () => {
    const f = flows(txs, "2026-10-01", TODAY, [checking, savings]);
    expect(f.income).toBe(120000);
    expect(f.expenses).toBe(45000);
    expect(f.savingsDelta).toBe(5000);
  });

  it("le solde total est conservé par un transfert", () => {
    const t = totals(accountBalances([checking, savings], txs, TODAY));
    expect(t.total).toBe(10000 + 50000 + 120000 - 45000);
    expect(t.savings).toBe(55000);
    expect(t.available).toBe(80000 - 2000);
  });

  it("ignore les comptes archivés dans les totaux", () => {
    const archived = account({ initial_balance_minor: 99999, is_archived: true });
    expect(totals(accountBalances([checking, archived], [], TODAY)).total).toBe(10000);
  });

  it("série quotidienne cohérente avec le solde final", () => {
    const series = balanceSeries([checking, savings], txs, "2026-10-01", TODAY);
    expect(series).toHaveLength(26);
    expect(series.at(-1)!.balance).toBe(10000 + 50000 + 120000 - 45000);
  });
});

describe("tableau de bord", () => {
  it("reste à vivre = disponible + revenus attendus − charges fixes restantes, sans double comptage", () => {
    const a = account({ initial_balance_minor: 30000 });
    const rent = recurring({ account_id: a.id, amount_minor: 45000, start_date: "2026-01-28", category_id: catId("logement") });
    const salary = recurring({ account_id: a.id, type: "income", amount_minor: 60000, start_date: "2026-01-29" });
    const netflix = subscription({ amount_minor: 799, next_payment_date: "2026-01-27", account_id: a.id });
    // L'abonnement d'octobre a déjà été payé (rattaché) : il ne doit pas être recompté.
    const paid = tx({ account_id: a.id, date: "2026-10-26", amount_minor: 799, subscription_id: netflix.id });
    const s = snapshot({ today: TODAY, accounts: [a], transactions: [paid], recurring: [rent, salary], subscriptions: [netflix] });
    const c = dashboardCards(s);
    expect(c.availableBalance).toBe(30000 - 799);
    expect(c.fixedChargesRemaining).toBe(45000);
    expect(c.expectedIncomeRemaining).toBe(60000);
    expect(c.leftToLive).toBe(30000 - 799 + 60000 - 45000);
  });
});
