import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Client Supabase portant la session de l'utilisateur (cookies) : RLS s'applique. */
export async function getServerSupabase() {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : le proxy se charge du rafraîchissement.
        }
      },
    },
  });
}

/** Client « service » : contourne RLS. Réservé à la suppression de compte et aux tâches planifiées. */
export function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAuthenticatedUser() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null, user: null };
  // getUser() valide le JWT auprès de Supabase Auth (contrairement à getSession()).
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
