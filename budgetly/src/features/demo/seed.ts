/**
 * Données de démonstration — étudiant fictif de 21 ans (Lyon).
 *
 * Toutes les données sont générées de façon déterministe (graine fixe) relativement
 * à la date du jour, puis insérées via les opérations normales : elles sont donc
 * mathématiquement cohérentes par construction (les soldes sont calculés, pas saisis).
 *
 * Calibrage : le solde initial du compte courant est choisi pour que la prévision
 * réaliste de fin de mois affiche un manque d'environ 80 € (scénario de soutenance).
 * Les opportunités de la démo sont des EXEMPLES explicitement étiquetés.
 */
import { systemCategoryId as cat } from "@/data/categories";
import { addDays, addMonths, endOfMonth, startOfMonth } from "@/lib/dates";
import { LocalStore, emptyData, type LocalData } from "@/lib/data/local-store";
import type { Insert, ISODate } from "@/types/db";
import { forecast } from "../forecasts/engine";
import { loadSnapshot } from "../finance/snapshot";
import { accountBalances, totals } from "../finance/balances";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_TARGET_SHORTFALL_MINOR = -8000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IDS = {
  checking: "21111111-1111-4111-8111-000000000001",
  savings: "21111111-1111-4111-8111-000000000002",
  cash: "21111111-1111-4111-8111-000000000003",
  recSalary: "31111111-1111-4111-8111-000000000001",
  recFamily: "31111111-1111-4111-8111-000000000002",
  recApl: "31111111-1111-4111-8111-000000000003",
  recRent: "31111111-1111-4111-8111-000000000004",
  recTransport: "31111111-1111-4111-8111-000000000005",
  recSaving: "31111111-1111-4111-8111-000000000006",
  subPhone: "41111111-1111-4111-8111-000000000001",
  subMusic: "41111111-1111-4111-8111-000000000002",
  subVideo1: "41111111-1111-4111-8111-000000000003",
  subVideo2: "41111111-1111-4111-8111-000000000004",
  subInsurance: "41111111-1111-4111-8111-000000000005",
  goalLaptop: "51111111-1111-4111-8111-000000000001",
  goalLicense: "51111111-1111-4111-8111-000000000002",
  goalEmergency: "51111111-1111-4111-8111-000000000003",
};

const day = (month: ISODate, d: number): ISODate => {
  const last = Number(endOfMonth(month).slice(8, 10));
  return `${month.slice(0, 8)}${String(Math.min(d, last)).padStart(2, "0")}`;
};

/** Construit toutes les lignes de démonstration (sans les insérer). */
export function buildDemoRows(today: ISODate, initialCheckingMinor: number) {
  const rnd = mulberry32(20261026);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const amount = (min: number, max: number) => Math.round((min + rnd() * (max - min)) / 10) * 10;
  const historyStart = startOfMonth(addMonths(today, -5));

  const accounts: Insert<"financial_accounts">[] = [
    { id: IDS.checking, name: "Compte courant", type: "checking", initial_balance_minor: initialCheckingMinor, color: "#7357F6", icon: "landmark" },
    { id: IDS.savings, name: "Livret A", type: "savings", initial_balance_minor: 60000, color: "#22C55E", icon: "piggy-bank" },
    { id: IDS.cash, name: "Espèces", type: "cash", initial_balance_minor: 4000, color: "#F59E0B", icon: "banknote" },
  ];

  const recurring: Insert<"recurring_transactions">[] = [
    { id: IDS.recFamily, account_id: IDS.checking, label: "VIR SOUTIEN FAMILIAL", type: "income", amount_minor: 40000, category_id: cat("soutien-familial"), frequency: "monthly", start_date: day(historyStart, 1), next_date: day(historyStart, 1) },
    { id: IDS.recRent, account_id: IDS.checking, label: "PRLV LOYER STUDIO", type: "expense", amount_minor: 45000, category_id: cat("logement"), frequency: "monthly", start_date: day(historyStart, 3), next_date: day(historyStart, 3) },
    { id: IDS.recTransport, account_id: IDS.checking, label: "PRLV TCL ABONNEMENT", type: "expense", amount_minor: 7500, category_id: cat("transport"), frequency: "monthly", start_date: day(historyStart, 4), next_date: day(historyStart, 4) },
    { id: IDS.recSalary, account_id: IDS.checking, label: "VIR SALAIRE JOB ETUDIANT", type: "income", amount_minor: 60000, category_id: cat("salaire"), frequency: "monthly", start_date: day(historyStart, 10), next_date: day(historyStart, 10) },
    { id: IDS.recApl, account_id: IDS.checking, label: "VIR CAF APL", type: "income", amount_minor: 20000, category_id: cat("aides"), frequency: "monthly", start_date: day(historyStart, 5), next_date: day(historyStart, 5) },
  ];

  const subscriptions: Insert<"subscriptions">[] = [
    { id: IDS.subPhone, service: "Free Mobile", amount_minor: 1699, frequency: "monthly", next_payment_date: day(historyStart, 12), account_id: IDS.checking, category_id: cat("telephonie"), kind: "phone", match_pattern: "FREE MOBILE" },
    { id: IDS.subMusic, service: "Spotify", amount_minor: 599, frequency: "monthly", next_payment_date: day(historyStart, 15), account_id: IDS.checking, category_id: cat("abonnements"), kind: "streaming_music", match_pattern: "SPOTIFY" },
    { id: IDS.subVideo1, service: "Netflix", amount_minor: 799, frequency: "monthly", next_payment_date: day(historyStart, 18), account_id: IDS.checking, category_id: cat("abonnements"), kind: "streaming_video", match_pattern: "NETFLIX" },
    { id: IDS.subVideo2, service: "Disney+", amount_minor: 599, frequency: "monthly", next_payment_date: day(historyStart, 20), account_id: IDS.checking, category_id: cat("abonnements"), kind: "streaming_video", match_pattern: "DISNEY" },
    { id: IDS.subInsurance, service: "Assurance habitation", amount_minor: 8900, frequency: "yearly", next_payment_date: addDays(today, 9), account_id: IDS.checking, category_id: cat("assurance"), kind: "insurance", match_pattern: "ASSURANCE HABITATION" },
  ];

  const txs: Insert<"transactions">[] = [];
  const add = (t: Omit<Insert<"transactions">, "source"> & { source?: Insert<"transactions">["source"] }) => {
    if (t.date <= today) txs.push({ source: "demo", ...t });
  };

  for (let m = 0; m < 6; m++) {
    const month = addMonths(historyStart, m);
    const isCurrent = m === 5;
    // Échéances récurrentes (matérialisées, liées pour éviter tout double comptage dans les prévisions)
    for (const r of recurring) {
      add({ account_id: r.account_id, date: day(month, Number(r.start_date.slice(8, 10))), type: r.type, amount_minor: r.amount_minor, label: r.label, category_id: r.category_id, recurring_id: r.id!, source: "recurring" });
    }
    for (const s of subscriptions.filter((x) => x.frequency === "monthly")) {
      add({ account_id: IDS.checking, date: day(month, Number(s.next_payment_date.slice(8, 10))), type: "expense", amount_minor: s.amount_minor, label: `PRLV ${s.match_pattern}`, category_id: s.category_id!, subscription_id: s.id! });
    }
    // Épargne mensuelle : transfert vers le Livret A
    const tDate = day(month, 6);
    if (tDate <= today) {
      const g = `61111111-1111-4111-8111-0000000000${String(10 + m)}`;
      add({ account_id: IDS.checking, date: tDate, type: "transfer_out", amount_minor: 8000, label: "Virement vers Livret A", transfer_group_id: g, category_id: cat("autres") });
      add({ account_id: IDS.savings, date: tDate, type: "transfer_in", amount_minor: 8000, label: "Virement vers Livret A", transfer_group_id: g, category_id: cat("autres") });
    }
    // Courses (~220 €)
    const groceries = ["CB CARREFOUR CITY", "CB LIDL", "CB MONOPRIX", "CB CARREFOUR MARKET", "CB BIOCOOP", "CB FRANPRIX"];
    for (const d of [2, 6, 10, 14, 18, 22, 26, 29]) add({ account_id: IDS.checking, date: day(month, d), type: "expense", amount_minor: amount(2200, 3300), label: pick(groceries), category_id: cat("alimentation") });
    // Loisirs (~130 €)
    const leisure = ["CB UGC CINE CITE", "CB BAR LE FLORIAN", "CB FNAC SPECTACLES", "CB BOWLING LYON", "CB ESCAPE GAME"];
    for (const d of [7, 13, 20, 27]) add({ account_id: IDS.checking, date: day(month, d), type: "expense", amount_minor: amount(2400, 4000), label: pick(leisure), category_id: cat("loisirs") });
    // Restaurants & CROUS
    for (const d of [3, 9, 16, 21, 25]) add({ account_id: IDS.checking, date: day(month, d), type: "expense", amount_minor: amount(900, 2200), label: pick(["CB CROUS LYON", "CB CROUS LYON", "CB MCDONALD'S", "CB SUSHI SHOP", "CB BOULANGERIE PAUL"]), category_id: cat("restaurants") });
    // Shopping & divers
    add({ account_id: IDS.checking, date: day(month, 11), type: "expense", amount_minor: amount(2000, 5500), label: pick(["CB DECATHLON", "CB H&M", "CB AMAZON", "CB ACTION"]), category_id: cat("shopping") });
    add({ account_id: IDS.checking, date: day(month, 19), type: "expense", amount_minor: amount(600, 1600), label: pick(["CB PHARMACIE BELLECOUR", "CB DOCTOLIB"]), category_id: cat("sante") });
    add({ account_id: IDS.checking, date: day(month, 24), type: "expense", amount_minor: amount(1500, 3500), label: pick(["CB COIFFEUR", "CB CADEAU ANNIVERSAIRE", "CB LIBRAIRIE GIBERT"]), category_id: cat("autres") });
    add({ account_id: IDS.checking, date: day(month, 15), type: "expense", amount_minor: amount(1200, 2800), label: pick(["CB BUREAU VALLEE", "CB LIBRAIRIE DECITRE", "CB PAPETERIE"]), category_id: cat("etudes") });
    if (m % 2 === 1) add({ account_id: IDS.checking, date: day(month, 17), type: "expense", amount_minor: amount(1800, 3500), label: "CB BLABLACAR", category_id: cat("transport") });
    // Espèces : retrait et petites dépenses
    if (m % 2 === 0) add({ account_id: IDS.cash, date: day(month, 8), type: "expense", amount_minor: amount(500, 1200), label: "Marché de la Croix-Rousse", category_id: cat("alimentation") });
    // Revenu ponctuel (garde d'enfant) certains mois
    if (m === 2) add({ account_id: IDS.checking, date: day(month, 21), type: "income", amount_minor: 4500, label: "VIR BABYSITTING FAMILLE M", category_id: cat("missions") });
    // Mois en cours : dépenses exceptionnelles qui créent le risque de fin de mois
    if (isCurrent) {
      add({ account_id: IDS.checking, date: day(month, Math.min(Number(today.slice(8, 10)), 12)), type: "expense", amount_minor: 18900, label: "CB REPARATION ORDINATEUR", category_id: cat("etudes") });
      add({ account_id: IDS.checking, date: day(month, Math.min(Number(today.slice(8, 10)), 14)), type: "expense", amount_minor: 7400, label: "CB SNCF CONNECT BILLETS", category_id: cat("transport") });
    }
  }
  // Deux opérations non catégorisées pour illustrer la catégorisation manuelle
  add({ account_id: IDS.checking, date: addDays(today, -2), type: "expense", amount_minor: 1250, label: "PAIEMENT LYDIA M DURAND" });
  add({ account_id: IDS.checking, date: addDays(today, -1), type: "expense", amount_minor: 890, label: "CB SUMUP *ASSO BDE" });

  const curMonth = startOfMonth(today);
  const budgets: Insert<"budgets">[] = [];
  for (const mm of [addMonths(curMonth, -2), addMonths(curMonth, -1), curMonth]) {
    budgets.push(
      { month: mm, category_id: null, amount_minor: 110000 },
      { month: mm, category_id: cat("alimentation"), amount_minor: 25000 },
      { month: mm, category_id: cat("transport"), amount_minor: 8000 },
      { month: mm, category_id: cat("loisirs"), amount_minor: 10000 },
      { month: mm, category_id: cat("shopping"), amount_minor: 7000 },
      { month: mm, category_id: cat("abonnements"), amount_minor: 4000 },
      { month: mm, category_id: cat("restaurants"), amount_minor: 6000 },
    );
  }

  const goals: Insert<"savings_goals">[] = [
    { id: IDS.goalLaptop, name: "Ordinateur portable", description: "Remplacer mon vieux PC pour la rentrée prochaine", kind: "computer", target_minor: 90000, target_date: addMonths(today, 7) },
    { id: IDS.goalLicense, name: "Permis de conduire", description: "Code + 20 heures de conduite", kind: "license", target_minor: 120000, target_date: addMonths(today, 14) },
    { id: IDS.goalEmergency, name: "Épargne de précaution", description: "Un coussin pour les imprévus", kind: "emergency", target_minor: 50000, target_date: null },
  ];
  const allocations: Insert<"savings_allocations">[] = [];
  for (let m = 0; m < 4; m++) {
    const d = day(addMonths(historyStart, m + 1), 7);
    if (d <= today) allocations.push({ goal_id: IDS.goalLaptop, amount_minor: 8000, date: d, note: "Versement mensuel" });
  }
  allocations.push({ goal_id: IDS.goalLaptop, amount_minor: 2000, date: addDays(today, -20), note: null });
  allocations.push({ goal_id: IDS.goalLicense, amount_minor: 15000, date: addMonths(today, -3), note: "Cadeau d'anniversaire" });
  allocations.push({ goal_id: IDS.goalEmergency, amount_minor: 20000, date: addMonths(today, -4), note: null });

  return { accounts, recurring, subscriptions, txs, budgets, goals, allocations };
}

async function insertAll(store: LocalStore, rows: ReturnType<typeof buildDemoRows>) {
  await store.insert("financial_accounts", rows.accounts);
  await store.insert("recurring_transactions", rows.recurring);
  await store.insert("subscriptions", rows.subscriptions);
  await store.insert("transactions", rows.txs);
  await store.insert("budgets", rows.budgets);
  await store.insert("savings_goals", rows.goals);
  await store.insert("savings_allocations", rows.allocations);
}

/** Crée un jeu de données de démonstration complet pour la date donnée. */
export async function createDemoData(today: ISODate, now: Date = new Date()): Promise<LocalData> {
  // Calibrage : la prévision est linéaire en fonction du solde initial du compte courant.
  const probe = new LocalStore(DEMO_USER_ID, emptyData(), undefined, () => now);
  await insertAll(probe, buildDemoRows(today, 0));
  await probe.upsert("profiles", [{ monthly_income_minor: 120000, safety_threshold_minor: 5000 }], ["user_id"]);
  const snap = await loadSnapshot(probe, today);
  const eomDays = Math.max(1, Number(endOfMonth(today).slice(8, 10)) - Number(today.slice(8, 10)));
  const end0 = forecast(snap, eomDays).endBalance.realistic;
  const avail0 = totals(accountBalances(snap.accounts, snap.transactions, today)).available;
  // Solde de départ : fin de mois ≈ −80 € tout en gardant un solde actuel ≥ 20 €.
  const initial = Math.max(DEMO_TARGET_SHORTFALL_MINOR - end0, 2000 - avail0);

  const store = new LocalStore(DEMO_USER_ID, emptyData(), undefined, () => now);
  await insertAll(store, buildDemoRows(today, initial));
  await store.upsert("profiles", [{
    display_name: "Léa (démo)", status: "working_student", age_range: "21_25", city: "Lyon", region: "Auvergne-Rhône-Alpes",
    institution_type: "university", study_level: "bac_3", housing: "private_rent", monthly_income_minor: 120000, fixed_income_minor: 120000,
    variable_income_minor: 0, family_support_minor: 40000, has_scholarship: false, receives_housing_aid: true, has_professional_income: true,
    current_aids: ["apl"], objectives: ["avoid_overdraft", "save", "find_job", "discover_aids"], safety_threshold_minor: 5000, onboarding_step: 7,
    onboarding_completed_at: now.toISOString(),
  }], ["user_id"]);
  await store.upsert("user_preferences", [{ opportunities_enabled: true, gamification_enabled: true }], ["user_id"]);
  await store.upsert("availability_preferences", [{
    days: ["wed", "sat", "sun"], hours_per_week: 8, weekend_ok: true, mobility: "public_transport", radius_km: 10, remote_ok: true,
    preferred_categories: ["cours", "evenementiel", "contenu"], skills: ["mathématiques", "accueil", "rédaction"], min_hourly_rate_minor: 1100,
  }], ["user_id"]);
  await store.insert("user_consents", [{ purpose: "opportunity_matching", granted: true, policy_version: "2026-10-26" }, { purpose: "aid_eligibility", granted: true, policy_version: "2026-10-26" }]);
  await store.insert("user_aid_applications", [
    { aid_slug: "apl", status: "granted", amount_received_minor: 20000, notes: "Versée chaque mois par la CAF (exemple de démonstration)." },
    { aid_slug: "aide-urgence-crous", status: "to_check", notes: null },
  ]);
  await store.insert("job_applications", [
    { provider: "demo", external_id: "ex-1", is_example: true, title: "Hôte·sse d'accueil pour un salon étudiant (exemple)", employer: "Exemple — Agence événementielle", location: "Lyon 7e", category: "evenementiel", pay_label: "≈ 12 €/h brut (exemple)", status: "applied", applied_at: addDays(today, -1) },
    { provider: "demo", external_id: "ex-2", is_example: true, title: "Cours particuliers de mathématiques niveau lycée (exemple)", employer: "Exemple — Particulier", location: "Lyon 3e", category: "cours", pay_label: "≈ 18 €/h (exemple)", status: "saved" },
  ]);
  await store.insert("earning_targets", [{ monthly_target_minor: 15000 }]);
  await store.insert("financial_simulations", [{ name: "Et si je donnais 8 h de cours par mois ?", params: { extraHoursPerMonth: 8, hourlyRateMinor: 1800, horizonMonths: 3 } }]);
  await store.insert("shopping_list_items", [
    { name: "Pâtes complètes 1 kg", quantity: 2, estimated_unit_minor: 189 },
    { name: "Œufs x12", quantity: 1, estimated_unit_minor: 349 },
    { name: "Lentilles corail", quantity: 1, estimated_unit_minor: 259 },
    { name: "Légumes de saison", quantity: 1, estimated_unit_minor: 600 },
  ]);
  return store.snapshot();
}
