/**
 * Point d'entrée unique des opérations métier.
 * Pour chaque appel : 1. authentifier  2. autoriser (RLS + filtre user_id)
 * 3. valider (Zod)  4. exécuter  5. gérer les erreurs  6. réponse structurée.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { executeOp, isOpName } from "@/lib/ops/execute";
import { registry } from "@/lib/ops/registry";
import { liveContext } from "@/server/context";
import { LIMITS, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function fail(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isOpName(name)) return fail(404, "not_found", "Opération inconnue");

  // Protection CSRF : l'origine doit correspondre à l'hôte.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail(403, "forbidden", "Origine refusée");

  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase) return fail(503, "unavailable", "Authentification non configurée sur ce serveur");
  if (!user) return fail(401, "unauthenticated", "Session expirée : reconnecte-toi");

  const op = registry[name];
  const lim = op.sensitive ? LIMITS.sensitive : LIMITS.default;
  const rl = rateLimit(`${user.id}:${op.sensitive ? name : "all"}`, lim.limit, lim.windowMs);
  if (!rl.ok) return fail(429, "rate_limited", "Trop de requêtes, réessaie dans un instant", { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return fail(413, "invalid", "Requête trop volumineuse");
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, "invalid", "Requête trop volumineuse");
    body = text ? JSON.parse(text) : {};
  } catch {
    return fail(400, "invalid", "Corps JSON invalide");
  }

  const result = await executeOp(liveContext(supabase, user.id), name, body);
  const status = result.ok ? 200 : { invalid: 400, unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409, rate_limited: 429, unavailable: 503, internal: 500 }[result.error.code];
  return NextResponse.json(result, { status, headers: { "Cache-Control": "private, no-store" } });
}
