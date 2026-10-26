"use client";
import { Lightbulb, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, EmptyState, ErrorState, Modal, Notice, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import type { Frequency, SubscriptionKind, SubscriptionRow } from "@/types/db";

const KIND: Record<SubscriptionKind, string> = { streaming_video: "Streaming vidéo", streaming_music: "Musique", phone: "Téléphone", internet: "Internet", cloud: "Stockage cloud", software: "Logiciel", sport: "Sport", press: "Presse", insurance: "Assurance", transport: "Transport", other: "Autre" };
const FREQ: Record<Frequency, string> = { weekly: "Hebdomadaire", monthly: "Mensuel", quarterly: "Trimestriel", yearly: "Annuel" };
type F = { id?: string; service: string; amount: string; frequency: Frequency; next: string; kind: SubscriptionKind; account: string; status: SubscriptionRow["status"]; pattern: string };

export default function SubscriptionsPage() {
  const q = useOp("subscriptions.list", {});
  const upsert = useMutationOp("subscriptions.upsert", { success: "Abonnement enregistré" });
  const del = useMutationOp("subscriptions.delete", { success: "Abonnement supprimé" });
  const [f, setF] = useState<F | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const { subscriptions, summary, accounts } = q.data;
  const renewing = new Set(summary.renewingSoon.map((r) => r.subscription.id));

  return (
    <>
      <PageHeader title="Abonnements" description="Tous tes prélèvements récurrents, leur coût réel sur l'année et les renouvellements à venir."
        actions={<Button onClick={() => { setErr(null); setF({ service: "", amount: "", frequency: "monthly", next: today, kind: "other", account: accounts[0]?.id ?? "", status: "active", pattern: "" }); }}><Plus /> Abonnement</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Actifs</p><p className="mt-1 text-2xl font-bold">{summary.activeCount}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Coût mensuel équivalent</p><p className="mt-1 text-2xl font-bold"><Money value={summary.monthlyTotal} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Coût annuel</p><p className="mt-1 text-2xl font-bold"><Money value={summary.annualTotal} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Part des revenus</p><p className="mt-1 text-2xl font-bold">{summary.shareOfIncome === null ? "—" : `${summary.shareOfIncome} %`}</p></Card>
      </div>
      {summary.insights.map((i) => <Notice key={i} icon={Lightbulb} className="mb-2">{i} <Link href="/app/deals" className="font-semibold text-brand">Voir les bons plans</Link></Notice>)}
      <Notice tone="neutral" className="mb-4 mt-2">Les opérations dont le libellé correspond à un abonnement y sont rattachées automatiquement : une échéance déjà payée n'est jamais comptée une seconde fois dans les prévisions.</Notice>
      {!subscriptions.length ? <EmptyState icon={Repeat} title="Aucun abonnement" description="Ajoute tes abonnements (téléphone, streaming, salle de sport…) pour suivre leur coût réel." /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted"><tr><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5">Prix</th><th className="px-4 py-2.5">Équiv. mensuel</th><th className="px-4 py-2.5">Annuel</th><th className="px-4 py-2.5">Prochain paiement</th><th className="px-4 py-2.5">Statut</th><th /></tr></thead>
            <tbody className="divide-y divide-border">
              {subscriptions.map((s) => (
                <tr key={s.id} className={s.status !== "active" ? "opacity-60" : ""}>
                  <td className="px-4 py-3"><p className="font-medium">{s.service}</p><p className="text-xs text-muted">{KIND[s.kind]}</p></td>
                  <td className="px-4 py-3"><Money value={s.amount_minor} /> <span className="text-xs text-muted">{FREQ[s.frequency].toLowerCase()}</span></td>
                  <td className="px-4 py-3"><Money value={s.monthly} /></td>
                  <td className="px-4 py-3"><Money value={s.annual} /></td>
                  <td className="px-4 py-3">{fmt.full(s.nextPayment)} {renewing.has(s.id) ? <Badge tone="warning">Bientôt</Badge> : null}</td>
                  <td className="px-4 py-3"><Badge tone={s.status === "active" ? "positive" : "neutral"}>{s.status === "active" ? "Actif" : s.status === "paused" ? "En pause" : "Résilié"}</Badge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="icon-sm" variant="ghost" aria-label={`Modifier ${s.service}`} onClick={() => setF({ id: s.id, service: s.service, amount: minorToInput(s.amount_minor), frequency: s.frequency, next: s.nextPayment, kind: s.kind, account: s.account_id ?? "", status: s.status, pattern: s.match_pattern ?? "" })}><Pencil /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Supprimer ${s.service}`} onClick={() => del.mutate({ id: s.id })}><Trash2 /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={!!f} onOpenChange={() => setF(null)} title={f?.id ? "Modifier l'abonnement" : "Nouvel abonnement"}>
        {f ? (
          <form className="grid gap-4" onSubmit={async (e) => {
            e.preventDefault();
            const amount = parseAmount(f.amount);
            if (!f.service.trim()) return setErr("Nom du service requis");
            if (!amount || amount <= 0) return setErr("Prix invalide");
            await upsert.mutateAsync({ id: f.id, service: f.service.trim(), amount_minor: amount, frequency: f.frequency, next_payment_date: f.next, kind: f.kind, account_id: f.account || null, status: f.status, match_pattern: f.pattern || null });
            setF(null);
          }}>
            {err ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service" htmlFor="s-svc"><Input id="s-svc" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} maxLength={80} /></Field>
              <Field label="Type" htmlFor="s-kind"><Select id="s-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as SubscriptionKind })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Prix" htmlFor="s-amt"><MoneyInput id="s-amt" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="Fréquence" htmlFor="s-freq"><Select id="s-freq" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as Frequency })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Prochain paiement" htmlFor="s-next"><Input id="s-next" type="date" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
              <Field label="Compte utilisé" htmlFor="s-acc"><Select id="s-acc" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="Statut" htmlFor="s-st"><Select id="s-st" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as SubscriptionRow["status"] })}><option value="active">Actif</option><option value="paused">En pause</option><option value="cancelled">Résilié</option></Select></Field>
              <Field label="Libellé bancaire (facultatif)" htmlFor="s-pat" hint="Ex. NETFLIX : sert au rapprochement."><Input id="s-pat" value={f.pattern} onChange={(e) => setF({ ...f, pattern: e.target.value })} maxLength={80} /></Field>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setF(null)}>Annuler</Button><Button type="submit" disabled={upsert.isPending}>Enregistrer</Button></div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
