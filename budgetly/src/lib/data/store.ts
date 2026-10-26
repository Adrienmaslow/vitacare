/**
 * Abstraction d'accès aux données.
 *
 * Toute la logique métier (src/features/** /ops.ts) dépend uniquement de cette
 * interface. Implémentations :
 *   - SupabaseStore : production, requêtes PostgREST avec le JWT de l'utilisateur (RLS) ;
 *   - LocalStore    : mode démonstration, données isolées dans le navigateur du visiteur ;
 *   - PgStore       : tests d'intégration sur un vrai PostgreSQL avec RLS.
 *
 * Chaque implémentation filtre systématiquement sur user_id (défense en profondeur,
 * en plus de RLS) et renseigne user_id elle-même à l'insertion.
 */
import type { Insert, Patch, Row, TableName, UUID } from "@/types/db";

export interface Filter<T extends TableName> {
  eq?: Partial<Record<keyof Row<T> & string, string | number | boolean | null>>;
  in?: { column: keyof Row<T> & string; values: readonly (string | number)[] };
  gte?: { column: keyof Row<T> & string; value: string | number };
  lte?: { column: keyof Row<T> & string; value: string | number };
  order?: { column: keyof Row<T> & string; ascending?: boolean };
  limit?: number;
}

export interface DataStore {
  readonly userId: UUID;
  readonly kind: "supabase" | "local" | "pg";
  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: UUID): Promise<Row<T> | null>;
  /** Insertion atomique de toutes les lignes (une seule instruction). */
  insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]>;
  /** Insertion ou mise à jour selon les colonnes uniques indiquées (user_id implicite). */
  upsert<T extends TableName>(table: T, rows: Insert<T>[], onConflict: (keyof Row<T> & string)[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: UUID, patch: Patch<T>): Promise<Row<T>>;
  updateMany<T extends TableName>(table: T, ids: UUID[], patch: Patch<T>): Promise<number>;
  remove<T extends TableName>(table: T, ids: UUID[]): Promise<number>;
  removeWhere<T extends TableName>(table: T, eq: NonNullable<Filter<T>["eq"]>): Promise<number>;
}

/** Erreur métier sûre à afficher à l'utilisateur (pas de fuite d'informations internes). */
export class AppError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid" | "conflict" | "forbidden" | "unauthenticated" | "rate_limited" | "unavailable" | "internal",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(what = "Élément"): AppError {
  return new AppError("not_found", `${what} introuvable`);
}

/** Ordonne et applique un filtre en mémoire (LocalStore et utilitaires). */
export function applyFilter<T extends TableName>(rows: Row<T>[], filter?: Filter<T>): Row<T>[] {
  if (!filter) return rows;
  let out = rows;
  const rec = (r: Row<T>) => r as unknown as Record<string, unknown>;
  if (filter.eq) {
    const entries = Object.entries(filter.eq);
    out = out.filter((r) => entries.every(([k, v]) => (rec(r)[k] ?? null) === v));
  }
  if (filter.in) {
    const { column, values } = filter.in;
    const set = new Set<unknown>(values);
    out = out.filter((r) => set.has(rec(r)[column]));
  }
  if (filter.gte) {
    const { column, value } = filter.gte;
    out = out.filter((r) => (rec(r)[column] as string | number) >= value);
  }
  if (filter.lte) {
    const { column, value } = filter.lte;
    out = out.filter((r) => (rec(r)[column] as string | number) <= value);
  }
  if (filter.order) {
    const { column, ascending = true } = filter.order;
    out = [...out].sort((a, b) => {
      const x = rec(a)[column] as string | number;
      const y = rec(b)[column] as string | number;
      return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
    });
  }
  if (filter.limit !== undefined) out = out.slice(0, filter.limit);
  return out;
}
