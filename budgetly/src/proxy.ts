/**
 * Proxy (ex-middleware) : rafraîchit la session Supabase et protège /app côté serveur.
 * - Session valide → accès.
 * - Cookie de démonstration → accès : les données de démo vivent uniquement dans le
 *   navigateur du visiteur, aucune donnée serveur n'est exposée.
 * - Sinon → redirection vers /login.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const isApp = req.nextUrl.pathname.startsWith("/app");
  const isDemo = req.cookies.get(DEMO_COOKIE)?.value === "demo";
  if (!isSupabaseConfigured()) {
    if (isApp && !isDemo) return NextResponse.redirect(new URL("/login?config=missing", req.url));
    return res;
  }
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (isApp && !data.user && !isDemo) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup", "/auth/:path*", "/api/ops/:path*"],
};
