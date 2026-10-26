"use client";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { Notice, ProgressBar, Switch } from "@/components/ui/misc";
import { systemCategoryId } from "@/data/categories";
import { OPPORTUNITY_CATEGORIES } from "@/data/job-platforms";
import { AGE_LABELS, HOUSING_LABELS, INSTITUTION_LABELS, LEVEL_LABELS, OBJECTIVE_LABELS, STATUS_LABELS } from "@/features/profile/labels";
import { useOp } from "@/hooks/use-op";
import { callOp, OpError } from "@/lib/ops/client";
import { addMonths, startOfMonth } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { toast } from "sonner";

const STEPS = ["Profil", "Ressources", "Dépenses", "Situation", "Objectifs", "Disponibilités", "Ton espace"];
const EXPENSES = [["rent", "Loyer", "logement"], ["groceries", "Courses", "alimentation"], ["transport", "Transports", "transport"], ["phone", "Téléphone & internet", "telephonie"], ["subs", "Abonnements", "abonnements"], ["insurance", "Assurance", "assurance"], ["studies", "Études", "etudes"], ["other", "Autres charges", "autres"]] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const profile = useOp("profile.get", {});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({
    display_name: "", status: "", age_range: "", city: "", institution_type: "", study_level: "", housing: "",
    fixedIncome: "", variableIncome: "", scholarship: "", aids: "", family: "", incomeDay: "1", hasScholarship: false, housingAid: false,
    exp: Object.fromEntries(EXPENSES.map(([k]) => [k, ""])) as Record<string, string>, rentDay: "5",
    balance: "", savings: "", upcoming: "", commitments: "",
    objectives: [] as string[],
    wantsOpportunities: false, hours: "", weekend: false, cats: [] as string[], skills: "",
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const m = (s: string) => (s.trim() ? parseAmount(s) ?? 0 : 0);
  const totalIncome = m(v.fixedIncome) + m(v.variableIncome) + m(v.scholarship) + m(v.aids) + m(v.family);
  const totalExp = Object.values(v.exp).reduce((s, x) => s + m(x), 0);

  const nextDate = (day: number) => {
    const d = Math.min(28, Math.max(1, day));
    const cand = `${today.slice(0, 8)}${String(d).padStart(2, "0")}`;
    return cand > today ? cand : addMonths(cand, 1);
  };

  const finish = async (skipRest = false) => {
    setBusy(true);
    try {
      await callOp("profile.update", {
        display_name: v.display_name || null, status: (v.status || null) as never, age_range: (v.age_range || null) as never, city: v.city || null,
        institution_type: (v.institution_type || null) as never, study_level: (v.study_level || null) as never, housing: (v.housing || null) as never,
        monthly_income_minor: totalIncome || null, fixed_income_minor: m(v.fixedIncome) || null, variable_income_minor: m(v.variableIncome) || null,
        family_support_minor: m(v.family) || null, has_scholarship: v.hasScholarship || m(v.scholarship) > 0, receives_housing_aid: v.housingAid,
        has_professional_income: m(v.fixedIncome) + m(v.variableIncome) > 0, objectives: v.objectives as never, onboarding_step: 7, complete_onboarding: true,
      });
      if (!skipRest) {
        const existing = await callOp("accounts.list", {});
        let checkingId = existing.accounts.find((a) => a.type === "checking")?.id;
        if (!checkingId && v.balance.trim()) {
          checkingId = (await callOp("accounts.create", { name: "Compte courant", type: "checking", initial_balance_minor: m(v.balance), color: "#7357F6", icon: "landmark" })).id;
        }
        if (m(v.savings) > 0 && !existing.accounts.some((a) => a.type === "savings")) await callOp("accounts.create", { name: "Épargne", type: "savings", initial_balance_minor: m(v.savings), color: "#22C55E", icon: "piggy-bank" });
        if (checkingId) {
          if (m(v.fixedIncome) > 0) await callOp("recurring.create", { account_id: checkingId, label: "Revenu fixe", type: "income", amount_minor: m(v.fixedIncome), frequency: "monthly", start_date: nextDate(Number(v.incomeDay)), category_id: systemCategoryId("salaire") });
          if (m(v.scholarship) > 0) await callOp("recurring.create", { account_id: checkingId, label: "Bourse", type: "income", amount_minor: m(v.scholarship), frequency: "monthly", start_date: nextDate(Number(v.incomeDay)), category_id: systemCategoryId("bourse") });
          if (m(v.exp.rent!) > 0) await callOp("recurring.create", { account_id: checkingId, label: "Loyer", type: "expense", amount_minor: m(v.exp.rent!), frequency: "monthly", start_date: nextDate(Number(v.rentDay)), category_id: systemCategoryId("logement") });
        }
        const month = startOfMonth(today);
        for (const [k, , slug] of EXPENSES) if (m(v.exp[k]!) > 0) await callOp("budgets.upsert", { month, category_id: systemCategoryId(slug), amount_minor: m(v.exp[k]!) }).catch(() => undefined);
        if (v.wantsOpportunities) {
          await callOp("consents.set", { purpose: "opportunity_matching", granted: true });
          await callOp("preferences.update", { opportunities_enabled: true });
          await callOp("availability.upsert", { days: [], hours_per_week: v.hours ? Math.min(60, Number(v.hours)) : null, weekend_ok: v.weekend, mobility: null, radius_km: null, remote_ok: true, preferred_categories: v.cats, skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20), min_hourly_rate_minor: null });
        }
        await callOp("plan.get", { regenerate: true });
      }
      toast.success("Ton espace est prêt !");
      router.replace("/app");
    } catch (e) {
      toast.error(e instanceof OpError ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const sel = (key: keyof typeof v, labels: Record<string, string>, label: string) => (
    <Field label={label} htmlFor={`o-${key}`}><Select id={`o-${key}`} value={v[key] as string} onChange={(e) => setV({ ...v, [key]: e.target.value })}><option value="">— Je préfère ne pas répondre —</option>{Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
  );
  const money = (key: "fixedIncome" | "variableIncome" | "scholarship" | "aids" | "family" | "balance" | "savings" | "upcoming" | "commitments", label: string, hint?: string) => (
    <Field label={label} htmlFor={`o-${key}`} hint={hint}><MoneyInput id={`o-${key}`} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} placeholder="0,00" /></Field>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-semibold text-brand">Étape {step + 1} sur {STEPS.length} · {STEPS[step]}</p>
        <ProgressBar className="mt-2" value={((step + 1) / STEPS.length) * 100} label="Progression de la configuration" />
      </div>
      <Card className="p-6">
        {step === 0 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Faisons connaissance{profile.data?.profile.display_name ? `, ${profile.data.profile.display_name}` : ""} 👋</h1>
            <p className="text-sm text-muted">Quelques informations pour personnaliser tes recommandations. Tout est facultatif et modifiable à tout moment.</p>
            <Field label="Prénom ou pseudo" htmlFor="o-name"><Input id="o-name" value={v.display_name} onChange={(e) => setV({ ...v, display_name: e.target.value })} maxLength={80} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {sel("status", STATUS_LABELS, "Statut")}{sel("age_range", AGE_LABELS, "Tranche d'âge")}
              {sel("institution_type", INSTITUTION_LABELS, "Établissement")}{sel("study_level", LEVEL_LABELS, "Niveau d'études")}
              {sel("housing", HOUSING_LABELS, "Logement")}
              <Field label="Ville ou zone (facultatif)" htmlFor="o-city"><Input id="o-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} maxLength={80} /></Field>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Tes ressources mensuelles</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {money("fixedIncome", "Revenus fixes (salaire, alternance)")}{money("variableIncome", "Revenus variables (missions, extras)")}
              {money("scholarship", "Bourse")}{money("aids", "Aides déjà perçues (APL…)")}{money("family", "Soutien familial")}
              <Field label="Jour de versement habituel" htmlFor="o-iday"><Input id="o-iday" type="number" min={1} max={28} value={v.incomeDay} onChange={(e) => setV({ ...v, incomeDay: e.target.value })} /></Field>
            </div>
            <label className="flex items-center justify-between text-sm"><span>Je suis boursier·e sur critères sociaux</span><Switch label="Boursier" checked={v.hasScholarship} onCheckedChange={(x) => setV({ ...v, hasScholarship: x })} /></label>
            <label className="flex items-center justify-between text-sm"><span>Je perçois une aide au logement</span><Switch label="Aide au logement" checked={v.housingAid} onCheckedChange={(x) => setV({ ...v, housingAid: x })} /></label>
            <Notice>Total mensuel déclaré : <strong>{(totalIncome / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</strong>. Seuls les revenus fixes et la bourse seront utilisés comme revenus attendus dans tes prévisions.</Notice>
          </div>
        ) : step === 2 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Tes dépenses mensuelles</h1>
            <p className="text-sm text-muted">Des estimations suffisent : elles serviront de premiers budgets, ajustables ensuite.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {EXPENSES.map(([k, l]) => <Field key={k} label={l} htmlFor={`o-e-${k}`}><MoneyInput id={`o-e-${k}`} value={v.exp[k]} onChange={(e) => setV({ ...v, exp: { ...v.exp, [k]: e.target.value } })} placeholder="0,00" /></Field>)}
              <Field label="Jour de prélèvement du loyer" htmlFor="o-rday"><Input id="o-rday" type="number" min={1} max={28} value={v.rentDay} onChange={(e) => setV({ ...v, rentDay: e.target.value })} /></Field>
            </div>
            <Notice tone={totalExp > totalIncome && totalIncome > 0 ? "warning" : "neutral"}>Total : {(totalExp / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} / mois{totalExp > totalIncome && totalIncome > 0 ? " — supérieur à tes ressources déclarées : ton plan d'action t'aidera à trouver des solutions." : ""}</Notice>
          </div>
        ) : step === 3 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Ta situation actuelle</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {money("balance", "Solde actuel de ton compte courant", "Négatif si découvert, ex. -30")}{money("savings", "Épargne disponible")}
              {money("upcoming", "Grosses charges à venir (facultatif)", "À ajouter ensuite comme opération future")}{money("commitments", "Remboursements en cours (facultatif)")}
            </div>
            <Notice>Aucune connexion bancaire n'est nécessaire : tu pourras importer un relevé CSV à tout moment.</Notice>
          </div>
        ) : step === 4 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Tes objectifs</h1>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(OBJECTIVE_LABELS).map(([k, l]) => (
                <button type="button" key={k} aria-pressed={v.objectives.includes(k)} onClick={() => setV({ ...v, objectives: v.objectives.includes(k) ? v.objectives.filter((x) => x !== k) : [...v.objectives, k] })}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-left text-sm ${v.objectives.includes(k) ? "border-brand bg-brand-soft" : "border-border"}`}>{l}{v.objectives.includes(k) ? <Check className="size-4 text-brand" /> : null}</button>
              ))}
            </div>
          </div>
        ) : step === 5 ? (
          <div className="grid gap-4">
            <h1 className="text-2xl font-bold">Disponibilités <span className="text-base font-normal text-muted">(facultatif)</span></h1>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Je veux recevoir des suggestions de missions et revenus complémentaires</span><Switch label="Opportunités" checked={v.wantsOpportunities} onCheckedChange={(x) => setV({ ...v, wantsOpportunities: x })} /></label>
            {v.wantsOpportunities ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Heures disponibles par semaine" htmlFor="o-h"><Input id="o-h" type="number" min={0} max={60} value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field><label className="flex items-center justify-between self-end pb-2 text-sm"><span>Disponible le week-end</span><Switch label="Week-end" checked={v.weekend} onCheckedChange={(x) => setV({ ...v, weekend: x })} /></label></div>
                <div className="flex flex-wrap gap-2">{Object.entries(OPPORTUNITY_CATEGORIES).map(([k, l]) => <button type="button" key={k} aria-pressed={v.cats.includes(k)} onClick={() => setV({ ...v, cats: v.cats.includes(k) ? v.cats.filter((x) => x !== k) : [...v.cats, k] })} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs ${v.cats.includes(k) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>{l}</button>)}</div>
                <Field label="Compétences" htmlFor="o-sk" hint="Séparées par des virgules"><Input id="o-sk" value={v.skills} onChange={(e) => setV({ ...v, skills: e.target.value })} /></Field>
                <Notice>Ces informations servent uniquement à trier les offres. Garde du temps pour tes études et ton repos.</Notice>
              </>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 text-center">
            <Sparkles className="mx-auto size-10 text-brand" />
            <h1 className="text-2xl font-bold">Ton tableau de bord personnalisé est prêt</h1>
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-muted">
              {v.balance ? <li>✓ Compte courant créé avec ton solde actuel</li> : <li>• Tu pourras ajouter tes comptes ensuite</li>}
              {m(v.fixedIncome) + m(v.scholarship) > 0 ? <li>✓ Revenus récurrents ajoutés à tes prévisions</li> : null}
              {totalExp > 0 ? <li>✓ Budgets du mois créés à partir de tes dépenses</li> : null}
              <li>✓ Plan d'action de la semaine généré</li>
              {v.wantsOpportunities ? <li>✓ Suggestions d'opportunités activées</li> : null}
            </ul>
            <Button size="lg" onClick={() => finish()} disabled={busy}>{busy ? "Préparation…" : "Découvrir mon espace"}</Button>
          </div>
        )}
        {step < STEPS.length - 1 ? (
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft /> Retour</Button>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(step + 1)}>Passer</Button><Button onClick={() => setStep(step + 1)}>Continuer <ArrowRight /></Button></div>
          </div>
        ) : null}
      </Card>
      <p className="mt-4 text-center text-sm"><button className="cursor-pointer text-muted underline" disabled={busy} onClick={() => finish(true)}>Terminer plus tard et accéder directement à l'application</button></p>
    </div>
  );
}
