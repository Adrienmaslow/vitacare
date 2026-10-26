/** Exécution d'une opération : validation Zod puis exécution, avec erreurs normalisées. */
import { ZodError } from "zod";
import { AppError } from "@/lib/data/store";
import type { OpContext } from "./define";
import { registry, type OpName, type OpOutput } from "./registry";

export type OpResult<T> = { ok: true; data: T } | { ok: false; error: { code: AppError["code"]; message: string; fields?: Record<string, string> } };

export function isOpName(name: string): name is OpName {
  return Object.prototype.hasOwnProperty.call(registry, name);
}

export function toErrorResult(e: unknown): OpResult<never> {
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) fields[issue.path.join(".") || "_"] = issue.message;
    return { ok: false, error: { code: "invalid", message: "Certaines informations sont invalides", fields } };
  }
  if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message } };
  return { ok: false, error: { code: "internal", message: "Une erreur inattendue est survenue. Réessaie dans un instant." } };
}

export async function executeOp<N extends OpName>(ctx: OpContext, name: N, rawInput: unknown): Promise<OpResult<OpOutput<N>>> {
  const op = registry[name];
  try {
    const input = op.input.parse(rawInput ?? {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (op.run as any)(ctx, input);
    return { ok: true, data };
  } catch (e) {
    if (!(e instanceof AppError) && !(e instanceof ZodError) && process.env.NODE_ENV !== "test") {
      // Journalisation minimale côté serveur, sans données personnelles.
      console.error(`[op:${name}]`, e instanceof Error ? e.message : "erreur inconnue");
    }
    return toErrorResult(e);
  }
}
