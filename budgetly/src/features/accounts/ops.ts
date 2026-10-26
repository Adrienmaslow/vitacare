import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { amountMinor, color, isoDate, optionalText, signedMinor, text, uuid } from "@/lib/validation";
import { accountBalances, totals } from "../finance/balances";

const accountType = z.enum(["checking", "savings", "cash", "secondary", "business", "wallet", "other"]);

export const accountOps = {
  "accounts.list": defineOp({
    name: "accounts.list", mutation: false, input: z.object({ includeArchived: z.boolean().default(true) }),
    run: async ({ store, today }, { includeArchived }) => {
      const [accounts, txs] = await Promise.all([store.list("financial_accounts", { order: { column: "created_at" } }), store.list("transactions")]);
      const balances = accountBalances(accounts, txs, today).filter((b) => includeArchived || !b.account.is_archived);
      const counts = new Map<string, number>();
      for (const t of txs) counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
      return {
        accounts: balances.map((b) => ({ ...b.account, booked: b.booked, pending: b.pending, available: b.available, scheduled: b.scheduled, transactionCount: counts.get(b.account.id) ?? 0 })),
        totals: totals(balances),
      };
    },
  }),

  "accounts.create": defineOp({
    name: "accounts.create", mutation: true,
    input: z.object({ name: text(60, 1), type: accountType, initial_balance_minor: signedMinor.default(0), color: color.default("#7357F6"), icon: text(30, 1).default("wallet") }),
    run: async ({ store }, input) => (await store.insert("financial_accounts", [{ ...input, currency: "EUR" }]))[0]!,
  }),

  "accounts.update": defineOp({
    name: "accounts.update", mutation: true,
    input: z.object({ id: uuid, name: text(60, 1).optional(), type: accountType.optional(), initial_balance_minor: signedMinor.optional(), color: color.optional(), icon: text(30, 1).optional(), is_archived: z.boolean().optional() }),
    run: async ({ store }, { id, ...patch }) => store.update("financial_accounts", id, patch),
  }),

  "accounts.delete": defineOp({
    name: "accounts.delete", mutation: true, input: z.object({ id: uuid, confirm: z.literal(true) }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("financial_accounts", [id]) }),
  }),

  /** Transfert interne : deux lignes liées, insérées en une seule instruction (atomique). */
  "transfers.create": defineOp({
    name: "transfers.create", mutation: true,
    input: z.object({ from_account_id: uuid, to_account_id: uuid, amount_minor: amountMinor, date: isoDate, label: optionalText(120) }),
    run: async ({ store }, i) => {
      if (i.from_account_id === i.to_account_id) throw new AppError("invalid", "Choisis deux comptes différents");
      const [from, to] = await Promise.all([store.get("financial_accounts", i.from_account_id), store.get("financial_accounts", i.to_account_id)]);
      if (!from || !to) throw new AppError("not_found", "Compte introuvable");
      const group = globalThis.crypto.randomUUID();
      const label = i.label ?? `Transfert ${from.name} → ${to.name}`;
      const autres = "00000000-0000-4000-8000-00000000000e";
      const rows = await store.insert("transactions", [
        { account_id: from.id, date: i.date, type: "transfer_out", amount_minor: i.amount_minor, label, transfer_group_id: group, category_id: autres },
        { account_id: to.id, date: i.date, type: "transfer_in", amount_minor: i.amount_minor, label, transfer_group_id: group, category_id: autres },
      ]);
      return { transfer_group_id: group, rows };
    },
  }),
};
