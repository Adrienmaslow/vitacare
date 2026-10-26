"use client";
import { Bell, CheckCheck, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, ErrorState, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { useMutationOp, useOp } from "@/hooks/use-op";
import { fmt } from "@/lib/dates";

const PRIO = { critical: ["danger", "Critique"], high: ["danger", "Haute"], medium: ["warning", "Moyenne"], low: ["neutral", "Info"] } as const;

export default function NotificationsPage() {
  const [filter, setFilter] = useState("all");
  const q = useOp("notifications.list", { unreadOnly: filter === "unread" });
  const mark = useMutationOp("notifications.markRead");
  const del = useMutationOp("notifications.delete");
  return (
    <>
      <PageHeader title="Notifications" description="Alertes calculées à partir de tes données : budgets, solde, prélèvements, abonnements, objectifs. Dédoublonnées et plafonnées pour éviter le spam."
        actions={<><Button variant="outline" onClick={() => mark.mutate({ all: true })}><CheckCheck /> Tout marquer comme lu</Button><Button variant="ghost" asChild><Link href="/app/settings#notifications"><Settings /> Préférences</Link></Button></>} />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4"><TabsList><TabsTrigger value="all">Toutes</TabsTrigger><TabsTrigger value="unread">Non lues ({q.data?.unread ?? 0})</TabsTrigger></TabsList></Tabs>
      {q.isPending ? <Skeleton className="h-64" /> : q.isError ? <ErrorState message={q.error.message} /> : !q.data.notifications.length ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Tout est calme. Les alertes apparaîtront ici dès qu'un point mérite ton attention." />
      ) : (
        <div className="grid gap-2">
          {q.data.notifications.map((n) => (
            <Card key={n.id} className={`flex items-start gap-3 p-4 ${n.read_at ? "opacity-70" : "border-l-4 border-l-brand"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Badge tone={PRIO[n.priority][0]}>{PRIO[n.priority][1]}</Badge><p className="font-semibold">{n.title}</p></div>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{fmt.full(n.created_at.slice(0, 10))} · notification interne</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.action_href ? <Button size="sm" asChild onClick={() => !n.read_at && mark.mutate({ ids: [n.id] })}><Link href={n.action_href}>{n.action_label ?? "Voir"}</Link></Button> : null}
                  <Button size="sm" variant="ghost" onClick={() => mark.mutate({ ids: [n.id], read: !n.read_at })}>{n.read_at ? "Marquer non lue" : "Marquer lue"}</Button>
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => del.mutate({ ids: [n.id] })}><Trash2 /></Button>
            </Card>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">Les notifications push et e-mail ne sont pas activées sur cette instance : aucune notification externe n'est envoyée.</p>
    </>
  );
}
