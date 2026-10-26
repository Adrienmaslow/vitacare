"use client";
import { Bookmark, BookmarkCheck, Calculator, CheckCircle2, Coins, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SourceLine } from "@/components/sources/source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, ErrorState, Modal, Notice, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { DEAL_CATEGORY_LABELS } from "@/data/deals";
import { compareCosts } from "@/features/deals/compare";
import { parseAmount } from "@/lib/money";
import type { Frequency } from "@/types/db";

const FREQ: Record<Frequency, string> = { weekly: "/ semaine", monthly: "/ mois", quarterly: "/ trimestre", yearly: "/ an" };

function Comparator({ dealSlug, title }: { dealSlug?: string; title?: string }) {
  const record = useMutationOp("savings.record", { success: "Économie déclarée" });
  const [v, setV] = useState({ current: "", cf: "monthly" as Frequency, alt: "", af: "monthly" as Frequency, switching: "" });
  const cur = parseAmount(v.current), alt = parseAmount(v.alt), sw = parseAmount(v.switching || "0");
  const r = cur !== null && alt !== null && sw !== null && cur >= 0 && alt >= 0 ? compareCosts({ currentMinor: cur, currentFrequency: v.cf, alternativeMinor: alt, alternativeFrequency: v.af, switchingCostMinor: sw }) : null;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Coût actuel" htmlFor="c-cur"><div className="flex gap-2"><MoneyInput id="c-cur" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} placeholder="0,00" /><Select aria-label="Fréquence actuelle" className="w-36" value={v.cf} onChange={(e) => setV({ ...v, cf: e.target.value as Frequency })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div></Field>
        <Field label="Coût de l'alternative" htmlFor="c-alt" hint="Prix relevé toi-même sur le site officiel."><div className="flex gap-2"><MoneyInput id="c-alt" value={v.alt} onChange={(e) => setV({ ...v, alt: e.target.value })} placeholder="0,00" /><Select aria-label="Fréquence alternative" className="w-36" value={v.af} onChange={(e) => setV({ ...v, af: e.target.value as Frequency })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></div></Field>
        <Field label="Frais de changement" htmlFor="c-sw" hint="Carte SIM, frais de résiliation, carte payante…"><MoneyInput id="c-sw" value={v.switching} onChange={(e) => setV({ ...v, switching: e.target.value })} placeholder="0,00" /></Field>
      </div>
      {r ? (
        <div className={`rounded-2xl p-4 ${r.worthIt ? "bg-positive-soft" : "bg-surface-2"}`} aria-live="polite">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">Coût mensuel actuel</dt><dd className="font-semibold"><Money value={r.currentMonthly} /></dd></div>
            <div><dt className="text-muted">Alternative / mois</dt><dd className="font-semibold"><Money value={r.alternativeMonthly} /></dd></div>
            <div><dt className="text-muted">Économie mensuelle</dt><dd className="font-semibold"><Money value={r.monthlySaving} colored /></dd></div>
            <div><dt className="text-muted">1re année (frais déduits)</dt><dd className="font-semibold"><Money value={r.firstYearNet} colored /></dd></div>
          </dl>
          <p className="mt-2 text-sm">{r.worthIt ? `Changement rentable${r.breakEvenMonths ? `, frais amortis en ${r.breakEvenMonths} mois` : ""}. Économie annuelle estimée : ` : "Pas d'économie sur la première année. Économie annuelle : "}<Money value={r.annualSaving} /></p>
          {r.worthIt ? <Button size="sm" variant="positive" className="mt-3" disabled={record.isPending} onClick={() => record.mutate({ label: title ?? "Changement d'offre", deal_slug: dealSlug ?? null, monthly_amount_minor: r.monthlySaving, started_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()), evidence: null })}><CheckCircle2 /> J'ai fait ce changement</Button> : null}
        </div>
      ) : <p className="text-sm text-muted">Saisis les deux montants pour voir l'économie calculée.</p>}
    </div>
  );
}

function DealsContent() {
  const params = useSearchParams();
  const q = useOp("deals.list", {});
  const toggle = useMutationOp("deals.toggleSave");
  const verify = useMutationOp("savings.verify", { success: "Économie marquée comme vérifiée" });
  const delRecord = useMutationOp("savings.delete");
  const [cat, setCat] = useState("");
  const [onlySaved, setOnlySaved] = useState(false);
  const [compare, setCompare] = useState<{ slug?: string; title?: string } | null>(params.get("deal") ? { slug: params.get("deal")! } : null);
  const [verifying, setVerifying] = useState<{ id: string; evidence: string } | null>(null);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data;
  const suggested = new Map(d.suggestions.map((s) => [s.slug, s]));
  const deals = d.deals.filter((x) => (!cat || x.category === cat) && (!onlySaved || x.saved)).sort((a, b) => Number(suggested.has(b.slug)) - Number(suggested.has(a.slug)));
  const compareDeal = compare?.slug ? d.deals.find((x) => x.slug === compare.slug) : undefined;

  return (
    <>
      <PageHeader title="Économiser" description="Réductions étudiantes, alternatives moins chères et comparateur — à partir de tes vraies dépenses, jamais pour te pousser à consommer."
        actions={<Button onClick={() => setCompare({})}><Calculator /> Comparer un coût</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Économies déclarées</p><p className="mt-1 text-xl font-bold"><Money value={d.totals.declaredMonthly} /> <span className="text-sm font-normal text-muted">/ mois</span></p><p className="text-xs text-muted">Changements que tu indiques avoir faits</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Économies vérifiées</p><p className="mt-1 text-xl font-bold text-positive"><Money value={d.totals.verifiedMonthly} /> <span className="text-sm font-normal text-muted">/ mois</span></p><p className="text-xs text-muted">Confirmées par un justificatif</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Suggestions personnalisées</p><p className="mt-1 text-xl font-bold">{d.suggestions.length}</p><p className="text-xs text-muted">Économies potentielles, non comptées comme gagnées</p></Card>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select aria-label="Catégorie" className="w-56" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Toutes les catégories</option>{Object.entries(DEAL_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Button variant={onlySaved ? "primary" : "outline"} onClick={() => setOnlySaved(!onlySaved)}><Bookmark /> Sauvegardés</Button>
      </div>
      <Notice className="mb-4">Les prix ne sont pas affichés tant qu'ils n'ont pas été vérifiés : consulte l'offre sur le site officiel et utilise le comparateur avec les montants réels.</Notice>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {deals.map((x) => (
          <Card key={x.slug} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div><Badge tone="neutral">{DEAL_CATEGORY_LABELS[x.category]}</Badge><h3 className="mt-2 font-semibold">{x.title}</h3><p className="text-sm text-muted">{x.brand}</p></div>
              <Button variant="ghost" size="icon-sm" aria-label={x.saved ? "Retirer des sauvegardes" : "Sauvegarder"} onClick={() => toggle.mutate({ deal_slug: x.slug })}>{x.saved ? <BookmarkCheck className="text-brand" /> : <Bookmark />}</Button>
            </div>
            {suggested.has(x.slug) ? <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-brand-soft p-2 text-xs text-brand"><Sparkles className="mt-0.5 size-3.5 shrink-0" />{suggested.get(x.slug)!.reason}</p> : null}
            <p className="mt-3 flex-1 text-sm">{x.description}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-muted">{x.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="mt-3 text-sm font-semibold">{x.free ? <Badge tone="positive">Gratuit</Badge> : null} {x.benefitLabel}</p>
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <SourceLine source={x.source} status={x.sourceStatus} />
              {!x.free ? <Button variant="outline" size="sm" onClick={() => setCompare({ slug: x.slug, title: x.title })}><Calculator /> Comparer avec mes coûts</Button> : null}
            </div>
          </Card>
        ))}
      </div>
      {d.records.length ? (
        <Card className="mt-6">
          <CardHeader><CardTitle>Suivi de mes économies</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">{d.records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><strong>{r.label}</strong> · <Money value={r.monthly_amount_minor} />/mois · depuis le {r.started_on} {r.status === "verified" ? <Badge tone="positive">Vérifiée</Badge> : <Badge tone="warning">Déclarée</Badge>}{r.evidence ? <span className="block text-xs text-muted">Justificatif : {r.evidence}</span> : null}</span>
                <span className="flex gap-1">{r.status === "declared" ? <Button size="sm" variant="outline" onClick={() => setVerifying({ id: r.id, evidence: "" })}>Marquer vérifiée</Button> : null}<Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => delRecord.mutate({ id: r.id })}><Trash2 /></Button></span>
              </li>
            ))}</ul>
          </CardContent>
        </Card>
      ) : null}
      <Modal open={!!compare} onOpenChange={() => setCompare(null)} title={compareDeal ? `Comparer : ${compareDeal.title}` : "Comparer deux coûts"} description="Calcul basé uniquement sur les montants que tu saisis." wide>
        <Comparator dealSlug={compare?.slug} title={compare?.title ?? compareDeal?.title} />
      </Modal>
      <Modal open={!!verifying} onOpenChange={() => setVerifying(null)} title="Vérifier cette économie" description="Indique ce qui la prouve (ex. nouvelle facture, prélèvement modifié)."
        footer={<><Button variant="ghost" onClick={() => setVerifying(null)}>Annuler</Button><Button disabled={(verifying?.evidence.length ?? 0) < 3} onClick={async () => { await verify.mutateAsync({ id: verifying!.id, evidence: verifying!.evidence }); setVerifying(null); }}>Confirmer</Button></>}>
        <Input aria-label="Justificatif" value={verifying?.evidence ?? ""} onChange={(e) => setVerifying(verifying && { ...verifying, evidence: e.target.value })} placeholder="Ex. Prélèvement Free Mobile passé de 16,99 € à 9,99 €" maxLength={300} />
      </Modal>
      {!deals.length ? <p className="mt-6 text-center text-sm text-muted"><Coins className="mx-auto mb-2 size-6" />Aucun bon plan pour ce filtre.</p> : null}
    </>
  );
}

export default function DealsPage() {
  return <Suspense><DealsContent /></Suspense>;
}
