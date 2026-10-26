/**
 * Définition des opérations métier (« use cases »).
 *
 * Une opération = schéma Zod d'entrée + fonction run(ctx, input).
 * Elle s'exécute :
 *   - côté serveur via POST /api/ops/[name] (authentification Supabase, RLS, validation, limitation) ;
 *   - dans le navigateur en mode démonstration, sur le LocalStore isolé du visiteur.
 * La même logique est donc testée et utilisée dans les deux modes.
 */
import type { z } from "zod";
import type { DataStore } from "@/lib/data/store";
import type { ISODate } from "@/types/db";
import type { OpportunityProvider } from "@/features/earn/types";

export interface CoachAI {
  rephrase(input: { question: string; answer: import("@/features/coach/engine").CoachAnswer }): Promise<string | null>;
}

export interface OpContext {
  store: DataStore;
  today: ISODate;
  now: Date;
  mode: "live" | "demo";
  opportunityProviders: OpportunityProvider[];
  coachAI: CoachAI | null;
}

export interface OpDef<I extends z.ZodType, O> {
  name: string;
  input: I;
  /** Opération modifiant des données (invalidation du cache client). */
  mutation: boolean;
  /** Limitation de débit renforcée (import, IA, suppression…). */
  sensitive?: boolean;
  run: (ctx: OpContext, input: z.infer<I>) => Promise<O>;
}

export function defineOp<I extends z.ZodType, O>(def: OpDef<I, O>): OpDef<I, O> {
  return def;
}

export async function audit(ctx: OpContext, event: string, metadata: Record<string, string | number | boolean> = {}) {
  if (ctx.mode !== "live") return;
  try {
    await ctx.store.insert("audit_events", [{ event, metadata }]);
  } catch {
    // La journalisation ne doit jamais bloquer l'action de l'utilisateur.
  }
}
