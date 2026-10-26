/** Suppression définitive du compte : supprime l'utilisateur Auth, les données suivent par ON DELETE CASCADE. */
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser, getServiceSupabase } from "@/lib/supabase/server";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Origine refusée" } }, { status: 403 });
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Connecte-toi pour supprimer ton compte" } }, { status: 401 });
  if (!rateLimit(`delete:${user.id}`, 3, 3_600_000).ok) return NextResponse.json({ ok: false, error: { code: "rate_limited", message: "Trop de tentatives" } }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { confirmation?: string };
  if (body.confirmation !== "SUPPRIMER") return NextResponse.json({ ok: false, error: { code: "invalid", message: "Tape SUPPRIMER pour confirmer" } }, { status: 400 });
  const admin = getServiceSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: { code: "unavailable", message: "Suppression indisponible : SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur." } }, { status: 503 });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ ok: false, error: { code: "internal", message: "La suppression a échoué, réessaie plus tard" } }, { status: 500 });
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true, data: { deleted: true } });
}
