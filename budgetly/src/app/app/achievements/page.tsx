"use client";
import { Award, Flame, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState, Notice, ProgressBar, Skeleton } from "@/components/ui/misc";
import { useOp } from "@/hooks/use-op";
import { ACHIEVEMENTS } from "@/data/achievements";
import { fmt } from "@/lib/dates";

export default function AchievementsPage() {
  const q = useOp("achievements.get", {});
  useEffect(() => { for (const s of q.data?.newlyUnlocked ?? []) toast.success(`Succès débloqué : ${ACHIEVEMENTS.find((a) => a.slug === s)?.title}`); }, [q.data?.newlyUnlocked]);
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const d = q.data;
  const unlocked = d.achievements.filter((a) => a.unlockedAt).length;
  return (
    <>
      <PageHeader title="Succès" description="Des défis pour installer de bonnes habitudes, sans jamais te pousser à dépenser ni te pénaliser dans les périodes difficiles." />
      {!d.enabled ? <Notice className="mb-4">La gamification est désactivée. Tu peux la réactiver dans les <Link href="/app/settings" className="font-semibold text-brand">paramètres</Link>.</Notice> : null}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="p-5"><p className="text-sm text-muted">Progression</p><p className="mt-1 text-2xl font-bold">{unlocked} / {d.achievements.length}</p><ProgressBar className="mt-2" value={(unlocked / d.achievements.length) * 100} label="Succès débloqués" /></Card>
        <Card className="flex items-center gap-4 p-5"><Flame className="size-10 text-warning" /><div><p className="text-sm text-muted">Série de suivi</p><p className="text-2xl font-bold">{d.streak} jour(s)</p><p className="text-xs text-muted">Jours consécutifs avec une saisie. Une pause n'efface aucun succès.</p></div></Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {d.achievements.map((a) => (
          <Card key={a.slug} className={`flex items-center gap-4 p-4 ${a.unlockedAt ? "" : "opacity-60"}`}>
            <div className={`rounded-2xl p-3 ${a.unlockedAt ? "bg-brand text-white dark:text-night" : "bg-surface-2 text-muted"}`}>{a.unlockedAt ? <Award className="size-6" /> : <Lock className="size-6" />}</div>
            <div><p className="font-semibold">{a.title}</p><p className="text-sm text-muted">{a.description}</p>{a.unlockedAt ? <p className="text-xs text-positive">Débloqué le {fmt.full(a.unlockedAt.slice(0, 10))}</p> : null}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
