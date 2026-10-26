import { LocalStore, emptyData } from "@/lib/data/local-store";
import type { OpContext } from "@/lib/ops/define";
import { executeOp } from "@/lib/ops/execute";
import type { OpInput, OpName, OpOutput } from "@/lib/ops/registry";
import { DemoOpportunityProvider } from "@/features/earn/providers/demo";
import type { DataStore } from "@/lib/data/store";

export const TODAY = "2026-10-26";
export const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function makeCtx(store?: DataStore, today = TODAY): OpContext {
  return {
    store: store ?? new LocalStore(USER, emptyData(), undefined, () => new Date(`${today}T10:00:00Z`)),
    today,
    now: new Date(`${today}T10:00:00Z`),
    mode: "demo",
    opportunityProviders: [new DemoOpportunityProvider(today)],
    coachAI: null,
  };
}

/** Exécute une opération et lève une erreur lisible si elle échoue. */
export async function op<N extends OpName>(ctx: OpContext, name: N, input: OpInput<N> = {} as OpInput<N>): Promise<OpOutput<N>> {
  const r = await executeOp(ctx, name, input);
  if (!r.ok) throw new Error(`${name}: ${r.error.code} ${r.error.message} ${JSON.stringify(r.error.fields ?? {})}`);
  return r.data;
}
