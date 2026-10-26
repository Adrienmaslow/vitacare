"use client";
import { CalendarClock, Pencil, PiggyBank, Plus, Target, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form-controls";
import { Badge, EmptyState, ErrorState, Modal, Notice, ProgressBar, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { formatMoney, minorToInput, parseAmount } from "@/lib/money";
import type { GoalKind } from "@/types/db";

const KINDS: Record<GoalKind, string> = { computer: "💻 Ordinateur", travel: "✈️ Voyage", license: "🚗 Permis", car: "🚙 Voiture", emergency: "🛟 Épargne de précaution", moving: "📦 Déménagement", custom: "🎯 Projet personnel" };
type GoalForm = { id?: string; name: string; description: string; kind: GoalKind; target: string; date: string };

function GoalsContent() {
  const params = useSearchParams();
  const q = useOp("goals.list", {});
  const upsert = useMutationOp("goals.upsert", { success: "Objectif enregistré" });
  const del = useMutationOp("goals.delete", { success: "Objectif supprimé" });
  const allocate = useMutationOp("goals.allocate", { success: "Montant affecté" });
  const [form, setForm] = useState<GoalForm | null>(null);
  const [alloc, setAlloc] = useState<{ goalId: string; name: string; amount: string; withdraw: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

  useEffect(() => {
    const k = params.get("new");
    if (k) setForm({ name: k === "emergency" ? "Épargne de précaution" : "", description: "", kind: (k in KINDS ? k : "custom") as GoalKind, target: params.get("amount") ? minorToInput(Number(params.get("amount"))) : k === "emergency" ? "300" : "", date: "" });
  }, [params]);

  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const focus = params.get("goal");

  return (
    <>
      <PageHeader title="Mes objectifs" description="Fixe un montant et une date : BUDGETLY calcule l'effort mensuel et te propose plusieurs stratégies réalistes."
        actions={<Button onClick={() => { setErr(null); setForm({ name: "", description: "", kind: "custom", target: "", date: "" }); }}><Plus /> Objectif</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Épargne disponible</p><p className="mt-1 text-xl font-bold"><Money value={d.savingsAvailable} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Déjà affecté aux objectifs</p><p className="mt-1 text-xl font-bold"><Money value={d.allocatedTotal} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Capacité d'épargne mensuelle</p><p className="mt-1 text-xl font-bold">{d.savingCapacity === null ? "—" : <Money value={d.savingCapacity} colored />}</p></Card>
      </div>
      {d.allocatedTotal > d.savingsAvailable ? <Notice tone="warning" className="mb-4">Tu as affecté plus que ton épargne disponible : certaines affectations ne sont pas couvertes par l'argent réellement mis de côté.</Notice> : null}
      {!d.goals.length ? (
        <EmptyState icon={Target} title="Aucun objectif" description="Ordinateur, permis, voyage, épargne de précaution… Crée ton premier objectif." action={<Button onClick={() => setForm({ name: "", description: "", kind: "custom", target: "", date: "" })}><Plus /> Créer</Button>} />
      ) : (
        <div className="grid gap-5">
          {d.goals.map((g) => (
            <Card key={g.goal.id} className={`p-5 ${focus === g.goal.id ? "ring-2 ring-brand" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{KINDS[g.goal.kind]}</p>
                  <h2 className="text-lg font-bold">{g.goal.name} {g.goal.status === "achieved" ? <Badge tone="positive">Atteint 🎉</Badge> : g.onTrack === false ? <Badge tone="warning">En retard</Badge> : g.onTrack ? <Badge tone="positive">Dans les temps</Badge> : null}</h2>
                  {g.goal.description ? <p className="text-sm text-muted">{g.goal.description}</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => setAlloc({ goalId: g.goal.id, name: g.goal.name, amount: "", withdraw: false })}><PiggyBank /> Affecter</Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Modifier" onClick={() => setForm({ id: g.goal.id, name: g.goal.name, description: g.goal.description ?? "", kind: g.goal.kind, target: minorToInput(g.goal.target_minor), date: g.goal.target_date ?? "" })}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => del.mutate({ id: g.goal.id })}><Trash2 /></Button>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between"><p className="font-display text-2xl font-bold"><Money value={g.allocated} /> <span className="text-base font-normal text-muted">/ {formatMoney(g.goal.target_minor)}</span></p><p className="font-semibold">{g.percent} %</p></div>
              <ProgressBar className="mt-2" value={g.percent} tone={g.percent >= 100 ? "positive" : "brand"} label={`${g.goal.name} : ${g.percent} %`} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div><dt className="text-xs text-muted">Manquant</dt><dd className="font-semibold"><Money value={g.missing} /></dd></div>
                <div><dt className="text-xs text-muted">Date souhaitée</dt><dd className="font-semibold">{g.goal.target_date ? fmt.full(g.goal.target_date) : "Libre"}</dd></div>
                <div><dt className="text-xs text-muted">Temps restant</dt><dd className="font-semibold">{g.monthsLeft !== null ? `${g.monthsLeft} mois` : "—"}</dd></div>
                <div><dt className="text-xs text-muted">Versement nécessaire</dt><dd className="font-semibold">{g.requiredMonthly !== null ? `${formatMoney(g.requiredMonthly)}/mois` : "—"}</dd></div>
                <div><dt className="text-xs text-muted">Date estimée (rythme actuel)</dt><dd className="font-semibold">{g.estimatedDate ? fmt.month(g.estimatedDate) : "Pas de versement récent"}</dd></div>
              </dl>
              {g.missing > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold">Stratégies pour combler {formatMoney(g.missing)}</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {g.strategies.map((s) => (
                      <div key={s.id} className={`rounded-2xl border p-4 ${s.id === "D" ? "border-brand/40 bg-brand-soft/40" : "border-border"}`}>
                        <p className="text-xs font-bold text-brand">Stratégie {s.id}</p>
                        <p className="font-semibold">{s.title}</p>
                        <ul className="mt-2 space-y-0.5 text-sm">
                          {s.monthlySaving ? <li>Épargne : <Money value={s.monthlySaving} />/mois</li> : null}
                          {s.monthlyCutback ? <li>Économies : <Money value={s.monthlyCutback} />/mois</li> : null}
                          {s.monthlyExtraIncome ? <li>Revenus complémentaires estimés : <Money value={s.monthlyExtraIncome} />/mois</li> : null}
                        </ul>
                        <p className="mt-2 text-sm font-semibold">{s.months ? <>≈ {s.months} mois {s.feasible ? <Badge tone="positive">Tient la date</Badge> : g.goal.target_date ? <Badge tone="warning">Après la date</Badge> : null}</> : "Levier indisponible"}</p>
                        <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer font-medium">Hypothèses</summary><ul className="mt-1 list-disc pl-4">{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {g.allocations.length ? (
                <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-muted"><CalendarClock className="mr-1 inline size-3.5" />Historique des versements</summary>
                  <ul className="mt-2 divide-y divide-border">{g.allocations.map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{fmt.full(a.date)}{a.note ? ` — ${a.note}` : ""}</span><Money value={a.amount_minor} sign colored /></li>)}</ul>
                </details>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!form} onOpenChange={() => setForm(null)} title={form?.id ? "Modifier l'objectif" : "Nouvel objectif"}>
        {form ? (
          <form className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            const target = parseAmount(form.target);
            if (!form.name.trim()) return setErr("Donne un nom à ton objectif");
            if (!target || target <= 0) return setErr("Montant cible invalide");
            if (form.date && form.date <= today) return setErr("La date souhaitée doit être dans le futur");
            await upsert.mutateAsync({ id: form.id, name: form.name.trim(), description: form.description || null, kind: form.kind, target_minor: target, target_date: form.date || null });
            setForm(null);
          }}>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</p> : null}
            <Field label="Type" htmlFor="g-kind"><Select id="g-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as GoalKind })}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Nom" htmlFor="g-name"><Input id="g-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant cible" htmlFor="g-target"><MoneyInput id="g-target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
              <Field label="Date souhaitée (facultatif)" htmlFor="g-date"><Input id="g-date" type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <Field label="Description" htmlFor="g-desc"><Textarea id="g-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button><Button type="submit" disabled={upsert.isPending}>Enregistrer</Button></div>
          </form>
        ) : null}
      </Modal>
      <Modal open={!!alloc} onOpenChange={() => setAlloc(null)} title={`Affecter à « ${alloc?.name} »`} description="Une affectation réserve de l'argent déjà épargné pour cet objectif ; elle ne crée aucune opération bancaire.">
        {alloc ? (
          <form className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            const v = parseAmount(alloc.amount);
            if (!v || v <= 0) return;
            await allocate.mutateAsync({ goal_id: alloc.goalId, amount_minor: alloc.withdraw ? -v : v, date: today, note: alloc.withdraw ? "Retrait" : null });
            setAlloc(null);
          }}>
            <div role="radiogroup" aria-label="Sens" className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
              {[false, true].map((w) => <button type="button" role="radio" aria-checked={alloc.withdraw === w} key={String(w)} onClick={() => setAlloc({ ...alloc, withdraw: w })} className={`cursor-pointer rounded-lg py-2 text-sm font-semibold ${alloc.withdraw === w ? "bg-surface shadow-sm" : "text-muted"}`}>{w ? "Retirer" : "Ajouter"}</button>)}
            </div>
            <Field label="Montant" htmlFor="al-amount"><MoneyInput id="al-amount" value={alloc.amount} onChange={(e) => setAlloc({ ...alloc, amount: e.target.value })} autoFocus /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAlloc(null)}>Annuler</Button><Button type="submit" disabled={allocate.isPending}>Valider</Button></div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

export default function GoalsPage() {
  return <Suspense><GoalsContent /></Suspense>;
}
