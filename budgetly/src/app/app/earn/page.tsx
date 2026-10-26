"use client";
import { Bookmark, BookmarkCheck, Briefcase, Calculator, ChevronDown, ExternalLink, Info, MapPin, Search, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { BarsChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/page-header";
import { SourceLine } from "@/components/sources/source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/form-controls";
import { Badge, EmptyState, ErrorState, Modal, Notice, ProgressBar, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { INCOME_DECLARATION_GUIDE, OPPORTUNITY_CATEGORIES } from "@/data/job-platforms";
import { profitability } from "@/features/earn/service";
import { fmt } from "@/lib/dates";
import { formatMoney, minorToInput, parseAmount } from "@/lib/money";
import type { JobApplicationRow, JobStatus } from "@/types/db";

const STATUS: Record<JobStatus, string> = { saved: "Sauvegardée", applied: "Candidature envoyée", interview: "Entretien", accepted: "Acceptée", rejected: "Refusée", withdrawn: "Abandonnée", completed: "Mission réalisée" };
const DAYS = [["mon", "Lun"], ["tue", "Mar"], ["wed", "Mer"], ["thu", "Jeu"], ["fri", "Ven"], ["sat", "Sam"], ["sun", "Dim"]] as const;

function Opportunities() {
  const [filters, setFilters] = useState({ keywords: "", location: "", category: "", remote: false, minHourly: "" });
  const [applied, setApplied] = useState(filters);
  const [sort, setSort] = useState<"score" | "date" | "pay">("score");
  const [open, setOpen] = useState<string | null>(null);
  const q = useOp("earn.search", { keywords: applied.keywords || undefined, location: applied.location || undefined, category: applied.category || undefined, remote: applied.remote || undefined, minHourlyMinor: parseAmount(applied.minHourly) ?? undefined, sort });
  const apps = useOp("earn.applications", {});
  const save = useMutationOp("earn.save", { success: "Offre sauvegardée" });
  const savedIds = new Set((apps.data?.applications ?? []).map((a) => `${a.provider}:${a.external_id}`));
  const enabledProviders = q.data?.providers.filter((p) => p.enabled) ?? [];

  return (
    <div className="grid gap-4">
      <Card className="p-3">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
          <Input aria-label="Mots-clés" placeholder="Mots-clés (ex. accueil, cours)" className="lg:col-span-2" value={filters.keywords} onChange={(e) => setFilters({ ...filters, keywords: e.target.value })} />
          <Input aria-label="Localisation" placeholder="Département (ex. 69)" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
          <Select aria-label="Catégorie" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">Toutes catégories</option>{Object.entries(OPPORTUNITY_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <MoneyInput aria-label="Taux horaire minimum" placeholder="Min. €/h" value={filters.minHourly} onChange={(e) => setFilters({ ...filters, minHourly: e.target.value })} />
          <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#7357F6]" checked={filters.remote} onChange={(e) => setFilters({ ...filters, remote: e.target.checked })} /> À distance</label><Button type="submit" size="sm" className="ml-auto"><Search /> Chercher</Button></div>
        </form>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">Sources actives : {enabledProviders.length ? enabledProviders.map((p) => p.name).join(", ") : "aucune"}</p>
        <Select aria-label="Trier" className="h-9 w-48" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="score">Pertinence</option><option value="date">Plus récentes</option><option value="pay">Rémunération</option></Select>
      </div>
      {q.data?.results.some((r) => r.isExample) ? <Notice tone="warning" icon={Info}><strong>Exemples de démonstration :</strong> ces missions sont fictives et servent uniquement à illustrer le fonctionnement. Aucune n'est une vraie offre.</Notice> : null}
      {q.data && !q.data.hasAvailability ? <Notice icon={Info}>Renseigne tes disponibilités (onglet « Disponibilités ») pour obtenir un score de compatibilité personnalisé.</Notice> : null}
      {q.data?.errors.map((e) => <Notice key={e} tone="danger">{e}</Notice>)}
      {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <ErrorState message={q.error.message} /> : q.data.results.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.results.map((o) => {
            const key = `${o.provider}:${o.externalId}`;
            return (
              <Card key={key} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">{o.isExample ? <Badge tone="warning">Exemple fictif</Badge> : null}<Badge>{OPPORTUNITY_CATEGORIES[o.category] ?? o.category}</Badge>{o.contractType ? <Badge>{o.contractType}</Badge> : null}{o.remote ? <Badge tone="brand">À distance</Badge> : null}</div>
                    <h3 className="mt-2 font-semibold">{o.title}</h3>
                    <p className="text-sm text-muted">{o.employer ?? "Employeur non communiqué"}{o.location ? <> · <MapPin className="inline size-3" /> {o.location}</> : null}</p>
                  </div>
                  <div className="text-center"><p className="font-display text-2xl font-bold text-brand">{o.score}</p><p className="text-[10px] uppercase text-muted">score</p></div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div><dt className="text-muted">Rémunération</dt><dd className="font-semibold">{o.payLabel ?? "Non précisée"}</dd></div>
                  <div><dt className="text-muted">Taux horaire estimé</dt><dd className="font-semibold">{o.hourlyRateMinor ? `${formatMoney(o.hourlyRateMinor)} brut` : "—"}</dd></div>
                  <div><dt className="text-muted">Durée</dt><dd className="font-semibold">{o.durationLabel ?? "—"}</dd></div>
                  <div><dt className="text-muted">Publiée</dt><dd className="font-semibold">{o.postedAt ? fmt.day(o.postedAt) : "—"}</dd></div>
                </dl>
                <p className="mt-3 line-clamp-3 text-sm">{o.description}</p>
                <button className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>Pourquoi ce score ? <ChevronDown className={`size-3 transition ${open === key ? "rotate-180" : ""}`} /></button>
                {open === key ? <ul className="mt-2 space-y-1 rounded-xl bg-surface-2 p-3 text-xs">{o.factors.map((f) => <li key={f.label} className="flex justify-between gap-3"><span><strong>{f.label}</strong> — {f.detail}</span><span className="tabular">{f.points}/{f.max}</span></li>)}</ul> : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-xs text-muted">Source : {o.sourceName} · récupérée le {fmt.day(o.fetchedAt.slice(0, 10))}</p>
                  <div className="flex gap-2">
                    {o.url ? <Button size="sm" variant="outline" asChild><a href={o.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Postuler</a></Button> : null}
                    <Button size="sm" variant={savedIds.has(key) ? "secondary" : "primary"} disabled={savedIds.has(key) || save.isPending}
                      onClick={() => save.mutate({ provider: o.provider, external_id: o.externalId, is_example: o.isExample, title: o.title, employer: o.employer, location: o.location, url: o.url, category: o.category, pay_label: o.payLabel, snapshot: { hourlyRateMinor: o.hourlyRateMinor, durationHours: o.durationHours, durationLabel: o.durationLabel, sourceName: o.sourceName, fetchedAt: o.fetchedAt } })}>
                      {savedIds.has(key) ? <><BookmarkCheck /> Sauvegardée</> : <><Bookmark /> Sauvegarder</>}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Briefcase} title={enabledProviders.length ? "Aucune offre pour ces critères" : "Aucune source d'offres connectée"} description={enabledProviders.length ? "Élargis ta recherche ou consulte les plateformes ci-dessous." : "BUDGETLY n'invente aucune annonce. L'intégration France Travail s'active dès que l'accès API est configuré ; en attendant, voici des plateformes fiables."} />
      )}
      <Card>
        <CardHeader><CardTitle>Plateformes pour trouver une mission</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data?.platforms.map((p) => (
            <div key={p.slug} className="rounded-xl border border-border p-3">
              <p className="font-semibold">{p.name} {p.official ? <Badge tone="positive">Public</Badge> : null}</p>
              <p className="mt-1 text-xs text-muted">{p.description}</p>
              <div className="mt-2"><SourceLine source={p.source} status={p.source.status} /></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Applications() {
  const q = useOp("earn.applications", {});
  const update = useMutationOp("earn.update", { success: "Candidature mise à jour" });
  const del = useMutationOp("earn.delete");
  const setTarget = useMutationOp("earn.setTarget", { success: "Objectif enregistré" });
  const [editing, setEditing] = useState<JobApplicationRow | null>(null);
  const [form, setForm] = useState({ status: "saved" as JobStatus, notes: "", reminder: "", earned: "" });
  const [target, setTargetInput] = useState("");
  useEffect(() => { if (editing) setForm({ status: editing.status, notes: editing.notes ?? "", reminder: editing.reminder_date ?? "", earned: minorToInput(editing.earned_minor) }); }, [editing]);
  useEffect(() => { if (q.data?.target !== undefined && q.data.target !== null) setTargetInput(minorToInput(q.data.target)); }, [q.data?.target]);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const d = q.data;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {d.applications.length ? d.applications.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5"><Badge tone={a.status === "completed" || a.status === "accepted" ? "positive" : a.status === "rejected" || a.status === "withdrawn" ? "neutral" : "brand"}>{STATUS[a.status]}</Badge>{a.is_example ? <Badge tone="warning">Exemple fictif</Badge> : null}</div>
              <p className="mt-1.5 font-semibold">{a.title}</p>
              <p className="text-xs text-muted">{a.employer}{a.location ? ` · ${a.location}` : ""}{a.reminder_date ? ` · rappel le ${fmt.day(a.reminder_date)}` : ""}{a.earned_minor ? ` · perçu ${formatMoney(a.earned_minor)}` : ""}</p>
              {a.notes ? <p className="mt-1 text-xs italic text-muted">« {a.notes} »</p> : null}
            </div>
            <div className="flex gap-2">{a.url ? <Button size="sm" variant="ghost" asChild><a href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a></Button> : null}<Button size="sm" variant="outline" onClick={() => setEditing(a)}>Suivre</Button><Button size="sm" variant="ghost" className="text-danger" onClick={() => del.mutate({ id: a.id })}>Retirer</Button></div>
          </Card>
        )) : <EmptyState icon={Bookmark} title="Aucune offre suivie" description="Sauvegarde une offre pour suivre ta candidature, ajouter des notes et un rappel." />}
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4 text-brand" /> Objectif de revenus</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">Revenus complémentaires <strong>réellement perçus</strong> ce mois-ci (missions marquées « réalisées »).</p>
            <p className="font-display text-2xl font-bold"><Money value={d.earnedThisMonth} />{d.target ? <span className="text-sm font-normal text-muted"> / {formatMoney(d.target)}</span> : null}</p>
            {d.target ? <ProgressBar value={Math.round((d.earnedThisMonth / d.target) * 100)} tone="positive" label="Progression de l'objectif" /> : null}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = parseAmount(target); if (v !== null && v >= 0) setTarget.mutate({ monthly_target_minor: v }); }}>
              <MoneyInput aria-label="Objectif mensuel" value={target} onChange={(e) => setTargetInput(e.target.value)} placeholder="Objectif / mois" /><Button type="submit" size="md" variant="outline">OK</Button>
            </form>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Historique des revenus perçus</CardTitle></CardHeader><CardContent><BarsChart height={180} data={d.history.map((h) => ({ ...h }))} xKey="month" xFormat={(m) => fmt.shortMonth(m)} bars={[{ key: "earned", name: "Perçu", color: "#22C55E" }]} /><p className="mt-2 text-xs text-muted">Total perçu : <Money value={d.earnedTotal} /></p></CardContent></Card>
      </div>
      <Modal open={!!editing} onOpenChange={() => setEditing(null)} title="Suivi de candidature" description={editing?.title}>
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          const earned = form.earned ? parseAmount(form.earned) : null;
          await update.mutateAsync({ id: editing!.id, status: form.status, notes: form.notes || null, reminder_date: form.reminder || null, earned_minor: earned, applied_at: form.status === "applied" && !editing!.applied_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()) : undefined });
          setEditing(null);
        }}>
          <Field label="Statut" htmlFor="j-status"><Select id="j-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Rappel" htmlFor="j-rem"><Input id="j-rem" type="date" value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })} /></Field>
          {form.status === "completed" ? <Field label="Montant réellement perçu" htmlFor="j-earned" hint="Montant net reçu sur ton compte."><MoneyInput id="j-earned" value={form.earned} onChange={(e) => setForm({ ...form, earned: e.target.value })} /></Field> : null}
          <Field label="Notes" htmlFor="j-notes"><Textarea id="j-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function Profitability() {
  const [v, setV] = useState({ mode: "hourly", rate: "12", total: "", hours: "8", travelH: "1", travelCost: "4,20", other: "", contrib: "" });
  const r = profitability({
    hourlyRateMinor: v.mode === "hourly" ? parseAmount(v.rate) : null, grossTotalMinor: v.mode === "total" ? parseAmount(v.total) : null,
    workHours: Number(v.hours.replace(",", ".")) || 0, travelHours: Number(v.travelH.replace(",", ".")) || 0,
    travelCostMinor: parseAmount(v.travelCost || "0") ?? 0, otherCostsMinor: parseAmount(v.other || "0") ?? 0,
    contributionRatePermille: v.contrib ? Math.round(Number(v.contrib.replace(",", ".")) * 10) : null,
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rémunération" htmlFor="p-mode"><Select id="p-mode" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })}><option value="hourly">Taux horaire brut</option><option value="total">Forfait total brut</option></Select></Field>
          {v.mode === "hourly" ? <Field label="Taux horaire" htmlFor="p-rate"><MoneyInput id="p-rate" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></Field> : <Field label="Forfait" htmlFor="p-total"><MoneyInput id="p-total" value={v.total} onChange={(e) => setV({ ...v, total: e.target.value })} /></Field>}
          <Field label="Heures de travail" htmlFor="p-hours"><Input id="p-hours" inputMode="decimal" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field>
          <Field label="Heures de trajet (aller-retour)" htmlFor="p-th"><Input id="p-th" inputMode="decimal" value={v.travelH} onChange={(e) => setV({ ...v, travelH: e.target.value })} /></Field>
          <Field label="Frais de déplacement" htmlFor="p-tc"><MoneyInput id="p-tc" value={v.travelCost} onChange={(e) => setV({ ...v, travelCost: e.target.value })} /></Field>
          <Field label="Autres frais" htmlFor="p-other" hint="Tenue, matériel, repas…"><MoneyInput id="p-other" value={v.other} onChange={(e) => setV({ ...v, other: e.target.value })} /></Field>
          <Field label="Taux de cotisations (%) — facultatif" htmlFor="p-contrib" hint="À vérifier sur ton contrat ou urssaf.fr. Laisse vide si inconnu." className="sm:col-span-2"><Input id="p-contrib" inputMode="decimal" value={v.contrib} onChange={(e) => setV({ ...v, contrib: e.target.value })} placeholder="ex. 22" /></Field>
        </div>
      </Card>
      <Card className="p-5" aria-live="polite">
        <p className="text-sm text-muted">{r.netIsBeforeContributions ? "Revenu estimé après frais, AVANT cotisations" : "Revenu net estimé après frais et cotisations"}</p>
        <p className="mt-1 font-display text-4xl font-bold"><Money value={r.netEstimateMinor} colored /></p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Brut</dt><dd className="font-semibold"><Money value={r.grossMinor} /></dd></div>
          <div><dt className="text-muted">Cotisations</dt><dd className="font-semibold">{r.contributionsMinor === null ? "Non estimées" : <Money value={r.contributionsMinor} />}</dd></div>
          <div><dt className="text-muted">Frais</dt><dd className="font-semibold"><Money value={r.costsMinor} /></dd></div>
          <div><dt className="text-muted">Temps total mobilisé</dt><dd className="font-semibold">{r.totalHours.toLocaleString("fr-FR")} h</dd></div>
          <div className="col-span-2"><dt className="text-muted">Gain réel par heure mobilisée</dt><dd className="text-lg font-bold">{r.effectiveHourlyMinor === null ? "—" : `${formatMoney(r.effectiveHourlyMinor)} / h`}</dd></div>
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </Card>
    </div>
  );
}

function Availability() {
  const q = useOp("profile.get", {});
  const save = useMutationOp("availability.upsert", { success: "Disponibilités enregistrées" });
  const [v, setV] = useState({ days: [] as string[], hours: "", weekend: false, mobility: "public_transport", radius: "10", remote: true, cats: [] as string[], skills: "", minRate: "" });
  useEffect(() => {
    const a = q.data?.availability;
    if (a) setV({ days: a.days, hours: a.hours_per_week?.toString() ?? "", weekend: a.weekend_ok, mobility: a.mobility ?? "public_transport", radius: a.radius_km?.toString() ?? "", remote: a.remote_ok, cats: a.preferred_categories, skills: a.skills.join(", "), minRate: minorToInput(a.min_hourly_rate_minor) });
  }, [q.data?.availability]);
  const toggle = (arr: string[], x: string) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  return (
    <Card className="p-5">
      <Notice className="mb-4">Ces informations servent uniquement à trier les opportunités. Elles ne sont jamais partagées avec un employeur ou une plateforme.</Notice>
      <form className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ days: v.days as ("mon")[], hours_per_week: v.hours ? Math.min(60, Number(v.hours)) : null, weekend_ok: v.weekend, mobility: v.mobility as "public_transport", radius_km: v.radius ? Math.min(200, Number(v.radius)) : null, remote_ok: v.remote, preferred_categories: v.cats, skills: v.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20), min_hourly_rate_minor: v.minRate ? parseAmount(v.minRate) : null });
      }}>
        <fieldset><legend className="mb-2 text-sm font-medium">Jours disponibles</legend><div className="flex flex-wrap gap-2">{DAYS.map(([k, l]) => <button type="button" key={k} aria-pressed={v.days.includes(k)} onClick={() => setV({ ...v, days: toggle(v.days, k) })} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm ${v.days.includes(k) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>{l}</button>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Heures par semaine" htmlFor="a-h"><Input id="a-h" type="number" min={0} max={60} value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field>
          <Field label="Mobilité" htmlFor="a-mob"><Select id="a-mob" value={v.mobility} onChange={(e) => setV({ ...v, mobility: e.target.value })}><option value="none">Limitée</option><option value="walk">À pied</option><option value="bike">Vélo</option><option value="public_transport">Transports en commun</option><option value="car">Voiture</option></Select></Field>
          <Field label="Rayon (km)" htmlFor="a-r"><Input id="a-r" type="number" min={0} max={200} value={v.radius} onChange={(e) => setV({ ...v, radius: e.target.value })} /></Field>
          <Field label="Taux horaire minimum" htmlFor="a-min"><MoneyInput id="a-min" value={v.minRate} onChange={(e) => setV({ ...v, minRate: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm"><label className="flex items-center gap-2"><Switch label="Week-end" checked={v.weekend} onCheckedChange={(x) => setV({ ...v, weekend: x })} /> Disponible le week-end</label><label className="flex items-center gap-2"><Switch label="Distance" checked={v.remote} onCheckedChange={(x) => setV({ ...v, remote: x })} /> Missions à distance</label></div>
        <fieldset><legend className="mb-2 text-sm font-medium">Types de missions préférés</legend><div className="flex flex-wrap gap-2">{Object.entries(OPPORTUNITY_CATEGORIES).map(([k, l]) => <button type="button" key={k} aria-pressed={v.cats.includes(k)} onClick={() => setV({ ...v, cats: toggle(v.cats, k) })} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs ${v.cats.includes(k) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>{l}</button>)}</div></fieldset>
        <Field label="Compétences (séparées par des virgules)" htmlFor="a-sk"><Input id="a-sk" value={v.skills} onChange={(e) => setV({ ...v, skills: e.target.value })} placeholder="ex. anglais, mathématiques, accueil" /></Field>
        <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

export default function EarnPage() {
  const profile = useOp("profile.get", {});
  const prefs = useMutationOp("preferences.update");
  const consent = useMutationOp("consents.set", { success: "Opportunités activées" });
  if (profile.isPending) return <Skeleton className="h-96" />;
  const enabled = profile.data?.preferences.opportunities_enabled;
  return (
    <>
      <PageHeader title="Gagner de l'argent" description="Missions, jobs et revenus complémentaires adaptés à tes disponibilités — sans jamais sacrifier tes études." />
      {!enabled ? (
        <Card className="mb-5 p-5">
          <p className="font-semibold">Activer les recommandations d'opportunités</p>
          <p className="mt-1 text-sm text-muted">BUDGETLY utilisera tes disponibilités et compétences, uniquement pour trier les offres provenant de sources autorisées. Tu peux désactiver à tout moment dans les paramètres.</p>
          <Button className="mt-3" onClick={async () => { await consent.mutateAsync({ purpose: "opportunity_matching", granted: true }); await prefs.mutateAsync({ opportunities_enabled: true }); }}>J'active</Button>
        </Card>
      ) : null}
      <Tabs defaultValue="search">
        <TabsList className="mb-4"><TabsTrigger value="search">Opportunités</TabsTrigger><TabsTrigger value="apps">Mes candidatures</TabsTrigger><TabsTrigger value="calc"><Calculator className="mr-1 inline size-3.5" />Rentabilité</TabsTrigger><TabsTrigger value="avail">Disponibilités</TabsTrigger><TabsTrigger value="declare">Déclarer ses revenus</TabsTrigger></TabsList>
        <TabsContent value="search">{enabled ? <Opportunities /> : <EmptyState icon={Briefcase} title="Recommandations désactivées" description="Active-les ci-dessus pour rechercher des missions." />}</TabsContent>
        <TabsContent value="apps"><Applications /></TabsContent>
        <TabsContent value="calc"><Profitability /></TabsContent>
        <TabsContent value="avail"><Availability /></TabsContent>
        <TabsContent value="declare">
          <div className="grid gap-3 md:grid-cols-2">{INCOME_DECLARATION_GUIDE.map((g) => <Card key={g.title} className="p-5"><h3 className="font-semibold">{g.title}</h3><p className="mt-2 text-sm text-muted">{g.body}</p></Card>)}</div>
          <Notice tone="warning" className="mt-4">Informations générales à visée pédagogique, rédigées sans vérification en ligne des barèmes en vigueur : réfère-toi toujours à impots.gouv.fr, urssaf.fr et service-public.fr.</Notice>
        </TabsContent>
      </Tabs>
    </>
  );
}
