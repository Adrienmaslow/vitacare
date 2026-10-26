/** Initialise une base PostgreSQL de test : schéma réinitialisé, shim Supabase, migrations. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

export async function setupDatabase(): Promise<Pool> {
  const pool = new Pool({ connectionString: TEST_DB_URL, max: 4 });
  const root = join(__dirname, "../../supabase");
  await pool.query("drop schema if exists public cascade; drop schema if exists auth cascade; create schema public; grant all on schema public to public;");
  await pool.query(readFileSync(join(root, "test-shim.sql"), "utf8"));
  for (const f of readdirSync(join(root, "migrations")).sort()) await pool.query(readFileSync(join(root, "migrations", f), "utf8"));
  return pool;
}

export async function createUser(pool: Pool, email: string): Promise<string> {
  const { rows } = await pool.query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id as string;
}

/** Exécute une requête SQL en tant qu'utilisateur authentifié (comme PostgREST). */
export async function asUser<T = Record<string, unknown>>(pool: Pool, userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (userId) {
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
      await c.query("set local role authenticated");
    } else {
      await c.query("set local role anon");
    }
    const r = await c.query(sql, params);
    await c.query("commit");
    return r.rows as T[];
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
