"use client";
import { AlertTriangle, CalendarClock, CheckCircle2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ForecastChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, ErrorState, Notice, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";

const HORIZONS = [["30", "30 jours"], ["60", "60 jours"], ["90", "3 mois"], ["180", "6 mois"]] as const;

export default function ForecastPage() {
  const [h, setH] = useState("30");
  const q = useOp("forecast.get", { horizonDays: Number(h) });
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const f = q.data;
  if (!f.hasData) return <EmptyState icon={TrendingUp} title="Pas encore de prévision" description="Ajoute un compte et tes revenus/charges récurrents pour obtenir une projection jour par jour." />;
  const rel = { high: ["positive", "Bonne"], medium: ["warning", "Moyenne"], low: ["danger", "Faible"] } as const;
  const events = f.points.flatMap((p) => p.events).filter((e) => e.amount_minor > 0);

  return (
    <>
      <PageHeader title="Prévisions" description="Projection jour par jour de ton solde disponible, calculée uniquement à partir de tes données réelles et de tes échéances déclarées."
        actions={<Tabs value={h} onValueChange={setH}><TabsList>{HORIZONS.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs>} />
      {f.overdraftDate ? (
        <Notice tone="danger" icon={AlertTriangle} className="mb-4"><strong>Risque de découvert</strong> vers le {fmt.longDay(f.overdraftDate)} dans le scénario réaliste. Consulte ton plan d'action pour l'éviter.</Notice>
      ) : f.belowThresholdDate ? (
        <Notice tone="warning" icon={AlertTriangle} className="mb-4">Ton solde passerait sous ton seuil de sécurité (<Money value={f.safetyThreshold} />) vers le {fmt.longDay(f.belowThresholdDate)}.</Notice>
      ) : (
        <Notice tone="positive" icon={CheckCircle2} className="mb-4">Aucun passage sous ton seuil de sécurité n'est prévu sur la période (scénario réaliste).</Notice>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="p-4"><p className="text-xs text-muted">Solde de départ</p><p className="mt-1 text-xl font-bold"><Money value={f.startingBalance} /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Fin de période — réaliste</p><p className="mt-1 text-xl font-bold"><Money value={f.endBalance.realistic} colored /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Optimiste / pessimiste</p><p className="mt-1 text-sm font-semibold"><Money value={f.endBalance.optimistic} className="text-positive" /> / <Money value={f.endBalance.pessimistic} className="text-danger" /></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Point bas (réaliste)</p><p className="mt-1 text-xl font-bold"><Money value={f.minBalance.realistic.value} colored /></p><p className="text-xs text-muted">{fmt.day(f.minBalance.realistic.date)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Fiabilité indicative</p><Badge tone={rel[f.reliability.level][0]} className="mt-2">{rel[f.reliability.level][1]}</Badge></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Trajectoire</CardTitle><p className="text-xs text-muted">Trait plein : réel · pointillés : prévision · zone : incertitude</p></CardHeader>
        <CardContent><ForecastChart history={f.history} points={f.points} threshold={f.safetyThreshold} /></CardContent>
      </Card>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-brand" /> Échéances prises en compte</CardTitle></CardHeader>
          <CardContent>
            {events.length ? <ul className="max-h-80 divide-y divide-border overflow-auto">{events.map((e, i) => (
              <li key={`${e.sourceId}-${e.date}-${i}`} className="flex items-center justify-between py-2 text-sm"><span><span className="font-medium">{e.label}</span><span className="block text-xs text-muted">{fmt.longDay(e.date)}</span></span><Money value={e.type === "income" ? e.amount_minor : -e.amount_minor} sign colored className="font-semibold" /></li>
            ))}</ul> : <p className="text-sm text-muted">Aucune échéance déclarée sur la période.</p>}
            <p className="mt-3 text-xs text-muted">Revenus attendus : <Money value={f.expectedIncome} /> · Charges prévues : <Money value={f.scheduledExpenses} /> · Dépense variable moyenne : <Money value={f.variable.dailyMinor} /> / jour</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Hypothèses utilisées</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">{f.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            <p className="mt-4 text-sm font-semibold">Fiabilité</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{f.reliability.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            {f.largeUpcoming.length ? <><p className="mt-4 text-sm font-semibold">Charges importantes à venir</p><ul className="mt-1 text-sm">{f.largeUpcoming.map((l) => <li key={l.sourceId + l.date}>{l.label} — <Money value={l.amount_minor} /> le {fmt.day(l.date)}</li>)}</ul></> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
