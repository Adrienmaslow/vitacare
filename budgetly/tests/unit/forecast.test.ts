import { describe, expect, it } from "vitest";
import { estimateVariableSpend, forecast } from "@/features/forecasts/engine";
import { addDays } from "@/lib/dates";
import { account, recurring, snapshot, tx } from "../helpers/factory";

const TODAY = "2026-10-26";

function history(accountId: string, days: number, perDay: number) {
  return Array.from({ length: days }, (_, i) => tx({ account_id: accountId, date: addDays(TODAY, -i), amount_minor: perDay }));
}

describe("moteur de prévision", () => {
  it("estime la dépense variable quotidienne en excluant les échéances", () => {
    const a = account();
    const rec = recurring({ account_id: a.id, amount_minor: 45000, start_date: "2026-10-03" });
    const txs = [...history(a.id, 30, 1000), tx({ account_id: a.id, date: "2026-10-03", amount_minor: 45000, recurring_id: rec.id })];
    const v = estimateVariableSpend(snapshot({ today: TODAY, accounts: [a], transactions: txs, recurring: [rec] }));
    expect(v.observedDays).toBe(30);
    expect(v.dailyMinor).toBe(1000);
    expect(v.sufficient).toBe(true);
  });

  it("projette jour par jour avec trois scénarios ordonnés", () => {
    const a = account({ initial_balance_minor: 100000 });
    const s = snapshot({ today: TODAY, accounts: [a], transactions: history(a.id, 60, 1000) });
    const f = forecast(s, 10);
    expect(f.points).toHaveLength(11);
    expect(f.startingBalance).toBe(100000 - 60000);
    expect(f.endBalance.realistic).toBe(40000 - 10 * 1000);
    expect(f.endBalance.optimistic).toBe(40000 - 10 * 850);
    expect(f.endBalance.pessimistic).toBe(40000 - 10 * 1200);
    expect(f.endBalance.optimistic).toBeGreaterThan(f.endBalance.realistic);
  });

  it("détecte le seuil de sécurité et la date de découvert", () => {
    const a = account({ initial_balance_minor: 30000 });
    const rent = recurring({ account_id: a.id, amount_minor: 45000, start_date: "2026-11-03" });
    const s = snapshot({ today: TODAY, accounts: [a], transactions: history(a.id, 30, 500), recurring: [rent] });
    const f = forecast(s, 15);
    expect(f.overdraftDate).toBe("2026-11-03");
    expect(f.belowThresholdDate! <= "2026-11-03").toBe(true);
    expect(f.largeUpcoming.length).toBeGreaterThanOrEqual(0);
  });

  it("ne compte jamais de revenu non déclaré comme récurrent", () => {
    const a = account({ initial_balance_minor: 10000 });
    const s = snapshot({ today: TODAY, accounts: [a], transactions: [tx({ account_id: a.id, date: "2026-10-10", type: "income", amount_minor: 50000 })] });
    const f = forecast(s, 30);
    expect(f.expectedIncome).toBe(0);
  });

  it("n'utilise pas les comptes d'épargne comme solde de départ", () => {
    const c = account({ initial_balance_minor: 1000 });
    const sv = account({ type: "savings", initial_balance_minor: 500000 });
    expect(forecast(snapshot({ today: TODAY, accounts: [c, sv] }), 5).startingBalance).toBe(1000);
  });

  it("indique une fiabilité faible sans historique", () => {
    const f = forecast(snapshot({ today: TODAY, accounts: [account()] }), 5);
    expect(f.reliability.level).toBe("low");
    expect(f.variable.sufficient).toBe(false);
  });
});
