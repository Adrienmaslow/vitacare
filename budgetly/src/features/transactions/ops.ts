import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError, type DataStore } from "@/lib/data/store";
import { amountMinor, color, frequency, isoDate, optionalText, text, uuid } from "@/lib/validation";
import type { CategoryRow, Insert, TransactionRow } from "@/types/db";
import { createCategorizer, normalizeLabel } from "./categorize";
import { dueRecurringOccurrences } from "../finance/schedule";
import { nextOccurrence } from "@/lib/dates";

async function categorizerFor(store: DataStore) {
  const [rules, categories, history] = await Promise.all([
    store.list("categorization_rules"),
    store.list("transaction_categories"),
    store.list("transactions", { order: { column: "date", ascending: false }, limit: 2000 }),
  ]);
  return { categorize: createCategorizer({ rules, categories, history: history.filter((h) => h.source !== "demo" || h.category_id) }), categories };
}

async function assertCategory(store: DataStore, categoryId: string | null | undefined, type: TransactionRow["type"]): Promise<CategoryRow | null> {
  if (!categoryId) return null;
  const c = (await store.list("transaction_categories")).find((x) => x.id === categoryId);
  if (!c) throw new AppError("invalid", "Catégorie inconnue");
  if ((type === "income" && c.kind === "expense") || (type === "expense" && c.kind === "income")) {
    throw new AppError("invalid", "Cette catégorie ne correspond pas au type d'opération");
  }
  return c;
}

/** Associe une opération à un abonnement si son libellé correspond (évite le double comptage). */
async function matchSubscription(store: DataStore, label: string, amount: number): Promise<string | null> {
  const subs = await store.list("subscriptions", { eq: { status: "active" } });
  const n = normalizeLabel(label);
  const s = subs.find((x) => {
    const p = normalizeLabel(x.match_pattern || x.service);
    return p.length >= 3 && n.includes(p) && Math.abs(x.amount_minor - amount) <= Math.max(100, Math.round(x.amount_minor / 10));
  });
  return s?.id ?? null;
}

const txType = z.enum(["income", "expense"]);
const baseTx = {
  account_id: uuid,
  date: isoDate,
  booking_date: isoDate.nullish(),
  type: txType,
  amount_minor: amountMinor,
  label: text(200, 1),
  category_id: uuid.nullish(),
  subcategory: optionalText(60),
  description: optionalText(1000),
  status: z.enum(["booked", "pending"]).default("booked"),
};

const listInput = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(5).max(200).default(25),
  sort: z.enum(["date", "amount_minor", "label"]).default("date"),
  desc: z.boolean().default(true),
  q: z.string().trim().max(80).optional(),
  accountId: uuid.optional(),
  categoryId: z.union([uuid, z.literal("none")]).optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(["booked", "pending"]).optional(),
});

export function filterTransactions(rows: TransactionRow[], f: z.infer<typeof listInput>) {
  const q = f.q ? normalizeLabel(f.q) : "";
  const filtered = rows.filter((t) =>
    (!f.accountId || t.account_id === f.accountId) &&
    (!f.categoryId || (f.categoryId === "none" ? !t.category_id && !t.type.startsWith("transfer") : t.category_id === f.categoryId)) &&
    (!f.type || (f.type === "transfer" ? t.type.startsWith("transfer") : t.type === f.type)) &&
    (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) &&
    (!f.status || t.status === f.status) &&
    (!q || normalizeLabel(`${t.label} ${t.description ?? ""}`).includes(q)),
  );
  const dir = f.desc ? -1 : 1;
  filtered.sort((a, b) => {
    const x = a[f.sort], y = b[f.sort];
    const c = x < y ? -1 : x > y ? 1 : 0;
    return c !== 0 ? c * dir : (a.created_at < b.created_at ? -1 : 1) * dir;
  });
  return filtered;
}

export const transactionOps = {
  "transactions.list": defineOp({
    name: "transactions.list", mutation: false, input: listInput,
    run: async ({ store }, input) => {
      const [rows, categories, accounts] = await Promise.all([store.list("transactions"), store.list("transaction_categories"), store.list("financial_accounts")]);
      const filtered = filterTransactions(rows, input);
      const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount_minor, 0);
      const expenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount_minor, 0);
      return {
        total: filtered.length,
        sums: { income, expenses },
        rows: filtered.slice(input.page * input.pageSize, (input.page + 1) * input.pageSize),
        categories,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name, color: a.color, is_archived: a.is_archived, type: a.type })),
      };
    },
  }),

  "transactions.export": defineOp({
    name: "transactions.export", mutation: false, input: listInput.omit({ page: true, pageSize: true }),
    run: async ({ store }, input) => {
      const [rows, categories, accounts] = await Promise.all([store.list("transactions"), store.list("transaction_categories"), store.list("financial_accounts")]);
      const cat = new Map(categories.map((c) => [c.id, c.name]));
      const acc = new Map(accounts.map((a) => [a.id, a.name]));
      return filterTransactions(rows, { ...input, page: 0, pageSize: 25 }).map((t) => ({
        date: t.date, compte: acc.get(t.account_id) ?? "", type: t.type, libelle: t.label,
        montant: (t.type === "income" || t.type === "transfer_in" ? 1 : -1) * t.amount_minor,
        categorie: t.category_id ? cat.get(t.category_id) ?? "" : "", statut: t.status, description: t.description ?? "",
      }));
    },
  }),

  "transactions.suggestCategory": defineOp({
    name: "transactions.suggestCategory", mutation: false, input: z.object({ label: text(200, 1), type: txType }),
    run: async ({ store }, { label, type }) => (await categorizerFor(store)).categorize(label, type),
  }),

  "transactions.create": defineOp({
    name: "transactions.create", mutation: true, input: z.object(baseTx),
    run: async ({ store }, input) => {
      const account = await store.get("financial_accounts", input.account_id);
      if (!account) throw new AppError("not_found", "Compte introuvable");
      let categoryId = input.category_id ?? null;
      if (!categoryId) categoryId = (await categorizerFor(store)).categorize(input.label, input.type).categoryId;
      await assertCategory(store, categoryId, input.type);
      const subscription_id = input.type === "expense" ? await matchSubscription(store, input.label, input.amount_minor) : null;
      const [row] = await store.insert("transactions", [{ ...input, category_id: categoryId, source: "manual", subscription_id }]);
      return row!;
    },
  }),

  "transactions.update": defineOp({
    name: "transactions.update", mutation: true,
    input: z.object({ ...baseTx, status: z.enum(["booked", "pending"]) }).partial().extend({ id: uuid }),
    run: async ({ store }, { id, ...patch }) => {
      const tx = await store.get("transactions", id);
      if (!tx) throw new AppError("not_found", "Opération introuvable");
      if (tx.transfer_group_id) {
        // Un transfert se modifie sur ses deux jambes : montant, date, libellé uniquement.
        if (patch.type || patch.account_id || patch.category_id) throw new AppError("invalid", "Pour un transfert, seuls le montant, la date et le libellé sont modifiables");
        const legs = await store.list("transactions", { eq: { transfer_group_id: tx.transfer_group_id } });
        const p = { amount_minor: patch.amount_minor, date: patch.date, label: patch.label, description: patch.description };
        for (const leg of legs) await store.update("transactions", leg.id, p);
        return (await store.get("transactions", id))!;
      }
      await assertCategory(store, patch.category_id === undefined ? tx.category_id : patch.category_id, patch.type ?? tx.type);
      if (patch.account_id && !(await store.get("financial_accounts", patch.account_id))) throw new AppError("not_found", "Compte introuvable");
      return store.update("transactions", id, patch);
    },
  }),

  "transactions.bulk": defineOp({
    name: "transactions.bulk", mutation: true,
    input: z.discriminatedUnion("action", [
      z.object({ action: z.literal("delete"), ids: z.array(uuid).min(1).max(500) }),
      z.object({ action: z.literal("categorize"), ids: z.array(uuid).min(1).max(500), category_id: uuid, rememberRule: z.boolean().default(false) }),
      z.object({ action: z.literal("status"), ids: z.array(uuid).min(1).max(500), status: z.enum(["booked", "pending"]) }),
    ]),
    run: async ({ store }, input) => {
      const all = await store.list("transactions", { in: { column: "id", values: input.ids } });
      if (input.action === "delete") {
        const groups = new Set(all.map((t) => t.transfer_group_id).filter(Boolean) as string[]);
        const legs = groups.size ? await store.list("transactions", { in: { column: "transfer_group_id", values: [...groups] } }) : [];
        const ids = [...new Set([...all.map((t) => t.id), ...legs.map((t) => t.id)])];
        return { affected: await store.remove("transactions", ids) };
      }
      if (input.action === "status") return { affected: await store.updateMany("transactions", all.map((t) => t.id), { status: input.status }) };
      const cat = (await store.list("transaction_categories")).find((c) => c.id === input.category_id);
      if (!cat) throw new AppError("invalid", "Catégorie inconnue");
      const eligible = all.filter((t) => !t.transfer_group_id && (cat.kind === "both" || cat.kind === t.type));
      const affected = await store.updateMany("transactions", eligible.map((t) => t.id), { category_id: cat.id });
      if (input.rememberRule) {
        const labels = [...new Set(eligible.map((t) => normalizeLabel(t.label)).filter((l) => l.length >= 2))].slice(0, 20);
        const existing = await store.list("categorization_rules");
        const fresh = labels.filter((l) => !existing.some((r) => r.pattern === l && r.match_type === "contains"));
        if (fresh.length) await store.insert("categorization_rules", fresh.map((pattern) => ({ pattern: pattern.slice(0, 80), match_type: "contains" as const, category_id: cat.id, priority: 50 })));
      }
      return { affected, skipped: all.length - eligible.length };
    },
  }),

  "categories.list": defineOp({
    name: "categories.list", mutation: false, input: z.object({}),
    run: async ({ store }) => ({ categories: await store.list("transaction_categories", { order: { column: "name" } }), rules: await store.list("categorization_rules", { order: { column: "priority" } }) }),
  }),

  "categories.create": defineOp({
    name: "categories.create", mutation: true,
    input: z.object({ name: text(40, 1), kind: z.enum(["expense", "income", "both"]), color: color.default("#64748B"), icon: text(30, 1).default("tag"), is_essential: z.boolean().default(false) }),
    run: async ({ store }, input) => {
      const base = input.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "categorie";
      const existing = new Set((await store.list("transaction_categories")).map((c) => c.slug));
      let slug = `${base}`.padEnd(2, "x");
      for (let i = 2; existing.has(slug); i++) slug = `${base}-${i}`;
      return (await store.insert("transaction_categories", [{ ...input, slug }]))[0]!;
    },
  }),

  "categories.delete": defineOp({
    name: "categories.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => {
      const c = await store.get("transaction_categories", id);
      if (!c || !c.user_id) throw new AppError("forbidden", "Les catégories système ne peuvent pas être supprimées");
      return { deleted: await store.remove("transaction_categories", [id]) };
    },
  }),

  "rules.create": defineOp({
    name: "rules.create", mutation: true,
    input: z.object({ pattern: text(80, 2), match_type: z.enum(["contains", "starts_with", "exact"]).default("contains"), category_id: uuid, priority: z.number().int().min(0).max(1000).default(100) }),
    run: async ({ store }, input) => {
      await assertCategory(store, input.category_id, "expense").catch(() => assertCategory(store, input.category_id, "income"));
      return (await store.insert("categorization_rules", [input]))[0]!;
    },
  }),

  "rules.delete": defineOp({
    name: "rules.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("categorization_rules", [id]) }),
  }),

  "recurring.list": defineOp({
    name: "recurring.list", mutation: false, input: z.object({}),
    run: async ({ store }) => store.list("recurring_transactions", { order: { column: "next_date" } }),
  }),

  "recurring.create": defineOp({
    name: "recurring.create", mutation: true,
    input: z.object({ account_id: uuid, label: text(120, 1), type: txType, amount_minor: amountMinor, category_id: uuid.nullish(), frequency, start_date: isoDate, end_date: isoDate.nullish(), auto_post: z.boolean().default(true) }),
    run: async ({ store }, input) => {
      if (!(await store.get("financial_accounts", input.account_id))) throw new AppError("not_found", "Compte introuvable");
      if (input.end_date && input.end_date < input.start_date) throw new AppError("invalid", "La date de fin précède la date de début");
      await assertCategory(store, input.category_id, input.type);
      return (await store.insert("recurring_transactions", [{ ...input, category_id: input.category_id ?? null, end_date: input.end_date ?? null, next_date: input.start_date }]))[0]!;
    },
  }),

  "recurring.update": defineOp({
    name: "recurring.update", mutation: true,
    input: z.object({ id: uuid, label: text(120, 1).optional(), amount_minor: amountMinor.optional(), category_id: uuid.nullish(), end_date: isoDate.nullish(), is_active: z.boolean().optional(), auto_post: z.boolean().optional() }),
    run: async ({ store }, { id, ...patch }) => store.update("recurring_transactions", id, patch),
  }),

  "recurring.delete": defineOp({
    name: "recurring.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("recurring_transactions", [id]) }),
  }),

  /**
   * Matérialise les échéances passées non encore enregistrées (idempotent : l'index unique
   * (recurring_id, date) empêche tout doublon, même en cas d'appels concurrents).
   */
  "recurring.sync": defineOp({
    name: "recurring.sync", mutation: true, input: z.object({}),
    run: async ({ store, today }) => {
      const [recurring, txs] = await Promise.all([store.list("recurring_transactions", { eq: { is_active: true } }), store.list("transactions", { gte: { column: "date", value: "1900-01-01" } })]);
      let created = 0;
      for (const r of recurring) {
        const dates = dueRecurringOccurrences(r, txs, today);
        if (dates.length) {
          const rows: Insert<"transactions">[] = dates.map((date) => ({
            account_id: r.account_id, date, type: r.type, amount_minor: r.amount_minor, label: r.label, category_id: r.category_id, source: "recurring", recurring_id: r.id,
          }));
          try {
            created += (await store.insert("transactions", rows)).length;
          } catch (e) {
            if (!(e instanceof AppError && e.code === "conflict")) throw e;
          }
        }
        let next = r.next_date;
        const anchor = Number(r.start_date.slice(8, 10));
        while (next <= today) next = nextOccurrence(next, r.frequency, anchor);
        if (next !== r.next_date) await store.update("recurring_transactions", r.id, { next_date: next });
      }
      return { created };
    },
  }),
};
