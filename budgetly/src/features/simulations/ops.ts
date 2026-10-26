import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { addMonths } from "@/lib/dates";
import { amountMinor, isoDate, nonNegMinor, signedMinor, text, uuid } from "@/lib/validation";
import { loadSnapshot } from "../finance/snapshot";
import { simulate } from "./engine";

export const simulationParams = z.object({
  incomeDeltaMinor: signedMinor.default(0), rentDeltaMinor: signedMinor.default(0), expensesDeltaMinor: signedMinor.default(0),
  subscriptionsDeltaMinor: signedMinor.default(0), monthlySavingMinor: nonNegMinor.default(0), extraHoursPerMonth: z.number().min(0).max(160).default(0),
  hourlyRateMinor: nonNegMinor.default(0), exceptionalChargeMinor: nonNegMinor.default(0), exceptionalChargeDate: isoDate.nullable().default(null),
  horizonMonths: z.number().int().min(1).max(12).default(3),
});

export const simulationOps = {
  "simulations.run": defineOp({
    name: "simulations.run", mutation: false, input: simulationParams,
    run: async ({ store, today }, params) => simulate(await loadSnapshot(store, today), params),
  }),
  "simulations.list": defineOp({
    name: "simulations.list", mutation: false, input: z.object({}),
    run: async ({ store }) => store.list("financial_simulations", { order: { column: "created_at", ascending: false } }),
  }),
  "simulations.save": defineOp({
    name: "simulations.save", mutation: true, input: z.object({ name: text(80, 1), params: simulationParams }),
    run: async ({ store }, { name, params }) => (await store.insert("financial_simulations", [{ name, params }]))[0]!,
  }),
  "simulations.delete": defineOp({
    name: "simulations.delete", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("financial_simulations", [id]) }),
  }),
  /**
   * Application EXPLICITE d'un changement simulé : crée une échéance récurrente réelle.
   * Le client doit demander une confirmation avant l'appel.
   */
  "simulations.apply": defineOp({
    name: "simulations.apply", mutation: true,
    input: z.object({ account_id: uuid, label: text(120, 1), type: z.enum(["income", "expense"]), amount_minor: amountMinor, start_date: isoDate, confirm: z.literal(true) }),
    run: async ({ store, today }, input) => {
      if (!(await store.get("financial_accounts", input.account_id))) throw new AppError("not_found", "Compte introuvable");
      if (input.start_date < today || input.start_date > addMonths(today, 12)) throw new AppError("invalid", "La date de début doit être dans les 12 prochains mois");
      const [row] = await store.insert("recurring_transactions", [{
        account_id: input.account_id, label: input.label, type: input.type, amount_minor: input.amount_minor, frequency: "monthly",
        start_date: input.start_date, next_date: input.start_date, category_id: null, end_date: null, auto_post: false,
      }]);
      return row!;
    },
  }),
};
