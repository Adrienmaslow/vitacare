import { describe, expect, it } from "vitest";
import { createDemoData, DEMO_USER_ID } from "@/features/demo/seed";
import { LocalStore } from "@/lib/data/local-store";
import { loadSnapshot } from "@/features/finance/snapshot";
import { computeAlerts, selectNewAlerts, type Alert } from "@/features/alerts/engine";
import { buildPlan, generateCandidates, planResults, scoreCandidate, type ActionCandidate } from "@/features/action-plan/engine";
import { answer, detectIntent, extractAmount, extractMonths } from "@/features/coach/engine";
import { monthlyNetDelta, simulate, DEFAULT_SIMULATION } from "@/features/simulations/engine";
import { evaluateAid } from "@/features/aids/eligibility";
import { AIDS } from "@/data/aids";
import { compareCosts } from "@/features/deals/compare";
import { profitability, scoreOpportunity } from "@/features/earn/service";
import { DemoOpportunityProvider } from "@/features/earn/providers/demo";
import { mapOffer, parseHourlyRate } from "@/features/earn/providers/france-travail";
import { account, snapshot } from "../helpers/factory";
import type { ActionItemRow, AvailabilityRow } from "@/types/db";

const TODAY = "2026-10-26";
const demoSnapshot = async () => loadSnapshot(new LocalStore(DEMO_USER_ID, await createDemoData(TODAY, new Date(`${TODAY}T10:00:00Z`))), TODAY);

describe("alertes", () => {
  it("détecte risque de découvert, budgets et renouvellement sur la démo", async () => {
    const kinds = new Set(computeAlerts(await demoSnapshot()).map((a) => a.kind));
    for (const k of ["overdraft_risk", "budget_over", "subscription_renewal", "low_balance"]) expect(kinds.has(k as Alert["kind"])).toBe(true);
  });

  it("anti-spam : déduplication, préférences, plafond, critique toujours transmise", () => {
    const mk = (k: string, p: Alert["priority"]): Alert => ({ kind: "budget_near", title: k, body: "", priority: p, dedupKey: k, actionLabel: "", actionHref: "/app" });
    const list = [mk("a", "critical"), mk("b", "high"), mk("c", "medium"), mk("d", "low"), mk("a", "critical")];
    expect(selectNewAlerts(list, new Set(["b"]), 0).map((a) => a.dedupKey)).toEqual(["a", "c", "d"]);
    expect(selectNewAlerts(list, new Set(), 6).map((a) => a.dedupKey)).toEqual(["a"]);
    expect(selectNewAlerts(list, new Set(), 0, { minPriority: "high" }).map((a) => a.dedupKey)).toEqual(["a", "b"]);
    expect(selectNewAlerts(list, new Set(), 0, { disabledKinds: ["budget_near"] })).toEqual([]);
  });
});

describe("plan d'action", () => {
  it("produit 3 à 5 actions explicables, diversifiées, avec aide et revenus sur la démo", async () => {
    const s = await demoSnapshot();
    const plan = buildPlan({ snapshot: s, aidApplications: [], objectives: s.profile!.objectives });
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(plan[0]!.type).toBe("cashflow");
    const types = plan.map((p) => p.type);
    expect(types).toContain("aid");
    expect(types).toContain("earn");
    // Pas d'incitation à épargner pendant un risque de découvert.
    expect(types).not.toContain("goal");
    for (const a of plan) {
      expect(a.priority).toBe(Object.values(a.breakdown).reduce((x, y) => x + y, 0));
      expect(a.rationale.length).toBeGreaterThan(10);
    }
    // Tri décroissant
    expect([...plan].sort((a, b) => b.priority - a.priority)).toEqual(plan);
  });

  it("le plafond quotidien n'inclut que les revenus du mois en cours", async () => {
    const cash = generateCandidates({ snapshot: await demoSnapshot(), aidApplications: [] }).find((c) => c.type === "cashflow")!;
    expect(cash.title).toContain("4,60");
  });

  it("score : préférences et rejets", () => {
    const c: ActionCandidate = { key: "k", type: "aid", title: "t", description: "d", rationale: "r", impactMinor: 12000, impactKind: "potential", timeMinutes: 5, source: "s", confidence: "high", validUntil: null, href: "/app", ctaLabel: "x", urgency: 50, relevance: 20 };
    const s = scoreCandidate(c, { monthlyIncome: 120000, dismissedTypes: [], preferredTypes: ["aid"] });
    expect(s.breakdown).toEqual({ urgency: 30, impact: 25, feasibility: 15, confidence: 15, relevance: 10, preference: 5 });
    expect(scoreCandidate(c, { monthlyIncome: 120000, dismissedTypes: ["aid"], preferredTypes: [] }).breakdown.preference).toBe(0);
  });

  it("sans compte : une seule action d'initialisation", () => {
    const c = generateCandidates({ snapshot: snapshot({ today: TODAY }), aidApplications: [] });
    expect(c.map((x) => x.key)).toEqual(["setup:first-account"]);
  });

  it("résultats : réalisations séparées des projections", () => {
    const item = (p: Partial<ActionItemRow>) => ({ status: "todo", impact_minor: null, impact_kind: null, realized_minor: null, realized_kind: null, ...p }) as ActionItemRow;
    const r = planResults([item({ status: "done", realized_minor: 2000, realized_kind: "saving" }), item({ impact_minor: 5000, impact_kind: "potential" }), item({ status: "done", realized_minor: 7500, realized_kind: "extra_income" })]);
    expect(r.realized).toEqual({ savings: 2000, extraIncome: 7500, aidsReceived: 0 });
    expect(r.projected).toBe(5000);
  });
});

describe("coach", () => {
  it.each([
    ["Combien puis-je encore dépenser cette semaine ?", "spend_capacity"],
    ["Pourquoi ai-je autant dépensé ce mois-ci ?", "why_spent"],
    ["Est-ce que je peux acheter un ordinateur à 700 € ?", "can_afford"],
    ["Comment économiser 300 € en deux mois ?", "save_target"],
    ["Quels abonnements pourrais-je comparer ?", "subscriptions"],
    ["Quelles aides devrais-je vérifier ?", "aids"],
    ["Comment trouver un complément de revenu ?", "extra_income"],
    ["Quelle mission pourrait correspondre à mes disponibilités ?", "extra_income"],
    ["Comment éviter d'être à découvert ?", "overdraft"],
    ["Quel plan suivre pour atteindre mon objectif ?", "goal_plan"],
    ["Bonjour", "help"],
  ])("%s → %s", (q, intent) => expect(detectIntent(q)).toBe(intent));

  it("extraction des montants et durées", () => {
    expect(extractAmount("acheter un PC à 1 200 €")).toBe(120000);
    expect(extractAmount("économiser 300 euros")).toBe(30000);
    expect(extractMonths("en deux mois")).toBe(2);
    expect(extractMonths("en 6 mois")).toBe(6);
  });

  it("répond avec des chiffres calculés et des hypothèses", async () => {
    const s = await demoSnapshot();
    const a = answer("Est-ce que je peux acheter un ordinateur à 700 € ?", s);
    expect(a.paragraphs[0]).toMatch(/pas recommandé/);
    expect(a.facts.find((f) => f.label === "Prix")!.value).toBe("700,00 €");
    expect(a.facts.some((f) => f.kind === "estimate")).toBe(true);
    const sv = answer("Comment économiser 300 € en deux mois ?", s);
    expect(sv.facts[0]!.value).toBe("150,00 €");
  });

  it("sans données, ne fabrique aucune réponse chiffrée", () => {
    const a = answer("Combien puis-je dépenser ?", snapshot({ today: TODAY }));
    expect(a.facts).toEqual([]);
    expect(a.paragraphs[0]).toMatch(/pas encore assez de données/);
  });
});

describe("simulateur", () => {
  it("variation nette mensuelle", () => {
    expect(monthlyNetDelta({ ...DEFAULT_SIMULATION, incomeDeltaMinor: 20000, rentDeltaMinor: 10000, extraHoursPerMonth: 8, hourlyRateMinor: 1200 })).toBe(20000 - 10000 + 9600);
  });
  it("un scénario positif améliore la trajectoire sans modifier la base", async () => {
    const s = await demoSnapshot();
    const before = structuredClone(s);
    const r = simulate(s, { ...DEFAULT_SIMULATION, incomeDeltaMinor: 20000, horizonMonths: 3 });
    expect(r.scenario.horizonEnd).toBeGreaterThan(r.baseline.horizonEnd);
    expect(r.series[0]!.scenario).toBe(r.series[0]!.baseline);
    expect(s).toEqual(before);
  });
  it("charge exceptionnelle appliquée à sa date", () => {
    const a = account({ initial_balance_minor: 100000 });
    const r = simulate(snapshot({ today: TODAY, accounts: [a] }), { ...DEFAULT_SIMULATION, exceptionalChargeMinor: 30000, exceptionalChargeDate: "2026-11-10", horizonMonths: 1 });
    expect(r.scenario.horizonEnd).toBe(r.baseline.horizonEnd - 30000);
  });
});

describe("aides", () => {
  const apl = AIDS.find((a) => a.slug === "apl")!;
  it("trois statuts prudents", () => {
    expect(evaluateAid(apl, { housing: "private_rent", receivesHousingAid: false }).status).toBe("potential");
    expect(evaluateAid(apl, { housing: "family", receivesHousingAid: false }).status).toBe("unlikely");
    expect(evaluateAid(apl, {}).status).toBe("unknown");
  });
  it("aucune aide du catalogue n'affiche de montant chiffré non vérifié", () => {
    for (const a of AIDS) {
      expect(a.amountLabel).not.toMatch(/\d+\s?€/);
      expect(a.source.url).toMatch(/^https:\/\//);
      expect(a.source.status).toBe("to_verify");
    }
  });
});

describe("bons plans", () => {
  it("compare des coûts saisis par l'utilisateur", () => {
    const r = compareCosts({ currentMinor: 1699, currentFrequency: "monthly", alternativeMinor: 999, alternativeFrequency: "monthly", switchingCostMinor: 1000 });
    expect(r.monthlySaving).toBe(700);
    expect(r.annualSaving).toBe(8400);
    expect(r.firstYearNet).toBe(7400);
    expect(r.breakEvenMonths).toBe(2);
    expect(r.worthIt).toBe(true);
  });
  it("une offre plus chère n'est jamais présentée comme une économie", () => {
    const r = compareCosts({ currentMinor: 500, currentFrequency: "monthly", alternativeMinor: 7200, alternativeFrequency: "yearly", switchingCostMinor: 0 });
    expect(r.annualSaving).toBe(-1200);
    expect(r.worthIt).toBe(false);
    expect(r.breakEvenMonths).toBeNull();
  });
});

describe("revenus complémentaires", () => {
  it("rentabilité : avant cotisations par défaut, gain horaire réel", () => {
    const r = profitability({ hourlyRateMinor: 1200, workHours: 8, travelHours: 1, travelCostMinor: 420, otherCostsMinor: 0 });
    expect(r.grossMinor).toBe(9600);
    expect(r.netIsBeforeContributions).toBe(true);
    expect(r.contributionsMinor).toBeNull();
    expect(r.netEstimateMinor).toBe(9180);
    expect(r.effectiveHourlyMinor).toBe(1020);
    const withRate = profitability({ hourlyRateMinor: 1200, workHours: 8, travelHours: 0, travelCostMinor: 0, otherCostsMinor: 0, contributionRatePermille: 220 });
    expect(withRate.contributionsMinor).toBe(2112);
  });

  it("score explicable sur 100", async () => {
    const [o] = await new DemoOpportunityProvider(TODAY).search({ category: "cours" });
    const avail: AvailabilityRow = { id: "a", user_id: "u", created_at: "", updated_at: "", days: [], hours_per_week: 8, weekend_ok: true, mobility: "public_transport", radius_km: 10, remote_ok: true, preferred_categories: ["cours"], skills: ["mathématiques"], min_hourly_rate_minor: 1100 };
    const s = scoreOpportunity(o!, avail);
    expect(s.factors.reduce((a, f) => a + f.max, 0)).toBe(100);
    expect(s.score).toBe(s.factors.reduce((a, f) => a + f.points, 0));
    expect(s.score).toBeGreaterThanOrEqual(80);
  });

  it("les exemples de démo sont explicitement étiquetés", async () => {
    const all = await new DemoOpportunityProvider(TODAY).search({});
    expect(all.length).toBeGreaterThan(3);
    for (const o of all) {
      expect(o.isExample).toBe(true);
      expect(o.title).toMatch(/exemple/i);
      expect(o.url).toBeNull();
    }
  });

  it("adaptateur France Travail : conversion d'une offre", () => {
    expect(parseHourlyRate("Horaire de 11.88 Euros sur 12 mois")).toBe(1188);
    expect(parseHourlyRate("Mensuel de 1800 Euros")).toBeNull();
    const o = mapOffer({ id: "123ABC", intitule: "Vendeur H/F", typeContrat: "CDD", salaire: { libelle: "Horaire de 12 Euros" }, lieuTravail: { libelle: "69 - Lyon" }, origineOffre: { urlOrigine: "http://insecure" } }, "2026-10-26T00:00:00Z");
    expect(o).toMatchObject({ provider: "france-travail", isExample: false, hourlyRateMinor: 1200, location: "69 - Lyon" });
    expect(o.url).toBe("https://candidat.francetravail.fr/offres/recherche/detail/123ABC");
  });
});
