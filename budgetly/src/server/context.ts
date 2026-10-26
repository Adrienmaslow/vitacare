import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStore } from "@/lib/data/supabase-store";
import { today } from "@/lib/dates";
import type { OpContext } from "@/lib/ops/define";
import { FranceTravailProvider } from "@/features/earn/providers/france-travail";
import { createCoachAI } from "./coach-ai";

/** Construit le contexte d'exécution d'une opération pour un utilisateur authentifié. */
export function liveContext(client: SupabaseClient, userId: string): OpContext {
  const now = new Date();
  return {
    store: new SupabaseStore(client, userId),
    today: today("Europe/Paris", now),
    now,
    mode: "live",
    // Aucun fournisseur fictif en production : seuls les connecteurs configurés sont actifs.
    opportunityProviders: [new FranceTravailProvider()],
    coachAI: createCoachAI(),
  };
}
