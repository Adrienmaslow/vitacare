"use client";
import { AlertTriangle, CheckCircle2, HandHeart, ListChecks, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Aperçu interactif du produit (données d'illustration, présentées comme telles). */
const TABS = [
  { key: "dash", label: "Tableau de bord", icon: TrendingUp },
  { key: "plan", label: "Plan d'action", icon: ListChecks },
  { key: "aids", label: "Aides", icon: HandHeart },
] as const;

export function ProductPreview() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("dash");
  const bars = [62, 58, 70, 54, 66, 48, 40, 35, 52, 46, 30, 22];
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-2 shadow-2xl shadow-brand/20 backdrop-blur">
      <div className="rounded-[22px] bg-surface p-4 text-foreground sm:p-5">
        <div role="tablist" aria-label="Aperçu du produit" className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn("flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:text-sm", tab === key ? "bg-surface shadow-sm" : "text-muted")}>
              <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {tab === "dash" ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-night p-3 text-white"><p className="text-white/60">Disponible</p><p className="mt-1 text-lg font-bold">23 €</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-muted">Reste à vivre</p><p className="mt-1 text-lg font-bold text-positive">23 €</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-muted">Fin de mois</p><p className="mt-1 text-lg font-bold text-danger">−80 €</p></div>
            </div>
            <div className="flex h-28 items-end gap-1.5 rounded-xl border border-border p-3" aria-hidden>
              {bars.map((h, i) => <div key={i} className={cn("flex-1 rounded-t-md", i >= 9 ? "bg-brand/30" : "bg-brand")} style={{ height: `${h}%` }} />)}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-danger-soft p-2.5 text-xs"><AlertTriangle className="size-4 text-danger" /> Risque de découvert le 28 — 3 solutions proposées</div>
          </div>
        ) : tab === "plan" ? (
          <ul className="grid gap-2 text-sm">
            {[["87", "Limiter tes dépenses à 4,60 €/jour jusqu'au 31", "Évite −80 € de découvert"], ["76", "Comparer tes 2 abonnements vidéo", "Jusqu'à 7,99 €/mois"], ["64", "Vérifier ton éligibilité à la prime d'activité", "Selon CAF — non garanti"]].map(([p, t, s]) => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-border p-3"><span className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{p}</span><span><span className="block font-semibold">{t}</span><span className="text-xs text-muted">{s}</span></span></li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-2 text-sm">
            {[["Aide au logement (APL)", "Potentiellement éligible"], ["Garantie Visale", "Potentiellement éligible"], ["Bourse sur critères sociaux", "Informations insuffisantes"]].map(([n, s]) => (
              <li key={n} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"><span className="font-semibold">{n}</span><span className={cn("flex items-center gap-1 text-xs font-semibold", s!.startsWith("Potent") ? "text-positive" : "text-warning")}><CheckCircle2 className="size-3.5" />{s}</span></li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-[11px] text-muted">Aperçu illustratif — essaie la démonstration pour manipuler de vraies données fictives.</p>
      </div>
    </div>
  );
}
