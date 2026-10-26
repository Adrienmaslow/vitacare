"use client";
import { Calculator, CheckCircle2, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LineSeriesChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, ErrorState, Modal, Notice, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";

const FIELDS = [
  ["income", "Revenus en plus / moins par mois", "Ex. 200 ou -100"],
  ["rent", "Variation du loyer par mois", "Ex. 100 si hausse"],
  ["expenses", "Variation des autres dépenses par mois", "Ex. -50 si tu économises 50 €"],
  ["subs", "Variation des abonnements par mois", "Ex. -15 si tu en résilies"],
  ["saving", "Épargne programmée par mois", "Mise de côté vers tes objectifs"],
] as const;
const PRESETS = [
  { label: "+200 €/mois", v: { income: "200" } },
  { label: "Loyer +100 €", v: { rent: "100" } },
  { label: "Économiser 50 €", v: { expenses: "-50" } },
  { label: "8 h de plus / mois", v: { hours: "8", rate: "12" } },
];
type V = { income: string; rent: string; expenses: string; subs: string; saving: string; hours: string; rate: string; charge: string; chargeDate: string; horizon: string };
const EMPTY: V = { income: "", rent: "", expenses: "", subs: "", saving: "", hours: "", rate: "", charge: "", chargeDate: "", horizon: "3" };

export default function SimulatorPage() {
  const [v, setV] = useState<V>(EMPTY);
  const [debounced, setDebounced] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDebounced(v), 300); return () => clearTimeout(t); }, [v]);
  const params = useMemo(() => {
    const m = (s: string) => (s.trim() ? parseAmount(s) ?? 0 : 0);
    return {
      incomeDeltaMinor: m(debounced.income), rentDeltaMinor: m(debounced.rent), expensesDeltaMinor: m(debounced.expenses), subscriptionsDeltaMinor: m(debounced.subs),
      monthlySavingMinor: Math.max(0, m(debounced.saving)), extraHoursPerMonth: Math.max(0, Math.min(160, Number(debounced.hours.replace(",", ".")) || 0)), hourlyRateMinor: Math.max(0, m(debounced.rate)),
      exceptionalChargeMinor: Math.max(0, m(debounced.charge)), exceptionalChargeDate: debounced.chargeDate || null, horizonMonths: Number(debounced.horizon),
    };
  }, [debounced]);
  const q = useOp("simulations.run", params, { placeholderData: (p) => p });
  const saved = useOp("simulations.list", {});
  const accounts = useOp("accounts.list", { includeArchived: false });
  const save = useMutationOp("simulations.save", { success: "Scénario sauvegardé" });
  const delSim = useMutationOp("simulations.delete");
  const apply = useMutationOp("simulations.apply", { success: "Échéance récurrente créée" });
  const [name, setName] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ account: "", label: "", type: "income" as "income" | "expense", amount: "", start: "" });
  const r = q.data;

  const delta = (a: number, b: number) => <Money value={b - a} sign colored className="text-xs font-semibold" />;
  return (
    <>
      <PageHeader title="Simulateur « et si… ? »" description="Teste des changements de situation sans rien modifier : les scénarios restent fictifs tant que tu ne décides pas explicitement de les appliquer." />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.label} onClick={() => setV({ ...EMPTY, ...p.v, horizon: v.horizon })} className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs hover:border-brand hover:bg-brand-soft">{p.label}</button>)}</div>
          <div className="grid gap-3">
            {FIELDS.map(([k, l, h]) => <Field key={k} label={l} htmlFor={`sim-${k}`} hint={h}><MoneyInput id={`sim-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures en plus / mois" htmlFor="sim-h"><Input id="sim-h" inputMode="decimal" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field>
              <Field label="Taux horaire brut" htmlFor="sim-rate"><MoneyInput id="sim-rate" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></Field>
              <Field label="Charge exceptionnelle" htmlFor="sim-charge"><MoneyInput id="sim-charge" value={v.charge} onChange={(e) => setV({ ...v, charge: e.target.value })} /></Field>
              <Field label="à la date du" htmlFor="sim-cd"><Input id="sim-cd" type="date" value={v.chargeDate} onChange={(e) => setV({ ...v, chargeDate: e.target.value })} /></Field>
            </div>
            <Field label="Horizon" htmlFor="sim-hz"><Select id="sim-hz" value={v.horizon} onChange={(e) => setV({ ...v, horizon: e.target.value })}>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mois</option>)}</Select></Field>
            <Button variant="ghost" onClick={() => setV(EMPTY)}>Réinitialiser</Button>
          </div>
        </Card>
        <div className="space-y-5">
          {q.isError ? <ErrorState message={q.error.message} /> : !r ? <Skeleton className="h-96" /> : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Card className="p-4"><p className="text-xs text-muted">Variation mensuelle nette</p><p className="mt-1 text-xl font-bold"><Money value={r.monthlyNetChange} sign colored /></p></Card>
                <Card className="p-4"><p className="text-xs text-muted">Solde fin de mois</p><p className="mt-1 text-xl font-bold"><Money value={r.scenario.endOfMonth} colored /></p>{delta(r.baseline.endOfMonth, r.scenario.endOfMonth)}</Card>
                <Card className="p-4"><p className="text-xs text-muted">Fin d'horizon</p><p className="mt-1 text-xl font-bold"><Money value={r.scenario.horizonEnd} colored /></p>{delta(r.baseline.horizonEnd, r.scenario.horizonEnd)}</Card>
                <Card className="p-4"><p className="text-xs text-muted">Capacité d'épargne / mois</p><p className="mt-1 text-xl font-bold">{r.scenario.monthlyCapacity === null ? "—" : <Money value={r.scenario.monthlyCapacity} colored />}</p>{r.baseline.monthlyCapacity !== null && r.scenario.monthlyCapacity !== null ? delta(r.baseline.monthlyCapacity, r.scenario.monthlyCapacity) : null}</Card>
              </div>
              <Notice tone={r.scenario.overdraftDate ? "danger" : "positive"}>{r.scenario.overdraftDate ? `Risque de découvert vers le ${fmt.full(r.scenario.overdraftDate)} dans ce scénario.` : "Aucun découvert prévu sur l'horizon dans ce scénario."} {r.baseline.overdraftDate && !r.scenario.overdraftDate ? "Ce scénario élimine le risque de découvert actuel." : ""}</Notice>
              <Card><CardHeader><CardTitle>Situation actuelle vs scénario</CardTitle></CardHeader><CardContent><LineSeriesChart data={r.series.map((s) => ({ ...s }))} xKey="date" xFormat={(d) => fmt.day(d)} lines={[{ key: "baseline", name: "Actuel (réaliste)", color: "#94A3B8" }, { key: "scenario", name: "Scénario", color: "#7357F6", dashed: true }]} /></CardContent></Card>
              {r.goals.length ? <Card><CardHeader><CardTitle>Effet sur tes objectifs</CardTitle></CardHeader><CardContent><ul className="divide-y divide-border text-sm">{r.goals.map((g) => <li key={g.name} className="flex justify-between py-2"><span>{g.name}</span><span>{g.baselineMonths ?? "∞"} mois → <strong>{g.scenarioMonths ?? "∞"} mois</strong></span></li>)}</ul></CardContent></Card> : null}
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted">{r.explanation.map((e) => <li key={e}>{e}</li>)}</ul>
              <Card className="p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Nom du scénario" htmlFor="sim-name" className="flex-1"><Input id="sim-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Job le samedi" maxLength={80} /></Field>
                  <Button variant="outline" disabled={!name.trim()} onClick={() => { save.mutate({ name: name.trim(), params }); setName(""); }}><Save /> Sauvegarder</Button>
                  <Button onClick={() => { setApplyForm({ account: accounts.data?.accounts[0]?.id ?? "", label: "", type: r.monthlyNetChange >= 0 ? "income" : "expense", amount: minorToInput(Math.abs(r.monthlyNetChange)), start: "" }); setApplyOpen(true); }} disabled={!r.monthlyNetChange}><CheckCircle2 /> Appliquer…</Button>
                </div>
              </Card>
            </>
          )}
          {saved.data?.length ? (
            <Card><CardHeader><CardTitle>Scénarios sauvegardés</CardTitle></CardHeader><CardContent><ul className="divide-y divide-border text-sm">{saved.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2"><button className="cursor-pointer font-medium text-brand hover:underline" onClick={() => { const p = s.params as Record<string, number | string | null>; const m = (k: string) => (p[k] ? minorToInput(Number(p[k])) : ""); setV({ income: m("incomeDeltaMinor"), rent: m("rentDeltaMinor"), expenses: m("expensesDeltaMinor"), subs: m("subscriptionsDeltaMinor"), saving: m("monthlySavingMinor"), hours: p.extraHoursPerMonth ? String(p.extraHoursPerMonth) : "", rate: m("hourlyRateMinor"), charge: m("exceptionalChargeMinor"), chargeDate: (p.exceptionalChargeDate as string) ?? "", horizon: String(p.horizonMonths ?? 3) }); }}>{s.name}</button><Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => delSim.mutate({ id: s.id })}><Trash2 /></Button></li>
            ))}</ul></CardContent></Card>
          ) : null}
        </div>
      </div>
      <Modal open={applyOpen} onOpenChange={setApplyOpen} title="Appliquer ce changement ?" description="Cela crée une échéance récurrente mensuelle RÉELLE, prise en compte dans tes prévisions. Elle ne sera pas enregistrée comme opération tant que tu ne l'as pas réellement perçue ou payée."
        footer={<><Button variant="ghost" onClick={() => setApplyOpen(false)}>Annuler</Button><Button disabled={!applyForm.label.trim() || !applyForm.start || !applyForm.account} onClick={async () => { const a = parseAmount(applyForm.amount); if (!a || a <= 0) return; await apply.mutateAsync({ account_id: applyForm.account, label: applyForm.label.trim(), type: applyForm.type, amount_minor: a, start_date: applyForm.start, confirm: true }); setApplyOpen(false); }}>Je confirme</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Libellé" htmlFor="ap-l"><Input id="ap-l" value={applyForm.label} onChange={(e) => setApplyForm({ ...applyForm, label: e.target.value })} placeholder="Ex. Cours particuliers" /></Field>
          <Field label="Type" htmlFor="ap-t"><Select id="ap-t" value={applyForm.type} onChange={(e) => setApplyForm({ ...applyForm, type: e.target.value as "income" })}><option value="income">Revenu</option><option value="expense">Dépense</option></Select></Field>
          <Field label="Montant mensuel" htmlFor="ap-a"><MoneyInput id="ap-a" value={applyForm.amount} onChange={(e) => setApplyForm({ ...applyForm, amount: e.target.value })} /></Field>
          <Field label="À partir du" htmlFor="ap-s"><Input id="ap-s" type="date" value={applyForm.start} onChange={(e) => setApplyForm({ ...applyForm, start: e.target.value })} /></Field>
          <Field label="Compte" htmlFor="ap-acc"><Select id="ap-acc" value={applyForm.account} onChange={(e) => setApplyForm({ ...applyForm, account: e.target.value })}>{accounts.data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        </div>
        <p className="mt-3 text-xs text-warning"><Badge tone="warning"><Calculator />Attention</Badge> Une mission ou une aide non confirmée ne doit pas être appliquée comme revenu certain.</p>
      </Modal>
    </>
  );
}
