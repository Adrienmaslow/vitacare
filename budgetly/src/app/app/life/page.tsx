"use client";
import { BookOpen, Bus, GraduationCap, Home, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, MoneyInput } from "@/components/ui/form-controls";
import { Badge, Notice, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { CHEAP_MEALS, LESSONS, QUIZ } from "@/data/education";
import { mulDiv, parseAmount } from "@/lib/money";

const p = (s: string) => (s.trim() ? parseAmount(s) ?? 0 : 0);

function Groceries() {
  const list = useOp("shopping.list", {});
  const add = useMutationOp("shopping.add");
  const upd = useMutationOp("shopping.update");
  const rm = useMutationOp("shopping.remove");
  const budgets = useOp("budgets.get", {});
  const [item, setItem] = useState({ name: "", qty: "1", price: "" });
  const items = list.data ?? [];
  const total = items.reduce((s, i) => s + (i.estimated_unit_minor ?? 0) * i.quantity, 0);
  const food = budgets.data?.statuses.find((b) => b.category?.slug === "alimentation");
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Liste de courses planifiée</CardTitle><p className="text-sm">Estimation : <Money value={total} className="font-bold" /></p></CardHeader>
        <CardContent>
          {food ? <Notice className="mb-3" tone={total > food.remaining ? "warning" : "positive"}>Budget alimentation restant ce mois : <Money value={food.remaining} />. {total > food.remaining ? "Cette liste le dépasserait." : "Cette liste tient dans ton budget."}</Notice> : null}
          <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!item.name.trim()) return; add.mutate({ name: item.name.trim(), quantity: Math.max(1, Math.min(99, Number(item.qty) || 1)), estimated_unit_minor: item.price ? parseAmount(item.price) : null }); setItem({ name: "", qty: "1", price: "" }); }}>
            <Input aria-label="Article" placeholder="Article" className="min-w-40 flex-1" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} maxLength={80} />
            <Input aria-label="Quantité" type="number" min={1} max={99} className="w-20" value={item.qty} onChange={(e) => setItem({ ...item, qty: e.target.value })} />
            <div className="w-32"><MoneyInput aria-label="Prix unitaire estimé" placeholder="Prix" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} /></div>
            <Button type="submit"><Plus /> Ajouter</Button>
          </form>
          <ul className="divide-y divide-border">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" aria-label={`Acheté : ${i.name}`} className="size-4 accent-[#7357F6]" checked={i.checked} onChange={(e) => upd.mutate({ id: i.id, checked: e.target.checked })} />
                <span className={`flex-1 ${i.checked ? "text-muted line-through" : ""}`}>{i.quantity} × {i.name}</span>
                <Money value={(i.estimated_unit_minor ?? 0) * i.quantity} className="text-muted" />
                <Button size="icon-sm" variant="ghost" aria-label={`Retirer ${i.name}`} onClick={() => rm.mutate({ ids: [i.id] })}><Trash2 /></Button>
              </li>
            ))}
          </ul>
          {items.some((i) => i.checked) ? <Button size="sm" variant="ghost" className="mt-2" onClick={() => rm.mutate({ ids: items.filter((i) => i.checked).map((i) => i.id) })}>Retirer les articles achetés</Button> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Idées de repas économiques</CardTitle></CardHeader>
        <CardContent><ul className="space-y-3 text-sm">{CHEAP_MEALS.map((m) => <li key={m.name}><p className="font-medium">{m.name}</p><p className="text-xs text-muted">{m.tip}</p></li>)}</ul>
          <Notice className="mt-4" tone="neutral">Économiser ne doit jamais se faire au détriment d'une alimentation suffisante et équilibrée. En cas de difficulté, les épiceries solidaires et le service social du CROUS peuvent aider.</Notice>
        </CardContent>
      </Card>
    </div>
  );
}

function Housing() {
  const [v, setV] = useState({ soloRent: "550", soloCharges: "60", colocRent: "420", colocCharges: "45", aidSolo: "", aidColoc: "", deposit: "1", insurance: "8", furniture: "300", moving: "150" });
  const solo = p(v.soloRent) + p(v.soloCharges) + p(v.insurance) - p(v.aidSolo);
  const coloc = p(v.colocRent) + p(v.colocCharges) + p(v.insurance) - p(v.aidColoc);
  const months = Math.max(0, Math.min(3, Number(v.deposit) || 0));
  const install = p(v.soloRent) * months + p(v.furniture) + p(v.moving) + p(v.soloRent);
  const F = ([k, l, hint]: [keyof typeof v, string, string?]) => <Field key={k} label={l} htmlFor={`h-${k}`} hint={hint}><MoneyInput id={`h-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Seul ou en colocation ?</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 sm:grid-cols-2">{([["soloRent", "Loyer seul"], ["colocRent", "Ta part en colocation"], ["soloCharges", "Charges seul"], ["colocCharges", "Charges coloc (ta part)"], ["aidSolo", "Aide logement estimée seul", "Montant issu du simulateur officiel"], ["aidColoc", "Aide logement estimée coloc"], ["insurance", "Assurance habitation / mois"]] as [keyof typeof v, string, string?][]).map(F)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-sm" aria-live="polite">
          <div><p className="text-muted">Coût mensuel seul</p><p className="text-xl font-bold"><Money value={solo} /></p></div>
          <div><p className="text-muted">En colocation</p><p className="text-xl font-bold"><Money value={coloc} /></p></div>
          <p className="col-span-2">{solo > coloc ? <>La colocation te ferait économiser <Money value={solo - coloc} className="font-semibold text-positive" /> par mois, soit <Money value={(solo - coloc) * 12} className="font-semibold" /> par an.</> : "Dans ces conditions, vivre seul n'est pas plus cher."}</p>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Budget d'installation</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dépôt de garantie (mois de loyer)" htmlFor="h-dep" hint="Plafonné par la loi selon le type de location — vérifie ton bail."><Input id="h-dep" type="number" min={0} max={3} value={v.deposit} onChange={(e) => setV({ ...v, deposit: e.target.value })} /></Field>
          {F(["furniture", "Mobilier & équipement"])}{F(["moving", "Déménagement"])}
        </div>
        <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm"><p className="text-muted">Somme à prévoir à l'entrée (dépôt + 1er loyer + équipement + déménagement)</p><p className="text-2xl font-bold"><Money value={install} /></p></div>
        <Notice className="mt-3" tone="neutral">La garantie Visale et l'avance Loca-Pass (Action Logement) peuvent faciliter l'entrée dans un logement : voir « Mes aides ».</Notice>
      </CardContent></Card>
    </div>
  );
}

function Transport() {
  const [v, setV] = useState({ pass: "75", ticket: "1,90", trips: "40", km: "10", rate: "0,30", missionKm: "12", missionTickets: "2" });
  const tickets = p(v.ticket) * Math.max(0, Number(v.trips) || 0);
  const best = Math.min(tickets, p(v.pass));
  const missionCost = Math.max(0, Number(v.missionTickets) || 0) * p(v.ticket);
  const carCost = mulDiv(p(v.rate), Math.round((Number(v.missionKm.replace(",", ".")) || 0) * 2 * 100), 100);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Abonnement ou tickets ?</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Abonnement / mois" htmlFor="t-pass"><MoneyInput id="t-pass" value={v.pass} onChange={(e) => setV({ ...v, pass: e.target.value })} /></Field>
          <Field label="Prix d'un ticket" htmlFor="t-ticket"><MoneyInput id="t-ticket" value={v.ticket} onChange={(e) => setV({ ...v, ticket: e.target.value })} /></Field>
          <Field label="Trajets / mois" htmlFor="t-trips"><Input id="t-trips" type="number" min={0} value={v.trips} onChange={(e) => setV({ ...v, trips: e.target.value })} /></Field>
        </div>
        <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm" aria-live="polite">Tickets : <Money value={tickets} className="font-semibold" /> · Abonnement : <Money value={p(v.pass)} className="font-semibold" />. <strong>{tickets <= p(v.pass) ? "Les tickets sont plus avantageux." : "L'abonnement est plus avantageux."}</strong> Coût minimal : <Money value={best} />/mois. Pense aux tarifs jeunes de ton réseau et à une éventuelle prise en charge employeur.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Coût de déplacement d'une mission</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tickets aller-retour" htmlFor="t-mt"><Input id="t-mt" type="number" min={0} value={v.missionTickets} onChange={(e) => setV({ ...v, missionTickets: e.target.value })} /></Field>
          <Field label="Distance (km, aller)" htmlFor="t-mk"><Input id="t-mk" inputMode="decimal" value={v.missionKm} onChange={(e) => setV({ ...v, missionKm: e.target.value })} /></Field>
          <Field label="Coût voiture / km" htmlFor="t-rate" hint="Carburant + usure, à estimer toi-même."><MoneyInput id="t-rate" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></Field>
        </div>
        <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm">En transports : <Money value={missionCost} className="font-semibold" /> · En voiture (aller-retour) : <Money value={carCost} className="font-semibold" />. Reporte ce montant dans le calculateur de rentabilité de « Gagner de l'argent ».</p>
      </CardContent></Card>
    </div>
  );
}

function StudentLife() {
  const items = [["Frais d'inscription & CVEC", "250"], ["Ordinateur / matériel informatique", "0"], ["Fournitures & livres", "80"], ["Assurance habitation", "90"], ["Abonnement transport", "75"], ["Équipement logement", "150"]] as const;
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(items));
  const total = Object.values(vals).reduce((s, x) => s + p(x), 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Préparer la rentrée</CardTitle></CardHeader><CardContent>
        <p className="mb-3 text-sm text-muted">Montants indicatifs à remplacer par tes vrais devis.</p>
        <div className="grid gap-3 sm:grid-cols-2">{items.map(([k]) => <Field key={k} label={k} htmlFor={`r-${k}`}><MoneyInput id={`r-${k}`} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></Field>)}</div>
        <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm">Budget de rentrée : <Money value={total} className="text-lg font-bold" /> — soit <Money value={mulDiv(total, 1, 6)} className="font-semibold" /> à mettre de côté par mois pendant 6 mois.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Repères pratiques</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <p><strong>Achats informatiques :</strong> compare le reconditionné garanti, les offres éducation des constructeurs et les logiciels gratuits pour étudiants (voir « Économiser »).</p>
        <p><strong>Stages :</strong> au-delà d'une certaine durée, une gratification minimale est obligatoire — vérifie les règles en vigueur sur service-public.fr.</p>
        <p><strong>Alternance :</strong> rémunération, aides au logement (Mobili-Jeune) et au permis peuvent s'appliquer.</p>
        <p><strong>Mobilité internationale :</strong> anticipe le budget (logement, assurance, transport) et renseigne-toi sur les aides de ton établissement.</p>
        <p><strong>Administratif :</strong> garde une copie numérique de tes justificatifs (identité, bail, scolarité, avis fiscal) pour accélérer tes démarches.</p>
      </CardContent></Card>
    </div>
  );
}

function Culture() {
  const complete = useMutationOp("quiz.complete");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        {LESSONS.map((l) => (
          <details key={l.slug} className="group rounded-2xl border border-border bg-surface p-4">
            <summary className="flex cursor-pointer items-center justify-between font-semibold"><span>{l.title}</span><Badge>{l.minutes} min</Badge></summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">{l.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </details>
        ))}
      </div>
      <Card className="h-fit"><CardHeader><CardTitle>Quiz : teste tes réflexes</CardTitle></CardHeader><CardContent>
        <ol className="space-y-4">
          {QUIZ.map((q, i) => (
            <li key={q.q}>
              <fieldset><legend className="text-sm font-semibold">{i + 1}. {q.q}</legend>
                <div className="mt-2 grid gap-1.5">{q.options.map((o, j) => (
                  <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${submitted ? (j === q.answer ? "border-positive bg-positive-soft" : answers[i] === j ? "border-danger bg-danger-soft" : "border-border") : answers[i] === j ? "border-brand bg-brand-soft" : "border-border"}`}>
                    <input type="radio" name={`q${i}`} className="accent-[#7357F6]" disabled={submitted} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} />{o}
                  </label>
                ))}</div>
                {submitted ? <p className="mt-1 text-xs text-muted">{q.explanation}</p> : null}
              </fieldset>
            </li>
          ))}
        </ol>
        {submitted ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 p-4"><p className="font-semibold">Score : {score}/{QUIZ.length} {score * 100 >= QUIZ.length * 70 ? "🎉" : ""}</p><Button variant="outline" size="sm" onClick={() => { setAnswers({}); setSubmitted(false); }}>Recommencer</Button></div>
        ) : <Button className="mt-4 w-full" disabled={Object.keys(answers).length < QUIZ.length} onClick={() => { setSubmitted(true); complete.mutate({ quiz: "bases", score, total: QUIZ.length }); }}>Valider mes réponses</Button>}
      </CardContent></Card>
    </div>
  );
}

export default function LifePage() {
  return (
    <>
      <PageHeader title="Vie quotidienne" description="Des outils concrets pour mieux vivre avec ton budget : courses, logement, transport, rentrée et culture financière." />
      <Tabs defaultValue="food">
        <TabsList className="mb-4">
          <TabsTrigger value="food"><ShoppingCart className="mr-1 inline size-3.5" />Alimentation</TabsTrigger>
          <TabsTrigger value="home"><Home className="mr-1 inline size-3.5" />Logement</TabsTrigger>
          <TabsTrigger value="transport"><Bus className="mr-1 inline size-3.5" />Transport</TabsTrigger>
          <TabsTrigger value="student"><GraduationCap className="mr-1 inline size-3.5" />Vie étudiante</TabsTrigger>
          <TabsTrigger value="culture"><BookOpen className="mr-1 inline size-3.5" />Culture financière</TabsTrigger>
        </TabsList>
        <TabsContent value="food"><Groceries /></TabsContent>
        <TabsContent value="home"><Housing /></TabsContent>
        <TabsContent value="transport"><Transport /></TabsContent>
        <TabsContent value="student"><StudentLife /></TabsContent>
        <TabsContent value="culture"><Culture /></TabsContent>
      </Tabs>
    </>
  );
}
