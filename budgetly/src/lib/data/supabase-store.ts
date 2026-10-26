/**
 * Implémentation PostgREST/Supabase de DataStore.
 * Le client reçu porte la session de l'utilisateur : RLS s'applique à chaque requête.
 * Le filtre explicite sur user_id est une défense en profondeur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Insert, Patch, Row, TableName, UUID } from "@/types/db";
import { AppError, type DataStore, type Filter } from "./store";

const PAGE = 1000; // limite par défaut de PostgREST

/* eslint-disable @typescript-eslint/no-explicit-any */
type Query = any;

function mapError(error: { code?: string; message: string }): AppError {
  if (error.code === "23505") return new AppError("conflict", "Cet élément existe déjà");
  if (error.code === "23503") return new AppError("invalid", "Référence invalide");
  if (error.code === "23514" || error.code === "22P02" || error.code === "22007") return new AppError("invalid", "Données invalides");
  if (error.code === "42501" || error.code === "PGRST301") return new AppError("forbidden", "Accès refusé");
  return new AppError("internal", "Erreur de base de données");
}

function normalize<T extends TableName>(table: T, row: any): Row<T> {
  if (table === "transaction_categories" && row.user_id === null) row.user_id = "";
  return row as Row<T>;
}

export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  constructor(private readonly client: SupabaseClient, readonly userId: UUID) {}

  private scoped<T extends TableName>(table: T, q: Query): Query {
    return table === "transaction_categories" ? q : q.eq("user_id", this.userId);
  }

  private applyFilter<T extends TableName>(q: Query, f?: Filter<T>): Query {
    if (!f) return q;
    for (const [k, v] of Object.entries(f.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
    if (f.in) q = q.in(f.in.column, f.in.values as any[]);
    if (f.gte) q = q.gte(f.gte.column, f.gte.value);
    if (f.lte) q = q.lte(f.lte.column, f.lte.value);
    q = q.order(f.order?.column ?? "id", { ascending: f.order?.ascending ?? true });
    return q;
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    const out: Row<T>[] = [];
    const max = filter?.limit ?? Infinity;
    for (let from = 0; out.length < max; from += PAGE) {
      const to = from + Math.min(PAGE, max - out.length) - 1;
      let q = this.client.from(table).select("*");
      q = this.applyFilter(this.scoped(table, q), filter).range(from, to);
      const { data, error } = await q;
      if (error) throw mapError(error);
      out.push(...(data as any[]).map((r) => normalize(table, r)));
      if ((data as any[]).length < to - from + 1) break;
    }
    return out;
  }

  async get<T extends TableName>(table: T, id: UUID): Promise<Row<T> | null> {
    const { data, error } = await this.scoped(table, this.client.from(table).select("*").eq("id", id)).maybeSingle();
    if (error) throw mapError(error);
    return data ? normalize(table, data) : null;
  }

  async insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const payload = rows.map((r) => ({ ...r, user_id: this.userId }));
    const { data, error } = await this.client.from(table).insert(payload as any).select("*");
    if (error) throw mapError(error);
    return (data as any[]).map((r) => normalize(table, r));
  }

  async upsert<T extends TableName>(table: T, rows: Insert<T>[], onConflict: (keyof Row<T> & string)[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const payload = rows.map((r) => ({ ...r, user_id: this.userId }));
    const conflict = ["user_id", ...onConflict.filter((c) => c !== "user_id")].join(",");
    const { data, error } = await this.client.from(table).upsert(payload as any, { onConflict: conflict }).select("*");
    if (error) throw mapError(error);
    return (data as any[]).map((r) => normalize(table, r));
  }

  async update<T extends TableName>(table: T, id: UUID, patch: Patch<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).update(patch as any).eq("id", id).eq("user_id", this.userId).select("*").maybeSingle();
    if (error) throw mapError(error);
    if (!data) throw new AppError("not_found", "Élément introuvable");
    return normalize(table, data);
  }

  async updateMany<T extends TableName>(table: T, ids: UUID[], patch: Patch<T>): Promise<number> {
    if (!ids.length) return 0;
    const { data, error } = await this.client.from(table).update(patch as any).in("id", ids).eq("user_id", this.userId).select("id");
    if (error) throw mapError(error);
    return (data as any[]).length;
  }

  async remove<T extends TableName>(table: T, ids: UUID[]): Promise<number> {
    if (!ids.length) return 0;
    const { data, error } = await this.client.from(table).delete().in("id", ids).eq("user_id", this.userId).select("id");
    if (error) throw mapError(error);
    return (data as any[]).length;
  }

  async removeWhere<T extends TableName>(table: T, eq: NonNullable<Filter<T>["eq"]>): Promise<number> {
    let q: Query = this.client.from(table).delete().eq("user_id", this.userId);
    for (const [k, v] of Object.entries(eq)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { data, error } = await q.select("id");
    if (error) throw mapError(error);
    return (data as any[]).length;
  }
}
