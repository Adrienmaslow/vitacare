"use client";
import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { callOp, resetDemo, setDemoCookie } from "@/lib/ops/client";

/** Entrée en mode démonstration : données fictives générées dans le navigateur. */
export default function DemoPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      setDemoCookie(true);
      await resetDemo();
      await callOp("profile.get", {}); // génère les données de démonstration
      router.replace("/app");
    })();
  }, [router]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="animate-pulse rounded-2xl bg-brand-soft p-4 text-brand"><FlaskConical className="size-8" /></div>
      <h1 className="text-xl font-bold">Préparation de la démonstration…</h1>
      <p className="max-w-sm text-sm text-muted">Génération de 6 mois de données fictives pour Léa, étudiante de 21 ans. Elles restent uniquement dans ton navigateur.</p>
    </main>
  );
}
