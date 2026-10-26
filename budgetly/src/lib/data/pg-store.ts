/**
 * Implémentation PostgreSQL directe de DataStore (tests d'intégration, auto-hébergement).
 * Chaque requête s'exécute dans une transaction avec le rôle « authenticated » et les
 * claims JWT de l'utilisateur, exactement comme PostgREST : RLS est donc réellement testé.
 */
import type { Pool, PoolClient } from "pg";
import type { Insert, Patch, Row, TableName, UUID } from "@/types/db";
import { AppError, type DataStore, type Filter } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any */
const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  if (!IDENT.test(name)) throw new AppError("invalid", "Identifiant invalide");
  return `"${name}"`;
}

function mapError(e: any): never {
  if (e instanceof AppError) throw e;
  if (e?.code === "23505") throw new AppError("conflict", "Cet élément existe déjà");
  if (e?.code === "23503") throw new AppError("invalid", "Référence invalide");
  if (e?.code === "23514" || e?.code === "22P02" || e?.code === "22007") throw new AppError("invalid", "Données invalides");
  if (e?.code === "42501") throw new AppError("forbidden", "Accès refusé");
  throw e;
}

const DATE_COLUMNS = new Set(["date", "booking_date", "start_date", "end_date", "next_date", "next_payment_date", "month", "target_date", "reminder_date", "applied_at", "deadline", "started_on", "week_start", "valid_until"]);

function normalize(table: string, row: any): any {
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) row[k] = DATE_COLUMNS.has(k) ? v.toISOString().slice(0, 10) : v.toISOString();
    else if (typeof v === "string" && /_minor$/.test(k)) row[k] = Number(v);
  }
  if (table === "transaction_categories" && row.user_id === null) row.user_id = "";
  return row;
}

export class PgStore implements DataStore {
  readonly kind = "pg" as const;
  constructor(private readonly pool: Pool, readonly userId: UUID) {}

  private async run<R>(fn: (c: PoolClient) => Promise<R>): Promise<R> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: this.userId, role: "authenticated" })]);
      await c.query("set local role authenticated");
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback").catch(() => undefined);
      return mapError(e);
    } finally {
      c.release();
    }
  }

  private where<T extends TableName>(table: T, f: Filter<T> | undefined, params: unknown[], scope = true): string {
    const clauses: string[] = [];
    if (scope && table !== "transaction_categories") {
      params.push(this.userId);
      clauses.push(`user_id = $${params.length}`);
    }
    for (const [k, v] of Object.entries(f?.eq ?? {})) {
      if (v === null) clauses.push(`${ident(k)} is null`);
      else {
        params.push(v);
        clauses.push(`${ident(k)} = $${params.length}`);
      }
    }
    if (f?.in) {
      params.push(f.in.values);
      clauses.push(`${ident(f.in.column)} = any($${params.length})`);
    }
    if (f?.gte) {
      params.push(f.gte.value);
      clauses.push(`${ident(f.gte.column)} >= $${params.length}`);
    }
    if (f?.lte) {
      params.push(f.lte.value);
      clauses.push(`${ident(f.lte.column)} <= $${params.length}`);
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    const params: unknown[] = [];
    let sql = `select * from public.${ident(table)}${this.where(table, filter, params)}`;
    sql += ` order by ${ident(filter?.order?.column ?? "id")} ${filter?.order?.ascending === false ? "desc" : "asc"}`;
    if (filter?.limit !== undefined) sql += ` limit ${Math.max(0, Math.floor(filter.limit))}`;
    return this.run(async (c) => (await c.query(sql, params)).rows.map((r) => normalize(table, r)));
  }

  async get<T extends TableName>(table: T, id: UUID): Promise<Row<T> | null> {
    const rows = await this.list(table, { eq: { id } } as Filter<T>);
    return rows[0] ?? null;
  }

  private insertSql<T extends TableName>(table: T, rows: Insert<T>[], params: unknown[]): string {
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => (r as any)[k] !== undefined))));
    cols.push("user_id");
    const values = rows.map((r) => {
      const ph = cols.map((c) => {
        const v = c === "user_id" ? this.userId : (r as any)[c];
        if (v === undefined) return "default";
        params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    return `insert into public.${ident(table)} (${cols.map(ident).join(", ")}) values ${values.join(", ")}`;
  }

  async insert<T extends TableName>(table: T, rows: Insert<T>[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const params: unknown[] = [];
    const sql = `${this.insertSql(table, rows, params)} returning *`;
    return this.run(async (c) => (await c.query(sql, params)).rows.map((r) => normalize(table, r)));
  }

  async upsert<T extends TableName>(table: T, rows: Insert<T>[], onConflict: (keyof Row<T> & string)[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const params: unknown[] = [];
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((c) => !onConflict.includes(c as any) && c !== "id");
    const target = ["user_id", ...onConflict].map(ident).join(", ");
    const set = cols.length ? cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ") : `updated_at = now()`;
    const sql = `${this.insertSql(table, rows, params)} on conflict (${target}) do update set ${set} returning *`;
    return this.run(async (c) => (await c.query(sql, params)).rows.map((r) => normalize(table, r)));
  }

  private setSql(patch: Record<string, unknown>, params: unknown[]): string {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (!entries.length) throw new AppError("invalid", "Aucune modification");
    return entries
      .map(([k, v]) => {
        params.push(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v);
        return `${ident(k)} = $${params.length}`;
      })
      .join(", ");
  }

  async update<T extends TableName>(table: T, id: UUID, patch: Patch<T>): Promise<Row<T>> {
    const params: unknown[] = [];
    const set = this.setSql(patch as Record<string, unknown>, params);
    params.push(id, this.userId);
    const sql = `update public.${ident(table)} set ${set} where id = $${params.length - 1} and user_id = $${params.length} returning *`;
    const rows = await this.run(async (c) => (await c.query(sql, params)).rows);
    if (!rows[0]) throw new AppError("not_found", "Élément introuvable");
    return normalize(table, rows[0]);
  }

  async updateMany<T extends TableName>(table: T, ids: UUID[], patch: Patch<T>): Promise<number> {
    if (!ids.length) return 0;
    const params: unknown[] = [];
    const set = this.setSql(patch as Record<string, unknown>, params);
    params.push(ids, this.userId);
    const sql = `update public.${ident(table)} set ${set} where id = any($${params.length - 1}) and user_id = $${params.length}`;
    return this.run(async (c) => (await c.query(sql, params)).rowCount ?? 0);
  }

  async remove<T extends TableName>(table: T, ids: UUID[]): Promise<number> {
    if (!ids.length) return 0;
    const sql = `delete from public.${ident(table)} where id = any($1) and user_id = $2`;
    return this.run(async (c) => (await c.query(sql, [ids, this.userId])).rowCount ?? 0);
  }

  async removeWhere<T extends TableName>(table: T, eq: NonNullable<Filter<T>["eq"]>): Promise<number> {
    const params: unknown[] = [];
    const sql = `delete from public.${ident(table)}${this.where(table, { eq } as Filter<T>, params)}`;
    return this.run(async (c) => (await c.query(sql, params)).rowCount ?? 0);
  }
}
