/**
 * Magasin en mémoire, persistable (mode démonstration et tests unitaires).
 * Reproduit les contraintes nécessaires à la cohérence métier : valeurs par défaut,
 * unicités utilisées par les upserts et par la génération idempotente d'échéances.
 */
import { SYSTEM_CATEGORIES } from "@/data/categories";
import type { CategoryRow, Insert, Patch, Row, TableName, Tables, UUID } from "@/types/db";
import { NULLABLE_COLUMNS, TABLE_DEFAULTS } from "./defaults";
import { AppError, applyFilter, type DataStore, type Filter } from "./store";

export type LocalData = { [K in TableName]: Row<K>[] };

export function emptyData(): LocalData {
  const data = {} as Record<TableName, unknown[]>;
  for (const t of Object.keys(TABLE_DEFAULTS) as TableName[]) data[t] = [];
  return data as LocalData;
}

/** Contraintes d'unicité reproduites localement (miroir des index SQL). */
const UNIQUE: Partial<Record<TableName, string[][]>> = {
  profiles: [["user_id"]],
  user_preferences: [["user_id"]],
  availability_preferences: [["user_id"]],
  earning_targets: [["user_id"]],
  user_consents: [["purpose"]],
  transactions: [["recurring_id", "date"], ["transfer_group_id", "type"]],
  budgets: [["month", "category_id"]],
  notifications: [["dedup_key"]],
  job_applications: [["provider", "external_id"]],
  user_aid_applications: [["aid_slug"]],
  saved_deals: [["deal_slug"]],
  action_items: [["week_start", "key"]],
  user_achievements: [["achievement_slug"]],
  categorization_rules: [["pattern", "match_type"]],
};

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function systemCategoryRows(): CategoryRow[] {
  const ts = "2026-01-01T00:00:00.000Z";
  return SYSTEM_CATEGORIES.map((c) => ({
    id: c.id, user_id: "", slug: c.slug, name: c.name, kind: c.kind, color: c.color, icon: c.icon,
    is_essential: c.isEssential, created_at: ts, updated_at: ts,
  }));
}

export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  private data: LocalData;

  constructor(
    readonly userId: UUID,
    initial?: LocalData,
    private readonly onChange?: (data: LocalData) => void,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.data = initial ?? emptyData();
    for (const t of Object.keys(TABLE_DEFAULTS) as TableName[]) this.data[t] ??= [] as never;
  }

  snapshot(): LocalData {
    return structuredClone(this.data);
  }

  private rows<T extends TableName>(table: T): Row<T>[] {
    return this.data[table] as Row<T>[];
  }

  private visible<T extends TableName>(table: T): Row<T>[] {
    const own = this.rows(table).filter((r) => r.user_id === this.userId);
    if (table === "transaction_categories") return [...(systemCategoryRows() as Row<T>[]), ...own];
    return own;
  }

  private commit() {
    this.onChange?.(this.data);
  }

  private build<T extends TableName>(table: T, input: Insert<T>): Row<T> {
    const now = this.clock().toISOString();
    const row: Record<string, unknown> = {};
    for (const c of NULLABLE_COLUMNS[table] ?? []) row[c] = null;
    Object.assign(row, structuredClone(TABLE_DEFAULTS[table] as object));
    if (table === "user_achievements") row.unlocked_at = now;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) row[k] = v;
    row.id ??= uuid();
    row.user_id = this.userId;
    row.created_at = now;
    row.updated_at = now;
    return row as unknown as Row<T>;
  }

  private conflictKey<T extends TableName>(row: Row<T>, cols: string[]): string | null {
    const rec = row as unknown as Record<string, unknown>;
    // Comme PostgreSQL : les NULL ne violent pas l'unicité, sauf budgets globaux (index partiel dédié).
    if (cols.some((c) => rec[c] === null || rec[c] === undefined) && !(cols.includes("category_id") && rec.month)) return null;
    return cols.map((c) => String(rec[c])).join("|");
  }

  private checkUnique<T extends TableName>(table: T, candidates: Row<T>[]) {
    const constraints = UNIQUE[table] ?? [];
    const own = this.rows(table).filter((r) => r.user_id === this.userId);
    for (const cols of constraints) {
      const seen = new Set<string>();
      for (const r of own) {
        const k = this.conflictKey(r, cols);
        if (k) seen.add(k);
      }
      for (const c of candidates) {
        const k = this.conflictKey(c, cols);
        if (!k) continue;
        if (seen.has(k)) throw new AppError("conflict", "Cet élément existe déjà", { table, columns: cols });
        seen.add(k);
      }
    }
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    return structuredClone(applyFilter(this.visible(table), filter));
  }

  async get<T extends TableName>(table: T, id: UUID): Promise<Row<T> | null> {
    const r = this.visible(table).find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  async insert<T extends TableName>(table: T, inputs: Insert<T>[]): Promise<Row<T>[]> {
    const built = inputs.map((i) => this.build(table, i));
    this.checkUnique(table, built);
    (this.data[table] as Row<T>[]).push(...built);
    this.commit();
    return structuredClone(built);
  }

  async upsert<T extends TableName>(table: T, inputs: Insert<T>[], onConflict: (keyof Row<T> & string)[]): Promise<Row<T>[]> {
    const out: Row<T>[] = [];
    for (const input of inputs) {
      const rec = input as unknown as Record<string, unknown>;
      const existing = this.rows(table).find(
        (r) => r.user_id === this.userId && onConflict.every((c) => (r as unknown as Record<string, unknown>)[c] === (rec[c] ?? null)),
      );
      if (existing) {
        const patch = { ...rec };
        delete patch.id;
        Object.assign(existing, patch, { updated_at: this.clock().toISOString() });
        out.push(structuredClone(existing));
      } else {
        const row = this.build(table, input);
        this.checkUnique(table, [row]);
        (this.data[table] as Row<T>[]).push(row);
        out.push(structuredClone(row));
      }
    }
    this.commit();
    return out;
  }

  async update<T extends TableName>(table: T, id: UUID, patch: Patch<T>): Promise<Row<T>> {
    const row = this.rows(table).find((r) => r.id === id && r.user_id === this.userId);
    if (!row) throw new AppError("not_found", "Élément introuvable");
    const next = { ...row, ...stripUndefined(patch), updated_at: this.clock().toISOString() } as Row<T>;
    const others = this.rows(table).filter((r) => r !== row);
    const saved = this.data[table];
    (this.data as Record<string, unknown>)[table] = others;
    try {
      this.checkUnique(table, [next]);
    } finally {
      (this.data as Record<string, unknown>)[table] = saved;
    }
    Object.assign(row, next);
    this.commit();
    return structuredClone(row);
  }

  async updateMany<T extends TableName>(table: T, ids: UUID[], patch: Patch<T>): Promise<number> {
    const set = new Set(ids);
    let n = 0;
    const ts = this.clock().toISOString();
    for (const r of this.rows(table)) {
      if (set.has(r.id) && r.user_id === this.userId) {
        Object.assign(r, stripUndefined(patch), { updated_at: ts });
        n++;
      }
    }
    this.commit();
    return n;
  }

  async remove<T extends TableName>(table: T, ids: UUID[]): Promise<number> {
    const set = new Set(ids);
    const before = this.rows(table).length;
    const removed = this.rows(table).filter((r) => set.has(r.id) && r.user_id === this.userId);
    (this.data as Record<string, unknown>)[table] = this.rows(table).filter((r) => !(set.has(r.id) && r.user_id === this.userId));
    this.cascade(table, removed);
    this.commit();
    return before - this.rows(table).length;
  }

  async removeWhere<T extends TableName>(table: T, eq: NonNullable<Filter<T>["eq"]>): Promise<number> {
    const targets = applyFilter(this.rows(table).filter((r) => r.user_id === this.userId), { eq } as Filter<T>);
    return this.remove(table, targets.map((r) => r.id));
  }

  /** Reproduit les ON DELETE CASCADE / SET NULL du schéma SQL. */
  private cascade<T extends TableName>(table: T, removed: Row<T>[]) {
    if (!removed.length) return;
    const ids = new Set(removed.map((r) => r.id));
    const del = <K extends TableName>(t: K, pred: (r: Row<K>) => boolean) => {
      const victims = this.rows(t).filter(pred);
      (this.data as Record<string, unknown>)[t] = this.rows(t).filter((r) => !pred(r));
      this.cascade(t, victims);
    };
    const setNull = <K extends TableName>(t: K, col: keyof Row<K>) => {
      for (const r of this.rows(t)) {
        const rec = r as unknown as Record<string, unknown>;
        if (ids.has(rec[col as string] as string)) rec[col as string] = null;
      }
    };
    switch (table as keyof Tables) {
      case "financial_accounts":
        del("transactions", (r) => ids.has(r.account_id));
        del("recurring_transactions", (r) => ids.has(r.account_id));
        del("csv_imports", (r) => ids.has(r.account_id));
        setNull("subscriptions", "account_id");
        break;
      case "csv_imports":
        del("transactions", (r) => r.import_id !== null && ids.has(r.import_id));
        break;
      case "recurring_transactions":
        setNull("transactions", "recurring_id");
        break;
      case "subscriptions":
        setNull("transactions", "subscription_id");
        break;
      case "transaction_categories":
        setNull("transactions", "category_id");
        setNull("recurring_transactions", "category_id");
        setNull("subscriptions", "category_id");
        del("budgets", (r) => r.category_id !== null && ids.has(r.category_id));
        del("categorization_rules", (r) => ids.has(r.category_id));
        break;
      case "savings_goals":
        del("savings_allocations", (r) => ids.has(r.goal_id));
        break;
    }
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
