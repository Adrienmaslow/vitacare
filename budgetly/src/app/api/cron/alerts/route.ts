/**
 * Tâche planifiée : recalcule les alertes de chaque utilisateur actif.
 * Déclenchée par Vercel Cron (vercel.json) avec l'en-tête Authorization: Bearer CRON_SECRET.
 * Sans CRON_SECRET ni clé service, la route refuse de s'exécuter : aucune surveillance
 * continue n'est revendiquée tant que la tâche n'est pas réellement configurée.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { SupabaseStore } from "@/lib/data/supabase-store";
import { executeOp } from "@/lib/ops/execute";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = getServiceSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: "service role non configurée" }, { status: 503 });
  const { data: profiles, error } = await admin.from("profiles").select("user_id").not("onboarding_completed_at", "is", null).limit(1000);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  const now = new Date();
  let created = 0, failed = 0;
  for (const p of profiles ?? []) {
    const r = await executeOp({ store: new SupabaseStore(admin, p.user_id), today: today("Europe/Paris", now), now, mode: "live", opportunityProviders: [], coachAI: null }, "alerts.refresh", {});
    if (r.ok) created += r.data.created;
    else failed++;
  }
  return NextResponse.json({ ok: true, users: profiles?.length ?? 0, created, failed });
}
