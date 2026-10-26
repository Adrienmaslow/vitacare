"use client";
import { AlertTriangle, ArrowRight, Bell, Briefcase, CalendarClock, Coins, HandHeart, ListChecks, Plus, Target, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BalanceChart, DonutChart } from "@/components/charts/charts";
import { Kpi } from "@/components/dashboard/kpi";
import { TransactionFormDialog } from "@/components/forms/transaction-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, ErrorState, ProgressBar, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const PERIODS = [["7d", "7 j"], ["30d", "30 j"], ["3m", "3 mois"], ["6m", "6 mois"], ["12m", "12 mois"]] as const;

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0] | "custom">("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const input = period === "custom" && custom.from && custom.to ? { from: custom.from, to: custom.to } : { period: period === "custom" ? "30d" as const : period };
  const dash = useOp("dashboard.get", input);
  const plan = useOp("plan.get", {});
  const notifs = useOp("notifications.list", { unreadOnly: true, limit: 3 });
  const deals = useOp("deals.list", {});
  const aids = useOp("aids.list", {});
  const profile = useOp("profile.get", {});
  const earn = useOp("earn.search", {}, { enabled: !!profile.data?.preferences.opportunities_enabled });

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <ErrorState message={dash.error.message} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const name = profile.data?.profile.display_name?.split(" ")[0];

  if (!d.hasData) {
    return (
      <>
        <PageHeader title={`Bienvenue${name ? `, ${name}` : ""} 👋`} description="Commence par ajouter ton compte principal ou importer un relevé : BUDGETLY calculera ta situation réelle." />
        <EmptyState icon={Wallet} title="Aucun compte pour l'instant" description="Ajoute un compte avec son solde actuel, ou importe directement un relevé CSV de ta banque."
          action={<div className="flex flex-wrap justify-center gap-2"><Button asChild><Link href="/app/accounts?new=1"><Plus /> Ajouter un compte</Link></Button><Button variant="outline" asChild><Link href="/app/import"><Upload /> Importer un CSV</Link></Button></div>} />
      </>
    );
  }

  const c = d.cards;
  const donut = d.breakdown.items.map((i) => ({ key: i.categoryId ?? "none", name: i.name, value: i.amount, color: i.color }));
  const selected = d.breakdown.items.find((i) => (i.categoryId ?? "none") === selectedCat);
  const actions = (plan.data?.items ?? []).filter((i) => i.status === "todo" || i.status === "in_progress").slice(0, 3);
  const potentialAids = (aids.data?.aids ?? []).filter((a) => a.eligibility.status === "potential" && !a.application);

  return (
    <>
      <PageHeader title={`Bonjour${name ? ` ${name}` : ""}`} description={`Ta situation au ${fmt.longDay(d.today)}.`}
        actions={<><Button onClick={() => setTxOpen(true)}><Plus /> Opération</Button><Button variant="outline" asChild><Link href="/app/action-plan"><ListChecks /> Mon plan</Link></Button></>} />

      {c.forecastEndOfMonth < 0 ? (
        <Link href="/app/action-plan" className="mb-5 flex items-center gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4 text-sm transition hover:border-danger/50">
          <AlertTriangle className="size-5 shrink-0 text-danger" />
          <p className="flex-1"><strong className="text-danger">Risque de fin de mois :</strong> au rythme actuel, ton solde pourrait atteindre <strong>{formatMoney(c.forecastEndOfMonth)}</strong>. Ton plan d'action propose des solutions concrètes.</p>
          <ArrowRight className="size-4 text-danger" />
        </Link>
      ) : null}

      <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi highlight label="Solde disponible" value={c.availableBalance} help="Comptes courants, espèces et portefeuilles (hors épargne), opérations en attente incluses." />
        <Kpi label="Reste à vivre (fin de mois)" value={c.leftToLive} tone="auto" help="Solde disponible + revenus récurrents attendus d'ici la fin du mois − charges fixes restantes (loyer, abonnements…)." />
        <Kpi label="Prévision fin de mois" value={c.forecastEndOfMonth} tone="auto" help="Scénario réaliste : reste à vivre − dépenses variables moyennes estimées pour les jours restants." sub={`Fiabilité ${c.forecastReliability === "high" ? "bonne" : c.forecastReliability === "medium" ? "moyenne" : "faible"}`} />
        <Kpi label="Revenus du mois" value={c.monthIncome} tone="positive" help="Revenus comptabilisés depuis le 1er du mois. Les transferts entre tes comptes ne sont jamais comptés." />
        <Kpi label="Dépenses du mois" value={c.monthExpenses} help="Dépenses comptabilisées depuis le 1er du mois, hors transferts internes." />
        <Kpi label="Solde total" value={c.totalBalance} help="Somme des soldes comptables de tous tes comptes actifs, épargne comprise." />
        <Kpi label="Charges fixes restantes" value={c.fixedChargesRemaining} help="Échéances récurrentes et abonnements prévus d'ici la fin du mois, non encore enregistrés." />
        <Kpi label="En attente" value={c.pending} help="Opérations saisies comme « en attente » : pas encore débitées ou créditées." />
        <Kpi label="Épargne disponible" value={c.savingsAvailable} help="Solde de tes comptes d'épargne." />
        <Kpi label="Épargne du mois" value={c.savedThisMonth} tone="auto" help="Variation nette de tes comptes d'épargne depuis le 1er du mois (virements compris)." />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-wrap">
            <CardTitle>Trésorerie</CardTitle>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>{PERIODS.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}<TabsTrigger value="custom">Perso.</TabsTrigger></TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {period === "custom" ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2">Du <input type="date" aria-label="Date de début" className="rounded-lg border border-border bg-surface px-2 py-1" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
                <label className="flex items-center gap-2">au <input type="date" aria-label="Date de fin" className="rounded-lg border border-border bg-surface px-2 py-1" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
              </div>
            ) : null}
            <BalanceChart data={d.series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dépenses du mois</CardTitle><Badge tone="neutral">Cliquer pour filtrer</Badge></CardHeader>
          <CardContent>
            {donut.length ? (
              <>
                <DonutChart data={donut} selected={selectedCat} onSelect={(k) => setSelectedCat(selectedCat === k ? null : k)} centerLabel={selected?.name ?? "Total"} centerValue={formatMoney(selected?.amount ?? d.breakdown.total, { compact: true })} />
                <ul className="mt-2 space-y-1.5 text-sm">
                  {d.breakdown.items.slice(0, 6).map((i) => (
                    <li key={i.categoryId ?? "none"}>
                      <button onClick={() => setSelectedCat(selectedCat === (i.categoryId ?? "none") ? null : i.categoryId ?? "none")} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface-2 ${selectedCat === (i.categoryId ?? "none") ? "bg-surface-2" : ""}`} aria-pressed={selectedCat === (i.categoryId ?? "none")}>
                        <span className="size-2.5 rounded-full" style={{ background: i.color }} />
                        <span className="flex-1 truncate">{i.name}</span>
                        <span className="text-muted">{i.percent} %</span>
                        <Money value={i.amount} className="w-20 text-right font-medium" />
                      </button>
                    </li>
                  ))}
                </ul>
                {selected ? (
                  <Link className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand" href={`/app/transactions?category=${selected.categoryId ?? "none"}&from=${d.today.slice(0, 8)}01`}>
                    Voir les opérations « {selected.name} » <ArrowRight className="size-3.5" />
                  </Link>
                ) : null}
              </>
            ) : <p className="py-10 text-center text-sm text-muted">Aucune dépense ce mois-ci.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-brand" /> Actions recommandées</CardTitle><Link href="/app/action-plan" className="text-sm font-semibold text-brand">Tout voir</Link></CardHeader>
          <CardContent className="space-y-2">
            {plan.isPending ? <Skeleton className="h-28" /> : actions.length ? actions.map((a) => (
              <Link key={a.id} href={a.href ?? "/app/action-plan"} className="flex items-start gap-3 rounded-xl border border-border p-3 transition hover:border-brand/40 hover:bg-surface-2">
                <span className="mt-0.5 rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular">{a.priority}</span>
                <span className="flex-1"><span className="block text-sm font-semibold">{a.title}</span><span className="mt-0.5 block text-xs text-muted">{a.rationale}</span></span>
                <ArrowRight className="mt-1 size-4 text-muted" />
              </Link>
            )) : <p className="text-sm text-muted">Aucune action en attente cette semaine. 🎉</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4 text-brand" /> Alertes</CardTitle><Link href="/app/notifications" className="text-sm font-semibold text-brand">Centre</Link></CardHeader>
          <CardContent className="space-y-2">
            {(notifs.data?.notifications ?? []).length ? notifs.data!.notifications.map((n) => (
              <Link key={n.id} href={n.action_href ?? "/app/notifications"} className="block rounded-xl border border-border p-3 hover:bg-surface-2">
                <div className="flex items-center gap-2"><Badge tone={n.priority === "critical" || n.priority === "high" ? "danger" : n.priority === "medium" ? "warning" : "neutral"}>{n.priority === "critical" ? "Critique" : n.priority === "high" ? "Haute" : n.priority === "medium" ? "Moyenne" : "Info"}</Badge><span className="truncate text-sm font-semibold">{n.title}</span></div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{n.body}</p>
              </Link>
            )) : <p className="text-sm text-muted">Aucune alerte non lue.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Dernières opérations</CardTitle><Link href="/app/transactions" className="text-sm font-semibold text-brand">Tout voir</Link></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {d.recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.categoryColor ?? "#CBD5E1" }} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.label}</p><p className="text-xs text-muted">{fmt.day(t.date)} · {t.type.startsWith("transfer") ? "Transfert" : t.categoryName ?? "Non catégorisé"}</p></div>
                  <Money value={t.type === "income" || t.type === "transfer_in" ? t.amount_minor : -t.amount_minor} sign colored={!t.type.startsWith("transfer")} className="text-sm font-semibold" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-brand" /> Prochaines échéances</CardTitle><Link href="/app/forecast" className="text-sm font-semibold text-brand">Prévisions</Link></CardHeader>
          <CardContent>
            {d.upcoming.length ? (
              <ul className="divide-y divide-border">
                {d.upcoming.map((u) => (
                  <li key={`${u.sourceId}-${u.date}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{u.label}</p><p className="text-xs text-muted">{fmt.longDay(u.date)}</p></div>
                    <Money value={u.type === "income" ? u.amount_minor : -u.amount_minor} sign colored className="text-sm font-semibold" />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucune échéance dans les 14 prochains jours.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Budgets du mois</CardTitle><Link href="/app/budgets" className="text-sm font-semibold text-brand">Gérer</Link></CardHeader>
          <CardContent className="space-y-3.5">
            {d.budgets.length ? d.budgets.map((b) => (
              <div key={b.budget.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{b.category?.name ?? "Budget global"}</span><span className="tabular text-muted">{formatMoney(b.spent, { compact: true })} / {formatMoney(b.budget.amount_minor, { compact: true })}</span></div>
                <ProgressBar value={b.percentUsed} tone={b.level === "ok" ? "positive" : b.level === "warning" ? "warning" : "danger"} label={`${b.category?.name ?? "Budget global"} : ${b.percentUsed} %`} />
              </div>
            )) : <p className="text-sm text-muted">Pas encore de budget ce mois-ci. <Link className="font-semibold text-brand" href="/app/budgets">En créer un</Link></p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4 text-brand" /> Objectifs d'épargne</CardTitle><Link href="/app/goals" className="text-sm font-semibold text-brand">Voir</Link></CardHeader>
          <CardContent className="space-y-3.5">
            {d.goals.length ? d.goals.map((g) => (
              <div key={g.goal.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{g.goal.name}</span><span className="tabular text-muted">{g.percent} %</span></div>
                <ProgressBar value={g.percent} label={`${g.goal.name} : ${g.percent} %`} />
                <p className="mt-1 text-xs text-muted">{formatMoney(g.allocated)} sur {formatMoney(g.goal.target_minor)}{g.requiredMonthly ? ` · ${formatMoney(g.requiredMonthly)}/mois nécessaires` : ""}</p>
              </div>
            )) : <p className="text-sm text-muted">Aucun objectif actif.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="size-4 text-brand" /> Économies potentielles</CardTitle><Link href="/app/deals" className="text-sm font-semibold text-brand">Explorer</Link></CardHeader>
          <CardContent className="space-y-2">
            {(deals.data?.suggestions ?? []).slice(0, 3).map((s) => {
              const deal = deals.data!.deals.find((x) => x.slug === s.slug)!;
              return <Link key={s.slug} href={`/app/deals?deal=${s.slug}`} className="block rounded-xl border border-border p-3 hover:bg-surface-2"><p className="text-sm font-semibold">{deal.title}</p><p className="text-xs text-muted">{s.reason}</p></Link>;
            })}
            {deals.data && !deals.data.suggestions.length ? <p className="text-sm text-muted">Aucune suggestion liée à tes dépenses pour l'instant.</p> : null}
            <p className="text-xs text-muted">Économies potentielles : rien n'est compté comme déjà gagné.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HandHeart className="size-4 text-brand" /> Aides & opportunités</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Link href="/app/aids" className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-surface-2">
              <span><strong>{potentialAids.length}</strong> aide(s) à vérifier selon ton profil</span><ArrowRight className="size-4 text-muted" />
            </Link>
            {profile.data?.preferences.opportunities_enabled ? (
              <Link href="/app/earn" className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-surface-2">
                <span className="flex items-center gap-2"><Briefcase className="size-4 text-brand" /> {earn.data ? `${earn.data.results.length} opportunité(s) ${earn.data.results.some((r) => r.isExample) ? "d'exemple" : ""}` : "Opportunités"}</span><ArrowRight className="size-4 text-muted" />
              </Link>
            ) : <Link href="/app/settings" className="block rounded-xl border border-dashed border-border p-3 text-muted hover:bg-surface-2">Active les opportunités de revenus dans tes paramètres.</Link>}
          </CardContent>
        </Card>
      </div>

      <TransactionFormDialog open={txOpen} onOpenChange={setTxOpen} />
    </>
  );
}
