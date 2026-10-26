"use client";
import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { BarsChart, DonutChart, LineSeriesChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { ErrorState, Notice, Skeleton, Tip } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { downloadText, toCsv } from "@/lib/utils";

function Stat({ label, value, help }: { label: string; value: React.ReactNode; help: string }) {
  return (
    <Tip content={help}><div tabIndex={0} className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-display text-xl font-bold">{value}</p></div></Tip>
  );
}
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v} %`);

export default function AnalyticsPage() {
  const [months, setMonths] = useState(6);
  const [accountId, setAccountId] = useState("");
  const q = useOp("analytics.get", { months, accountId: accountId || undefined });
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const a = q.data;
  const k = a.kpis;
  const exportCsv = () => downloadText(`budgetly-analyses-${months}m.csv`, toCsv(a.series.map((s) => ({ mois: s.month.slice(0, 7), revenus: (s.income / 100).toFixed(2).replace(".", ","), depenses: (s.expenses / 100).toFixed(2).replace(".", ","), charges_fixes: (s.fixed / 100).toFixed(2).replace(".", ","), variables: (s.variable / 100).toFixed(2).replace(".", ","), solde_net: (s.net / 100).toFixed(2).replace(".", ","), epargne: (s.savingsDelta / 100).toFixed(2).replace(".", ",") }))));

  return (
    <>
      <PageHeader title="Analyses" description="Comprendre où va ton argent, mois après mois."
        actions={<><Select aria-label="Période" className="w-36" value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[3, 6, 12].map((m) => <option key={m} value={m}>{m} mois</option>)}</Select>
          <Select aria-label="Compte" className="w-44" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Tous les comptes</option>{a.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <Button variant="outline" onClick={exportCsv}><Download /> CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer /> PDF</Button></>} />
      {k.warnings.map((w) => <Notice key={w} tone="warning" className="mb-3">{w}</Notice>)}
      <section aria-label="Indicateurs" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Taux d'épargne" value={k.savingsRate === null ? "—" : `${k.savingsRate} %`} help="(Revenus − dépenses) ÷ revenus, moyenne des 3 derniers mois complets." />
        <Stat label="Charges fixes / revenus" value={k.fixedShareOfIncome === null ? "—" : `${k.fixedShareOfIncome} %`} help="Part des revenus absorbée par les charges fixes (loyer, abonnements, assurances, téléphone, échéances)." />
        <Stat label="Dépense quotidienne" value={k.averageDailySpend === null ? "—" : formatMoney(k.averageDailySpend)} help="Dépenses mensuelles moyennes × 12 ÷ 365." />
        <Stat label="Capacité d'épargne" value={k.savingCapacity === null ? "—" : <Money value={k.savingCapacity} colored />} help="Revenus moyens − dépenses moyennes, par mois (3 derniers mois complets)." />
        <Stat label="Marge de sécurité" value={k.safetyMarginDays === null ? "—" : `${k.safetyMarginDays} j`} help="Nombre de jours de dépenses moyennes couverts par ton solde disponible." />
        <Stat label="Dépenses vs mois préc." value={pct(k.monthOverMonth)} help={`Dernier mois complet comparé au précédent. Vs moyenne 3 mois : ${pct(k.vsThreeMonthAvg)} · vs 6 mois : ${pct(k.vsSixMonthAvg)} · vs année précédente : ${pct(k.vsLastYear)}.`} />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Revenus vs dépenses</CardTitle></CardHeader><CardContent><BarsChart data={a.series.map((s) => ({ ...s }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} bars={[{ key: "income", name: "Revenus", color: "#22C55E" }, { key: "expenses", name: "Dépenses", color: "#EF4444" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Charges fixes vs variables</CardTitle></CardHeader><CardContent><BarsChart stacked data={a.series.map((s) => ({ ...s }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} bars={[{ key: "fixed", name: "Fixes", color: "#7357F6" }, { key: "variable", name: "Variables", color: "#C4B5FD" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Répartition par catégorie</CardTitle></CardHeader><CardContent>
          <DonutChart data={a.breakdown.items.map((i) => ({ key: i.categoryId ?? "none", name: i.name, value: i.amount, color: i.color }))} centerLabel={`${months} mois`} centerValue={formatMoney(a.breakdown.total, { compact: true })} />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{a.breakdown.items.slice(0, 10).map((i) => <li key={i.name} className="flex justify-between gap-2"><span className="truncate"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: i.color }} />{i.name}</span><span className="text-muted">{i.percent} %</span></li>)}</ul>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Dépenses hebdomadaires</CardTitle></CardHeader><CardContent><BarsChart data={a.weekly.map((w) => ({ ...w }))} xKey="week" xFormat={(w) => fmt.day(w)} bars={[{ key: "expenses", name: "Dépenses", color: "#7357F6" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Budget vs dépenses</CardTitle></CardHeader><CardContent><BarsChart data={a.budgets.map((b) => ({ ...b }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} bars={[{ key: "planned", name: "Budget", color: "#C4B5FD" }, { key: "spent", name: "Dépensé", color: "#7357F6" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Évolution de l'épargne</CardTitle></CardHeader><CardContent><LineSeriesChart data={a.savings.map((s) => ({ ...s }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} lines={[{ key: "cumulative", name: "Épargne cumulée sur la période", color: "#22C55E" }, { key: "delta", name: "Variation mensuelle", color: "#7357F6", dashed: true }]} /></CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Trésorerie prévisionnelle (90 jours, réaliste)</CardTitle></CardHeader><CardContent><LineSeriesChart data={a.forecast.map((p) => ({ ...p }))} xKey="date" xFormat={(d) => fmt.day(d)} lines={[{ key: "realistic", name: "Solde prévu", color: "#7357F6", dashed: true }]} /></CardContent></Card>
      </div>
    </>
  );
}
