"use client";
import { ChevronLeft, ChevronRight, Copy, Pencil, PiggyBank, Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { BarsChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, EmptyState, ErrorState, Modal, Notice, ProgressBar, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { addMonths, fmt, startOfMonth } from "@/lib/dates";
import { formatMoney, minorToInput, parseAmount } from "@/lib/money";

const LEVEL = { ok: ["positive", "Dans les clous"], warning: ["warning", "Attention"], danger: ["danger", "Presque atteint"], over: ["danger", "Dépassé"] } as const;

export default function BudgetsPage() {
  const current = startOfMonth(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  const [month, setMonth] = useState(current);
  const q = useOp("budgets.get", { month });
  const upsert = useMutationOp("budgets.upsert", { success: "Budget enregistré" });
  const del = useMutationOp("budgets.delete", { success: "Budget supprimé" });
  const dup = useMutationOp("budgets.duplicate", { success: (d) => `${d.created} budget(s) copié(s)` });
  const apply = useMutationOp("budgets.applySuggestion", { success: (d) => `${d.created} budget(s) créé(s)` });
  const [dialog, setDialog] = useState<{ id?: string; category_id: string; amount: string; thresholds: string } | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const used = new Set(d?.statuses.map((s) => s.budget.category_id ?? "global"));

  return (
    <>
      <PageHeader title="Budgets" description="Fixe un plafond global et par catégorie. Seules les dépenses comptabilisées comptent ; les transferts sont exclus."
        actions={<><Button onClick={() => { setErr(null); setDialog({ category_id: "", amount: "", thresholds: "70,85,100" }); }}><Plus /> Budget</Button><Button variant="outline" onClick={() => setSuggestOpen(true)}><Wand2 /> Répartition suggérée</Button></>} />
      <div className="mb-5 flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
        <p className="min-w-40 text-center font-semibold capitalize">{fmt.month(month)}</p>
        <Button variant="outline" size="icon-sm" aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
        {d?.hasPreviousMonth ? <Button variant="ghost" size="sm" onClick={() => dup.mutate({ from: addMonths(month, -1), to: month })}><Copy /> Copier le mois précédent</Button> : null}
      </div>

      {!d ? <Skeleton className="h-80" /> : !d.statuses.length ? (
        <EmptyState icon={PiggyBank} title="Aucun budget ce mois-ci" description="Crée un budget global et quelques budgets par catégorie, ou laisse BUDGETLY te proposer une répartition basée sur tes dépenses réelles."
          action={<div className="flex gap-2"><Button onClick={() => setDialog({ category_id: "", amount: "", thresholds: "70,85,100" })}><Plus /> Créer</Button><Button variant="outline" onClick={() => setSuggestOpen(true)}><Wand2 /> Suggestion</Button></div>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.statuses.map((s) => {
            const [tone, label] = LEVEL[s.level];
            const diff = s.previousSpent ? Math.round(((s.spent - s.previousSpent) / s.previousSpent) * 100) : null;
            return (
              <Card key={s.budget.id} className={s.category ? "" : "md:col-span-2 xl:col-span-3"}>
                <CardHeader>
                  <div><CardTitle className="flex items-center gap-2">{s.category ? <span className="size-2.5 rounded-full" style={{ background: s.category.color }} /> : null}{s.category?.name ?? "Budget global (toutes dépenses)"}</CardTitle><Badge tone={tone} className="mt-1.5">{label} · {s.percentUsed} %</Badge></div>
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label="Modifier" onClick={() => setDialog({ id: s.budget.id, category_id: s.budget.category_id ?? "", amount: minorToInput(s.budget.amount_minor), thresholds: s.budget.alert_thresholds.join(",") })}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Supprimer" onClick={() => del.mutate({ id: s.budget.id })}><Trash2 /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex items-end justify-between"><p className="font-display text-2xl font-bold"><Money value={s.spent} /></p><p className="text-sm text-muted">sur <Money value={s.budget.amount_minor} /></p></div>
                  <div className="relative">
                    <ProgressBar value={s.percentUsed} tone={s.level === "ok" ? "positive" : s.level === "warning" ? "warning" : "danger"} label={`${s.percentUsed} % consommé`} />
                    {month === current ? <span className="absolute top-[-3px] h-4 w-0.5 rounded bg-foreground/60" style={{ left: `${Math.min(100, Math.round((s.expectedToDate / s.budget.amount_minor) * 100))}%` }} title="Rythme attendu à date" /> : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted">Restant</dt><dd className={`font-semibold ${s.remaining < 0 ? "text-danger" : ""}`}><Money value={s.remaining} /></dd></div>
                    <div><dt className="text-muted">Mois précédent</dt><dd className="font-semibold"><Money value={s.previousSpent} /></dd></div>
                    <div><dt className="text-muted">Évolution</dt><dd className="font-semibold">{diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff} %`}</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted">Alertes à {s.budget.alert_thresholds.join(" %, ")} %</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {d?.history ? (
        <Card className="mt-6">
          <CardHeader><CardTitle>Historique : prévu vs réel</CardTitle></CardHeader>
          <CardContent><BarsChart data={d.history.map((h) => ({ ...h }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} bars={[{ key: "planned", name: "Prévu", color: "#C4B5FD" }, { key: "spent", name: "Dépensé", color: "#7357F6" }]} /></CardContent>
        </Card>
      ) : null}

      <Modal open={!!dialog} onOpenChange={() => setDialog(null)} title={dialog?.id ? "Modifier le budget" : "Nouveau budget"} description={`Mois : ${fmt.month(month)}`}>
        {dialog ? (
          <form className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            const amount = parseAmount(dialog.amount);
            const th = dialog.thresholds.split(/[,; ]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 200);
            if (!amount || amount <= 0) return setErr("Montant invalide");
            await upsert.mutateAsync({ month, category_id: dialog.category_id || null, amount_minor: amount, alert_thresholds: th.length ? th : [70, 85, 100] });
            setDialog(null);
          }}>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</p> : null}
            <Field label="Catégorie" htmlFor="b-cat"><Select id="b-cat" value={dialog.category_id} disabled={!!dialog.id} onChange={(e) => setDialog({ ...dialog, category_id: e.target.value })}>
              <option value="" disabled={!dialog.id && used.has("global")}>Budget global (toutes dépenses)</option>
              {d?.categories.map((c) => <option key={c.id} value={c.id} disabled={!dialog.id && used.has(c.id)}>{c.name}</option>)}
            </Select></Field>
            <Field label="Montant mensuel" htmlFor="b-amount"><MoneyInput id="b-amount" value={dialog.amount} onChange={(e) => setDialog({ ...dialog, amount: e.target.value })} placeholder="0,00" autoFocus /></Field>
            <Field label="Seuils d'alerte (%)" htmlFor="b-th" hint="Séparés par des virgules, ex. 70,85,100"><input id="b-th" className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm" value={dialog.thresholds} onChange={(e) => setDialog({ ...dialog, thresholds: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDialog(null)}>Annuler</Button><Button type="submit" disabled={upsert.isPending}>Enregistrer</Button></div>
          </form>
        ) : null}
      </Modal>

      <Modal open={suggestOpen} onOpenChange={setSuggestOpen} title="Répartition suggérée" description="Calculée à partir de tes dépenses réelles, sans jamais réduire les dépenses essentielles." wide
        footer={<><Button variant="ghost" onClick={() => setSuggestOpen(false)}>Fermer</Button><Button disabled={!d?.suggestion.allocations.length} onClick={async () => { await apply.mutateAsync({ month, allocations: d!.suggestion.allocations.map((a) => ({ category_id: a.categoryId, amount_minor: a.suggestedMinor })) }); setSuggestOpen(false); }}>Créer les budgets manquants</Button></>}>
        {d?.suggestion.explanation.map((e) => <Notice key={e} className="mb-2">{e}</Notice>)}
        <ul className="divide-y divide-border text-sm">
          {d?.suggestion.allocations.map((a) => (
            <li key={a.categoryId} className="flex items-center justify-between py-2">
              <span>{a.categoryName} {a.essential ? <Badge tone="positive">Essentiel</Badge> : null}</span>
              <span className="text-muted">moyenne {formatMoney(a.averageMinor)} → <strong className="text-foreground">{formatMoney(a.suggestedMinor)}</strong></span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
