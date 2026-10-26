"use client";
import { Download, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useMode } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form-controls";
import { Badge, Modal, Notice, Skeleton, Switch } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { ALERT_KIND_LABELS } from "@/features/alerts/engine";
import { AGE_LABELS, HOUSING_LABELS, OBJECTIVE_LABELS, STATUS_LABELS } from "@/features/profile/labels";
import { callOp, resetDemo, setDemoCookie } from "@/lib/ops/client";
import { fmt } from "@/lib/dates";
import { minorToInput, parseAmount } from "@/lib/money";
import { downloadText } from "@/lib/utils";
import type { ConsentPurpose, Frequency } from "@/types/db";

const CONSENTS: { purpose: ConsentPurpose; title: string; text: string }[] = [
  { purpose: "aid_eligibility", title: "Estimation des aides", text: "Utiliser mon statut, mon logement, ma tranche d'âge et mes revenus pour estimer les aides possibles." },
  { purpose: "opportunity_matching", title: "Recommandation d'opportunités", text: "Utiliser mes disponibilités et compétences pour trier les offres de missions." },
  { purpose: "ai_coach", title: "Coach IA (Anthropic)", text: "Transmettre ma question et la réponse calculée à un fournisseur d'IA pour reformulation. Jamais mon historique." },
  { purpose: "product_emails", title: "E-mails produit", text: "Recevoir des e-mails d'information sur BUDGETLY (aucun envoi n'est configuré actuellement)." },
];
const FREQ: Record<Frequency, string> = { weekly: "Hebdo", monthly: "Mensuel", quarterly: "Trimestriel", yearly: "Annuel" };

export default function SettingsPage() {
  const router = useRouter();
  const mode = useMode();
  const q = useOp("profile.get", {});
  const cats = useOp("categories.list", {});
  const recurring = useOp("recurring.list", {});
  const accounts = useOp("accounts.list", { includeArchived: false });
  const updateProfile = useMutationOp("profile.update", { success: "Profil enregistré" });
  const updatePrefs = useMutationOp("preferences.update", { success: "Préférences enregistrées" });
  const setConsent = useMutationOp("consents.set", { success: "Consentement mis à jour" });
  const createCat = useMutationOp("categories.create", { success: "Catégorie créée" });
  const delCat = useMutationOp("categories.delete");
  const delRule = useMutationOp("rules.delete");
  const createRec = useMutationOp("recurring.create", { success: "Échéance créée" });
  const updRec = useMutationOp("recurring.update");
  const delRec = useMutationOp("recurring.delete");
  const [p, setP] = useState({ display_name: "", status: "", age_range: "", housing: "", city: "", income: "", threshold: "", objectives: [] as string[], has_scholarship: false, has_professional_income: false, receives_housing_aid: false });
  const [newCat, setNewCat] = useState({ name: "", kind: "expense" as "expense" | "income" | "both", color: "#64748B", essential: false });
  const [rec, setRec] = useState({ label: "", type: "expense" as "income" | "expense", amount: "", frequency: "monthly" as Frequency, start: "", account: "" });
  const [delOpen, setDelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    const pr = q.data?.profile;
    if (pr) setP({ display_name: pr.display_name ?? "", status: pr.status ?? "", age_range: pr.age_range ?? "", housing: pr.housing ?? "", city: pr.city ?? "", income: minorToInput(pr.monthly_income_minor), threshold: minorToInput(pr.safety_threshold_minor), objectives: pr.objectives, has_scholarship: !!pr.has_scholarship, has_professional_income: !!pr.has_professional_income, receives_housing_aid: !!pr.receives_housing_aid });
  }, [q.data?.profile]);

  if (q.isPending) return <Skeleton className="h-96" />;
  const prefs = q.data?.preferences;
  const ns = prefs?.notification_settings ?? {};
  const consent = (k: ConsentPurpose) => q.data?.consents.find((c) => c.purpose === k)?.granted ?? false;

  const exportData = async () => {
    const data = await callOp("account.export", {});
    downloadText(`budgetly-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const deleteAccount = async () => {
    setDelError(null);
    if (mode === "demo") { setDemoCookie(false); await resetDemo(); router.replace("/"); return; }
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: confirmText }) });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setDelError(json?.error?.message ?? "Suppression impossible");
    router.replace("/?compte=supprime");
  };

  return (
    <>
      <PageHeader title="Paramètres" description="Ton profil, tes préférences, tes consentements et tes données." actions={<ThemeToggle />} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profil financier</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({
                display_name: p.display_name || null, status: (p.status || null) as never, age_range: (p.age_range || null) as never, housing: (p.housing || null) as never, city: p.city || null,
                monthly_income_minor: p.income ? parseAmount(p.income) : null, safety_threshold_minor: parseAmount(p.threshold || "0") ?? 0, objectives: p.objectives as never,
                has_scholarship: p.has_scholarship, has_professional_income: p.has_professional_income, receives_housing_aid: p.receives_housing_aid,
              });
            }}>
              <Field label="Prénom ou pseudo" htmlFor="s-name"><Input id="s-name" value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} maxLength={80} /></Field>
              <Field label="Ville (facultatif)" htmlFor="s-city"><Input id="s-city" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} maxLength={80} /></Field>
              <Field label="Statut" htmlFor="s-status"><Select id="s-status" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}><option value="">Non renseigné</option>{Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Tranche d'âge" htmlFor="s-age"><Select id="s-age" value={p.age_range} onChange={(e) => setP({ ...p, age_range: e.target.value })}><option value="">Non renseignée</option>{Object.entries(AGE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Logement" htmlFor="s-housing"><Select id="s-housing" value={p.housing} onChange={(e) => setP({ ...p, housing: e.target.value })}><option value="">Non renseigné</option>{Object.entries(HOUSING_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Revenus mensuels moyens" htmlFor="s-income"><MoneyInput id="s-income" value={p.income} onChange={(e) => setP({ ...p, income: e.target.value })} /></Field>
              <Field label="Seuil de sécurité" htmlFor="s-th" hint="Solde minimum que tu veux toujours garder."><MoneyInput id="s-th" value={p.threshold} onChange={(e) => setP({ ...p, threshold: e.target.value })} /></Field>
              <div className="grid gap-2 text-sm sm:col-span-2">
                {([["has_scholarship", "Je suis boursier·e"], ["has_professional_income", "J'ai des revenus d'activité"], ["receives_housing_aid", "Je perçois une aide au logement"]] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between"><span>{l}</span><Switch label={l} checked={p[k]} onCheckedChange={(v) => setP({ ...p, [k]: v })} /></label>)}
              </div>
              <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Mes objectifs</legend><div className="flex flex-wrap gap-2">{Object.entries(OBJECTIVE_LABELS).map(([k, l]) => <button type="button" key={k} aria-pressed={p.objectives.includes(k)} onClick={() => setP({ ...p, objectives: p.objectives.includes(k) ? p.objectives.filter((x) => x !== k) : [...p.objectives, k] })} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs ${p.objectives.includes(k) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>{l}</button>)}</div></fieldset>
              <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={updateProfile.isPending}>Enregistrer</Button></div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Préférences</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-center justify-between gap-3"><span>Gamification (défis et badges)</span><Switch label="Gamification" checked={!!prefs?.gamification_enabled} onCheckedChange={(v) => updatePrefs.mutate({ gamification_enabled: v })} /></label>
              <label className="flex items-center justify-between gap-3"><span>Recommandations d'opportunités de revenus</span><Switch label="Opportunités" checked={!!prefs?.opportunities_enabled} onCheckedChange={(v) => updatePrefs.mutate({ opportunities_enabled: v })} /></label>
            </CardContent>
          </Card>
          <Card id="notifications">
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Priorité minimale" htmlFor="n-min"><Select id="n-min" value={ns.minPriority ?? "low"} onChange={(e) => updatePrefs.mutate({ notification_settings: { ...ns, minPriority: e.target.value as "low" } })}><option value="low">Toutes</option><option value="medium">Moyenne et plus</option><option value="high">Haute et critique</option><option value="critical">Critique uniquement</option></Select></Field>
                <Field label="Maximum par jour" htmlFor="n-max"><Select id="n-max" value={ns.maxPerDay ?? 6} onChange={(e) => updatePrefs.mutate({ notification_settings: { ...ns, maxPerDay: Number(e.target.value) } })}>{[3, 6, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
              </div>
              <p className="font-medium">Types d'alertes</p>
              {Object.entries(ALERT_KIND_LABELS).filter(([k]) => k !== "import_duplicates").map(([k, l]) => {
                const on = !(ns.disabledKinds ?? []).includes(k);
                return <label key={k} className="flex items-center justify-between"><span>{l}</span><Switch label={l} checked={on} onCheckedChange={(v) => updatePrefs.mutate({ notification_settings: { ...ns, disabledKinds: v ? (ns.disabledKinds ?? []).filter((x) => x !== k) : [...(ns.disabledKinds ?? []), k] } })} /></label>;
              })}
              <p className="text-xs text-muted">Les alertes critiques passent toujours le plafond quotidien. Les notifications push et e-mail ne sont pas activées sur cette instance.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> Consentements</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {CONSENTS.map((c) => (
              <div key={c.purpose} className="flex items-start justify-between gap-4"><div><p className="font-medium">{c.title}</p><p className="text-xs text-muted">{c.text}</p></div><Switch label={c.title} checked={consent(c.purpose)} onCheckedChange={(v) => setConsent.mutate({ purpose: c.purpose, granted: v })} /></div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Catégories & règles</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (newCat.name.trim()) createCat.mutate({ name: newCat.name.trim(), kind: newCat.kind, color: newCat.color, icon: "tag", is_essential: newCat.essential }); setNewCat({ ...newCat, name: "" }); }}>
              <Input aria-label="Nom de la catégorie" placeholder="Nouvelle catégorie" className="min-w-40 flex-1" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} maxLength={40} />
              <Select aria-label="Type" className="w-32" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as "expense" })}><option value="expense">Dépense</option><option value="income">Revenu</option><option value="both">Les deux</option></Select>
              <input aria-label="Couleur" type="color" className="h-10 w-12 cursor-pointer rounded-xl border border-border" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} />
              <Button type="submit"><Plus /> Créer</Button>
            </form>
            <div className="flex flex-wrap gap-2">{cats.data?.categories.filter((c) => c.user_id).map((c) => <Badge key={c.id} className="gap-2"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}<button aria-label={`Supprimer ${c.name}`} className="cursor-pointer" onClick={() => delCat.mutate({ id: c.id })}><Trash2 /></button></Badge>)}</div>
            <div>
              <p className="mb-2 font-medium">Règles de catégorisation mémorisées</p>
              {cats.data?.rules.length ? <ul className="max-h-56 divide-y divide-border overflow-auto">{cats.data.rules.map((r) => <li key={r.id} className="flex items-center justify-between py-1.5"><span>« {r.pattern} » → {cats.data!.categories.find((c) => c.id === r.category_id)?.name}</span><Button size="icon-sm" variant="ghost" aria-label="Supprimer la règle" onClick={() => delRule.mutate({ id: r.id })}><Trash2 /></Button></li>)}</ul> : <p className="text-muted">Aucune règle. Elles sont créées quand tu corriges une catégorie en cochant « Mémoriser ».</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenus et charges récurrents</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted">Salaire, loyer, bourse… Les échéances passées sont enregistrées automatiquement (sans doublon) et les futures alimentent les prévisions.</p>
            <ul className="divide-y divide-border">{recurring.data?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className={r.is_active ? "" : "text-muted line-through"}>{r.label} · <Money value={r.type === "income" ? r.amount_minor : -r.amount_minor} sign colored /> · {FREQ[r.frequency]} · prochaine le {fmt.day(r.next_date)}</span>
                <span className="flex items-center gap-2"><Switch label="Active" checked={r.is_active} onCheckedChange={(v) => updRec.mutate({ id: r.id, is_active: v })} /><Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => delRec.mutate({ id: r.id })}><Trash2 /></Button></span>
              </li>
            ))}</ul>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); const a = parseAmount(rec.amount); const acc = rec.account || accounts.data?.accounts[0]?.id; if (!rec.label || !a || a <= 0 || !rec.start || !acc) return; createRec.mutate({ account_id: acc, label: rec.label, type: rec.type, amount_minor: a, frequency: rec.frequency, start_date: rec.start, category_id: null }); setRec({ ...rec, label: "", amount: "" }); }}>
              <Input aria-label="Libellé" placeholder="Libellé (ex. Loyer)" value={rec.label} onChange={(e) => setRec({ ...rec, label: e.target.value })} maxLength={120} />
              <Select aria-label="Type" value={rec.type} onChange={(e) => setRec({ ...rec, type: e.target.value as "income" })}><option value="expense">Dépense</option><option value="income">Revenu</option></Select>
              <MoneyInput aria-label="Montant" placeholder="Montant" value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} />
              <Select aria-label="Fréquence" value={rec.frequency} onChange={(e) => setRec({ ...rec, frequency: e.target.value as Frequency })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              <Input aria-label="Première échéance" type="date" value={rec.start} onChange={(e) => setRec({ ...rec, start: e.target.value })} />
              <Select aria-label="Compte" value={rec.account} onChange={(e) => setRec({ ...rec, account: e.target.value })}>{accounts.data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
              <Button type="submit" className="sm:col-span-3"><Plus /> Ajouter l'échéance</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Mes données</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="max-w-2xl text-muted">Exporte l'intégralité de tes données (JSON) ou supprime définitivement ton compte. Tes données ne sont jamais vendues ni utilisées à des fins publicitaires.</p>
            <div className="flex gap-2"><Button variant="outline" onClick={exportData}><Download /> Exporter mes données</Button><Button variant="danger" onClick={() => setDelOpen(true)}><Trash2 /> {mode === "demo" ? "Effacer la démo" : "Supprimer mon compte"}</Button></div>
          </CardContent>
        </Card>
      </div>
      <Modal open={delOpen} onOpenChange={setDelOpen} title={mode === "demo" ? "Effacer les données de démonstration ?" : "Supprimer définitivement ton compte ?"} description={mode === "demo" ? "Les données fictives de ce navigateur seront effacées." : "Toutes tes données (comptes, opérations, objectifs, démarches…) seront supprimées de façon irréversible."}
        footer={<><Button variant="ghost" onClick={() => setDelOpen(false)}>Annuler</Button><Button variant="danger" disabled={mode !== "demo" && confirmText !== "SUPPRIMER"} onClick={deleteAccount}>Confirmer</Button></>}>
        {mode !== "demo" ? <Field label="Tape SUPPRIMER pour confirmer" htmlFor="del-confirm" error={delError ?? undefined}><Input id="del-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></Field> : <Notice>Tu seras redirigé vers l'accueil.</Notice>}
      </Modal>
    </>
  );
}
