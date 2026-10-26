import { describe, expect, it } from "vitest";
import { budgetStatuses, suggestAllocation } from "@/features/budgets/service";
import { goalProgress, goalStrategies, monthsBetween } from "@/features/goals/service";
import { annualCost, monthlyEquivalent, nextPaymentFrom, summarizeSubscriptions } from "@/features/subscriptions/service";
import { account, budget, catId, cats, subscription, tx } from "../helpers/factory";
import type { SavingsAllocationRow, SavingsGoalRow } from "@/types/db";

const TODAY = "2026-10-15";

describe("budgets", () => {
  const a = account();
  const food = catId("alimentation");
  const txs = [
    tx({ account_id: a.id, date: "2026-10-02", amount_minor: 10000, category_id: food }),
    tx({ account_id: a.id, date: "2026-10-10", amount_minor: 8000, category_id: food }),
    tx({ account_id: a.id, date: "2026-09-10", amount_minor: 15000, category_id: food }),
    tx({ account_id: a.id, date: "2026-10-11", amount_minor: 7000, category_id: catId("loisirs") }),
    tx({ account_id: a.id, date: "2026-10-12", type: "transfer_out", amount_minor: 99999, transfer_group_id: "x" }),
    tx({ account_id: a.id, date: "2026-10-13", amount_minor: 5000, category_id: food, status: "pending" }),
  ];
  const statuses = budgetStatuses([budget({ month: "2026-10-01", category_id: food, amount_minor: 25000 }), budget({ month: "2026-10-01", amount_minor: 30000 })], cats, txs, "2026-10-01", TODAY);

  it("calcule consommation, reste, seuil et comparaison", () => {
    const f = statuses.find((s) => s.category?.slug === "alimentation")!;
    expect(f.spent).toBe(18000);
    expect(f.remaining).toBe(7000);
    expect(f.percentUsed).toBe(72);
    expect(f.thresholdReached).toBe(70);
    expect(f.level).toBe("warning");
    expect(f.previousSpent).toBe(15000);
    expect(f.expectedToDate).toBe(Math.round((25000 * 15) / 31));
  });

  it("le budget global exclut transferts et opérations en attente", () => {
    const g = statuses.find((s) => !s.category)!;
    expect(g.spent).toBe(25000);
    expect(g.level).toBe("warning"); // 83 %
  });

  it("suggère une répartition sans réduire les dépenses essentielles", () => {
    const hist = ["2026-07", "2026-08", "2026-09"].flatMap((m) => [
      tx({ account_id: a.id, date: `${m}-05`, amount_minor: 30000, category_id: food }),
      tx({ account_id: a.id, date: `${m}-06`, amount_minor: 30000, category_id: catId("loisirs") }),
    ]);
    const s = suggestAllocation(hist, cats, "2026-10-01", 50000);
    expect(s.monthsObserved).toBe(3);
    const foodAlloc = s.allocations.find((x) => x.categoryId === food)!;
    const leisure = s.allocations.find((x) => x.categoryId === catId("loisirs"))!;
    expect(foodAlloc.suggestedMinor).toBe(30000);
    expect(leisure.suggestedMinor).toBe(15000); // capacité 45 000 − 30 000 essentiels
  });
});

describe("objectifs", () => {
  const goal: SavingsGoalRow = { id: "g", user_id: "u", created_at: "", updated_at: "", name: "PC", description: null, kind: "computer", target_minor: 90000, target_date: "2027-04-15", status: "active" };
  const alloc = (amount: number, date: string): SavingsAllocationRow => ({ id: date, user_id: "u", created_at: "", updated_at: "", goal_id: "g", amount_minor: amount, date, note: null });

  it("calcule manquant, versement nécessaire, rythme et date estimée", () => {
    const p = goalProgress(goal, [alloc(30000, "2026-08-01"), alloc(6000, "2026-10-01")], TODAY);
    expect(p.allocated).toBe(36000);
    expect(p.missing).toBe(54000);
    expect(p.monthsLeft).toBe(6);
    expect(p.requiredMonthly).toBe(9000);
    expect(p.observedMonthly).toBe(12000);
    expect(p.onTrack).toBe(true);
    expect(p.estimatedDate).toBe("2027-03-15");
  });

  it("monthsBetween", () => {
    expect(monthsBetween("2026-10-15", "2027-04-15")).toBe(6);
    expect(monthsBetween("2026-10-15", "2027-04-14")).toBe(5);
  });

  it("propose quatre stratégies dont la combinaison", () => {
    const s = goalStrategies({ missing: 90000, monthsLeft: 6, savingCapacity: 5000, nonEssentialMonthly: 20000, extraHoursPerMonth: 8, hourlyRateMinor: 1200 });
    expect(s.map((x) => x.id)).toEqual(["A", "B", "C", "D"]);
    expect(s[1]!.monthlyCutback).toBe(3000);
    expect(s[2]!.monthlyExtraIncome).toBe(9600);
    expect(s[3]!.months).toBe(Math.ceil(90000 / (5000 + 3000 + 9600)));
    expect(s[3]!.feasible).toBe(true);
    expect(s[0]!.feasible).toBe(false);
  });
});

describe("abonnements", () => {
  it("équivalents mensuels et annuels", () => {
    expect(monthlyEquivalent(1200, "yearly")).toBe(100);
    expect(monthlyEquivalent(1000, "weekly")).toBe(4333);
    expect(annualCost(799, "monthly")).toBe(9588);
  });
  it("prochaine échéance depuis une date passée", () => {
    expect(nextPaymentFrom({ next_payment_date: "2026-08-31", frequency: "monthly" }, "2026-10-15")).toBe("2026-10-31");
  });
  it("résumé et détection des abonnements redondants", () => {
    const sum = summarizeSubscriptions([
      subscription({ amount_minor: 799, next_payment_date: "2026-10-20", kind: "streaming_video" }),
      subscription({ amount_minor: 599, next_payment_date: "2026-11-30", kind: "streaming_video" }),
      subscription({ amount_minor: 8900, next_payment_date: "2026-11-01", frequency: "yearly", kind: "insurance" }),
      subscription({ amount_minor: 999, next_payment_date: "2026-10-20", status: "cancelled" }),
    ], TODAY, 120000);
    expect(sum.activeCount).toBe(3);
    expect(sum.monthlyTotal).toBe(799 + 599 + 742);
    expect(sum.renewingSoon.map((r) => r.subscription.kind)).toEqual(["streaming_video", "insurance"]);
    expect(sum.insights[0]).toContain("2 abonnements de streaming vidéo");
  });
});
