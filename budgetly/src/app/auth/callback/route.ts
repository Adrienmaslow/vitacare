/** Retour des liens e-mail (vérification, réinitialisation) et d'OAuth : échange du code contre une session. */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { DEMO_COOKIE } from "@/lib/supabase/config";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  // Seules les redirections internes sont autorisées (pas d'open redirect).
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";
  const supabase = await getServerSupabase();
  if (!code || !supabase) return NextResponse.redirect(new URL("/login?error=lien", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=lien", url.origin));
  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
