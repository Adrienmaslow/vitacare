"use client";
import { CheckCircle2, CircleHelp, HandHeart, ListChecks, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SourceLine } from "@/components/sources/source-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form-controls";
import { Badge, ErrorState, Modal, Notice, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { AID_CATEGORY_LABELS } from "@/data/aids";
import { ELIGIBILITY_LABELS } from "@/features/aids/eligibility";
import { fmt } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import type { AidStatus } from "@/types/db";
import type { OpOutput } from "@/lib/ops/registry";

type AidView = OpOutput<"aids.list">["aids"][number];
const STATUS: Record<AidStatus, string> = { to_discover: "À découvrir", to_check: "À vérifier", preparing: "En préparation", sent: "Demande envoyée", pending: "En attente", granted: "Accordée", refused: "Refusée" };
const ELIG_TONE = { potential: "positive", unknown: "warning", unlikely: "neutral" } as const;
const ELIG_ICON = { potential: CheckCircle2, unknown: CircleHelp, unlikely: XCircle };

function AidsContent() {
  const params = useSearchParams();
  const q = useOp("aids.list", {});
  const track = useMutationOp("aids.track", { success: "Démarche mise à jour" });
  const untrack = useMutationOp("aids.untrack");
  const [view, setView] = useState("all");
  const [cat, setCat] = useState("");
  const [detail, setDetail] = useState<AidView | null>(null);
  const [form, setForm] = useState({ status: "to_check" as AidStatus, notes: "", deadline: "", amount: "" });
  useEffect(() => {
    const slug = params.get("aid");
    if (slug && q.data) setDetail(q.data.aids.find((a) => a.slug === slug) ?? null);
  }, [params, q.data]);
  useEffect(() => { if (detail) setForm({ status: detail.application?.status ?? "to_check", notes: detail.application?.notes ?? "", deadline: detail.application?.deadline ?? "", amount: minorToInput(detail.application?.amount_received_minor) }); }, [detail]);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const list = d.aids.filter((a) => (view === "all" || (view === "tracked" ? a.application : a.eligibility.status === view)) && (!cat || a.category === cat));
  const counts = { potential: d.aids.filter((a) => a.eligibility.status === "potential").length, tracked: d.aids.filter((a) => a.application).length };

  return (
    <>
      <PageHeader title="Mes aides" description="Découvre les dispositifs qui pourraient te concerner et suis tes démarches. Seul l'organisme officiel peut confirmer ton droit." />
      {!d.profileComplete ? <Notice tone="warning" className="mb-4">Profil incomplet : renseigne ton statut, ton logement et ta tranche d'âge dans les <Link href="/app/settings" className="font-semibold text-brand underline">paramètres</Link> pour une estimation plus précise.</Notice> : null}
      <Notice className="mb-4">Les aides potentielles ne sont <strong>jamais</strong> ajoutées à ton solde ni à tes prévisions. Montants reçus déclarés : <Money value={d.receivedTotal} className="font-semibold" />.</Notice>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={setView}><TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger><TabsTrigger value="potential">Potentiellement éligible ({counts.potential})</TabsTrigger><TabsTrigger value="unknown">Infos manquantes</TabsTrigger><TabsTrigger value="tracked">Mes démarches ({counts.tracked})</TabsTrigger>
        </TabsList></Tabs>
        <Select aria-label="Catégorie" className="w-52" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Toutes catégories</option>{Object.entries(AID_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => {
          const Icon = ELIG_ICON[a.eligibility.status];
          return (
            <Card key={a.slug} className="flex flex-col p-5">
              <div className="flex flex-wrap gap-1.5"><Badge>{AID_CATEGORY_LABELS[a.category]}</Badge>{a.isTool ? <Badge tone="brand">Simulateur officiel</Badge> : <Badge tone={ELIG_TONE[a.eligibility.status]}><Icon />{ELIGIBILITY_LABELS[a.eligibility.status]}</Badge>}{a.application ? <Badge tone="brand">{STATUS[a.application.status]}</Badge> : null}</div>
              <h3 className="mt-3 font-semibold">{a.name}</h3>
              <p className="text-xs text-muted">{a.organization}</p>
              <p className="mt-2 flex-1 text-sm">{a.summary}</p>
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <SourceLine source={a.source} status={a.sourceStatus} />
                <Button size="sm" variant="outline" onClick={() => setDetail(a)}><ListChecks /> Conditions & suivi</Button>
              </div>
            </Card>
          );
        })}
      </div>
      {!list.length ? <p className="mt-8 text-center text-sm text-muted"><HandHeart className="mx-auto mb-2 size-6" />Aucune aide pour ce filtre.</p> : null}

      <Modal open={!!detail} onOpenChange={() => setDetail(null)} title={detail?.name ?? ""} description={detail?.organization} wide>
        {detail ? (
          <div className="grid gap-4 text-sm">
            <p>{detail.summary}</p>
            {!detail.isTool ? (
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="font-semibold">Estimation selon ton profil : {ELIGIBILITY_LABELS[detail.eligibility.status]}</p>
                <ul className="mt-2 space-y-1">
                  {detail.eligibility.met.map((m) => <li key={m} className="flex gap-2"><CheckCircle2 className="size-4 text-positive" />{m}</li>)}
                  {detail.eligibility.unmet.map((m) => <li key={m} className="flex gap-2"><XCircle className="size-4 text-danger" />{m}</li>)}
                  {detail.eligibility.missing.map((m) => <li key={m} className="flex gap-2"><CircleHelp className="size-4 text-warning" />{m} — information manquante</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted">Estimation indicative fondée sur des critères simplifiés : elle ne vaut pas décision.</p>
              </div>
            ) : null}
            <div><p className="font-semibold">Conditions principales</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{detail.conditions.map((c) => <li key={c}>{c}</li>)}</ul></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="font-semibold">Montant</p><p className="text-muted">{detail.amountLabel}</p></div>
              <div><p className="font-semibold">Période</p><p className="text-muted">{detail.periodLabel ?? "Toute l'année / selon situation"}</p></div>
              {detail.documents.length ? <div><p className="font-semibold">Pièces justificatives</p><ul className="list-disc pl-5 text-muted">{detail.documents.map((x) => <li key={x}>{x}</li>)}</ul></div> : null}
              <div><p className="font-semibold">Démarche</p><p className="text-muted">{detail.howTo}</p></div>
            </div>
            {detail.incomeImpactNote ? <Notice tone="warning">{detail.incomeImpactNote}</Notice> : null}
            <SourceLine source={detail.source} status={detail.sourceStatus} />
            <form className="grid gap-3 rounded-2xl border border-border p-4" onSubmit={async (e) => {
              e.preventDefault();
              await track.mutateAsync({ aid_slug: detail.slug, status: form.status, notes: form.notes || null, deadline: form.deadline || null, amount_received_minor: form.status === "granted" && form.amount ? parseAmount(form.amount) : null });
              setDetail(null);
            }}>
              <p className="font-semibold">Suivi de ma démarche</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Étape" htmlFor="aid-st"><Select id="aid-st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AidStatus })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                <Field label="Date limite / rappel" htmlFor="aid-dl"><Input id="aid-dl" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
                {form.status === "granted" ? <Field label="Montant effectivement reçu" htmlFor="aid-amt" hint="Indique uniquement ce qui a été versé."><MoneyInput id="aid-amt" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field> : null}
              </div>
              <Field label="Notes" htmlFor="aid-notes"><Textarea id="aid-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></Field>
              {detail.application?.deadline ? <p className="text-xs text-muted">Échéance enregistrée : {fmt.full(detail.application.deadline)}</p> : null}
              <div className="flex justify-between gap-2">{detail.application ? <Button type="button" variant="ghost" className="text-danger" onClick={async () => { await untrack.mutateAsync({ id: detail.application!.id }); setDetail(null); }}>Ne plus suivre</Button> : <span />}<Button type="submit" disabled={track.isPending}>{detail.application ? "Mettre à jour" : "Suivre cette aide"}</Button></div>
            </form>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default function AidsPage() {
  return <Suspense><AidsContent /></Suspense>;
}
