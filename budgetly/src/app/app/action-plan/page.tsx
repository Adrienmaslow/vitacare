"use client";
import { CheckCircle2, ChevronDown, Clock, PauseCircle, PlayCircle, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BarsChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, ErrorState, Modal, Notice, ProgressBar, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import type { ActionItemRow, ActionStatus } from "@/types/db";

const TYPE_LABEL: Record<ActionItemRow["type"], string> = { cashflow: "Trésorerie", budget: "Budget", savings: "Épargne", subscription: "Abonnement", aid: "Aide", earn: "Revenus", deal: "Économie", data_quality: "Données", goal: "Objectif" };
const STATUS_LABEL: Record<ActionStatus, string> = { todo: "À faire", in_progress: "En cours", postponed: "Reportée", done: "Terminée", dismissed: "Ignorée" };
const FACTORS: Record<string, [string, number]> = { urgency: ["Urgence", 30], impact: ["Impact estimé", 25], feasibility: ["Faisabilité (temps)", 15], confidence: ["Confiance", 15], relevance: ["Pertinence", 10], preference: ["Tes préférences", 5] };

function ActionCard({ item, onDone }: { item: ActionItemRow; onDone: (i: ActionItemRow) => void }) {
  const update = useMutationOp("plan.updateItem");
  const [open, setOpen] = useState(false);
  const closed = item.status === "done" || item.status === "dismissed";
  return (
    <Card className={`p-5 ${closed ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-soft text-brand"><span className="font-display text-lg font-bold leading-none">{item.priority}</span><span className="text-[9px] uppercase">priorité</span></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5"><Badge>{TYPE_LABEL[item.type]}</Badge><Badge tone={item.status === "done" ? "positive" : item.status === "in_progress" ? "brand" : "neutral"}>{STATUS_LABEL[item.status]}</Badge><Badge tone={item.confidence === "high" ? "positive" : item.confidence === "medium" ? "warning" : "neutral"}>Confiance {item.confidence === "high" ? "élevée" : item.confidence === "medium" ? "moyenne" : "faible"}</Badge></div>
          <h3 className="mt-2 font-semibold">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">{item.description}</p>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {item.impact_minor ? <div><dt className="inline">Impact {item.impact_kind === "avoided_risk" ? "(risque évité)" : item.impact_kind === "estimated" ? "(estimé)" : "(potentiel)"} : </dt><dd className="inline font-semibold text-foreground"><Money value={item.impact_minor} /></dd></div> : null}
            {item.time_minutes ? <div><Clock className="mr-1 inline size-3" />{item.time_minutes} min</div> : null}
            {item.valid_until ? <div>Valable jusqu'au {fmt.day(item.valid_until)}</div> : null}
            {item.realized_minor ? <div className="text-positive">Résultat obtenu : <Money value={item.realized_minor} /></div> : null}
          </dl>
          <button className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand" aria-expanded={open} onClick={() => setOpen(!open)}>Pourquoi cette action ? <ChevronDown className={`size-3 transition ${open ? "rotate-180" : ""}`} /></button>
          {open ? (
            <div className="mt-2 rounded-xl bg-surface-2 p-3 text-xs">
              <p>{item.rationale}</p>
              <p className="mt-1 text-muted">Source : {item.source}</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{Object.entries(item.score_breakdown).map(([k, v]) => <li key={k}><div className="flex justify-between"><span>{FACTORS[k]?.[0] ?? k}</span><span className="tabular">{v}/{FACTORS[k]?.[1]}</span></div><ProgressBar className="mt-0.5 h-1.5" value={(v / (FACTORS[k]?.[1] ?? 1)) * 100} label={FACTORS[k]?.[0] ?? k} /></li>)}</ul>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.href ? <Button size="sm" asChild><Link href={item.href}>{item.cta_label ?? "Ouvrir"}</Link></Button> : null}
            {!closed ? <>
              {item.status !== "in_progress" ? <Button size="sm" variant="outline" onClick={() => update.mutate({ id: item.id, status: "in_progress" })}><PlayCircle /> Commencer</Button> : null}
              <Button size="sm" variant="positive" onClick={() => onDone(item)}><CheckCircle2 /> Terminée</Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: item.id, status: "postponed" })}><PauseCircle /> Reporter</Button>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: item.id, status: "dismissed" })}><XCircle /> Ignorer</Button>
            </> : <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: item.id, status: "todo" })}>Rouvrir</Button>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Results() {
  const q = useOp("plan.results", {});
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const r = q.data;
  return (
    <div className="grid gap-4">
      <Notice>Les <strong>réalisations</strong> (montants que tu as confirmés) et les <strong>projections</strong> (impacts potentiels) sont toujours présentées séparément, jamais additionnées.</Notice>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Actions terminées</p><p className="mt-1 text-2xl font-bold">{r.results.completed} <span className="text-sm font-normal text-muted">/ {r.results.total}</span></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Économies obtenues (déclarées)</p><p className="mt-1 text-2xl font-bold text-positive"><Money value={r.results.realized.savings} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Revenus complémentaires perçus</p><p className="mt-1 text-2xl font-bold text-positive"><Money value={r.realized.extraIncome} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Aides effectivement reçues</p><p className="mt-1 text-2xl font-bold text-positive"><Money value={r.realized.aidsReceived} /></p></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Projections en cours (non acquises)</CardTitle></CardHeader><CardContent className="text-sm"><p>Impact potentiel des actions ouvertes : <Money value={r.results.projected} className="font-semibold" /></p><p className="mt-2">Économies mensuelles vérifiées : <Money value={r.realized.verifiedSavingsMonthly} className="font-semibold" /> · déclarées : <Money value={r.realized.declaredSavingsMonthly} /></p></CardContent></Card>
        <Card><CardHeader><CardTitle>Trésorerie (30 derniers jours)</CardTitle></CardHeader><CardContent className="text-sm"><p>Disponible : <Money value={r.cash.available} className="font-semibold" /> · Épargne : <Money value={r.cash.savings} className="font-semibold" /></p><p className="mt-1">Revenus <Money value={r.cash.last30.income} /> · Dépenses <Money value={r.cash.last30.expenses} /> · Net <Money value={r.cash.last30.net} colored /></p></CardContent></Card>
        <Card><CardHeader><CardTitle>Progression des objectifs</CardTitle></CardHeader><CardContent className="space-y-3">{r.goals.map((g) => <div key={g.goal.id}><div className="flex justify-between text-sm"><span>{g.goal.name}</span><span>{g.percent} %</span></div><ProgressBar value={g.percent} label={g.goal.name} /></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Actions réalisées par semaine</CardTitle></CardHeader><CardContent><BarsChart height={200} data={r.weekly.map((w) => ({ ...w, doneMinor: w.done * 100, totalMinor: w.total * 100 }))} xKey="week" xFormat={(w) => fmt.day(w)} bars={[{ key: "totalMinor", name: "Proposées", color: "#C4B5FD" }, { key: "doneMinor", name: "Terminées", color: "#22C55E" }]} /><p className="text-xs text-muted">(axe exprimé en nombre d'actions)</p></CardContent></Card>
      </div>
    </div>
  );
}

export default function ActionPlanPage() {
  const q = useOp("plan.get", {});
  const regen = useMutationOp("plan.get", { success: "Plan recalculé" });
  const update = useMutationOp("plan.updateItem", { success: "Bravo, action terminée ! 🎉" });
  const [done, setDone] = useState<ActionItemRow | null>(null);
  const [res, setRes] = useState({ amount: "", kind: "saving" });
  return (
    <>
      <PageHeader title="Mon plan d'action" description="3 à 5 actions prioritaires par semaine, calculées à partir de ta situation réelle. Tu choisis librement celles que tu suis."
        actions={<Button variant="outline" onClick={() => regen.mutate({ regenerate: true })} disabled={regen.isPending}><RefreshCw /> Recalculer</Button>} />
      <Tabs defaultValue="plan">
        <TabsList className="mb-4"><TabsTrigger value="plan">Cette semaine</TabsTrigger><TabsTrigger value="results">Résultats</TabsTrigger></TabsList>
        <TabsContent value="plan">
          {q.isPending ? <Skeleton className="h-96" /> : q.isError ? <ErrorState message={q.error.message} /> : (
            <div className="grid gap-3">
              <p className="text-sm text-muted">Semaine du {fmt.full(q.data.week)} · priorisation : urgence, impact, temps nécessaire, confiance, pertinence et tes préférences.</p>
              {q.data.items.map((i) => <ActionCard key={i.id} item={i} onDone={(x) => { setRes({ amount: "", kind: x.type === "earn" ? "extra_income" : x.type === "aid" ? "aid_received" : "saving" }); setDone(x); }} />)}
              {!q.data.items.length ? <Notice>Aucune action cette semaine : ta situation ne présente pas de point d'attention. Clique sur « Recalculer » après avoir ajouté des données.</Notice> : null}
            </div>
          )}
        </TabsContent>
        <TabsContent value="results"><Results /></TabsContent>
      </Tabs>
      <Modal open={!!done} onOpenChange={() => setDone(null)} title="Action terminée" description="Facultatif : indique un résultat financier réellement obtenu (pas une estimation)."
        footer={<><Button variant="ghost" onClick={async () => { await update.mutateAsync({ id: done!.id, status: "done" }); setDone(null); }}>Terminer sans montant</Button><Button onClick={async () => { const v = parseAmount(res.amount); await update.mutateAsync({ id: done!.id, status: "done", realized_minor: v && v > 0 ? v : null, realized_kind: v && v > 0 ? (res.kind as "saving") : null }); setDone(null); }}>Enregistrer</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant obtenu" htmlFor="r-amt"><MoneyInput id="r-amt" value={res.amount} onChange={(e) => setRes({ ...res, amount: e.target.value })} /></Field>
          <Field label="Nature" htmlFor="r-kind"><Select id="r-kind" value={res.kind} onChange={(e) => setRes({ ...res, kind: e.target.value })}><option value="saving">Économie réalisée</option><option value="extra_income">Revenu complémentaire perçu</option><option value="aid_received">Aide reçue</option></Select></Field>
        </div>
      </Modal>
    </>
  );
}
