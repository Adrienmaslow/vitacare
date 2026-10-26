import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { nonNegMinor, text, uuid } from "@/lib/validation";

export const lifeOps = {
  "shopping.list": defineOp({
    name: "shopping.list", mutation: false, input: z.object({}),
    run: async ({ store }) => store.list("shopping_list_items", { order: { column: "created_at" } }),
  }),
  "shopping.add": defineOp({
    name: "shopping.add", mutation: true,
    input: z.object({ name: text(80, 1), quantity: z.number().int().min(1).max(99).default(1), estimated_unit_minor: nonNegMinor.nullish() }),
    run: async ({ store }, input) => (await store.insert("shopping_list_items", [{ ...input, estimated_unit_minor: input.estimated_unit_minor ?? null }]))[0]!,
  }),
  "shopping.update": defineOp({
    name: "shopping.update", mutation: true,
    input: z.object({ id: uuid, checked: z.boolean().optional(), quantity: z.number().int().min(1).max(99).optional(), estimated_unit_minor: nonNegMinor.nullish() }),
    run: async ({ store }, { id, ...patch }) => store.update("shopping_list_items", id, patch),
  }),
  "shopping.remove": defineOp({
    name: "shopping.remove", mutation: true, input: z.object({ ids: z.array(uuid).min(1).max(200) }),
    run: async ({ store }, { ids }) => ({ deleted: await store.remove("shopping_list_items", ids) }),
  }),
};
