import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { AppError } from "@/lib/data/store";
import { isoDate, nonNegMinor, optionalText, uuid } from "@/lib/validation";
import { AID_BY_SLUG, AIDS } from "@/data/aids";
import { effectiveStatus } from "@/data/sources";
import { evaluateAid, factsFromProfile } from "./eligibility";

const aidStatus = z.enum(["to_discover", "to_check", "preparing", "sent", "pending", "granted", "refused"]);

export const aidOps = {
  "aids.list": defineOp({
    name: "aids.list", mutation: false, input: z.object({}),
    run: async ({ store, today }) => {
      const [profiles, apps] = await Promise.all([store.list("profiles", { limit: 1 }), store.list("user_aid_applications")]);
      const facts = factsFromProfile(profiles[0] ?? null);
      const bySlug = new Map(apps.map((a) => [a.aid_slug, a]));
      return {
        aids: AIDS.map((aid) => ({
          ...aid,
          rules: undefined,
          sourceStatus: effectiveStatus(aid.source, today),
          eligibility: evaluateAid(aid, facts),
          application: bySlug.get(aid.slug) ?? null,
        })),
        profileComplete: !!profiles[0]?.status && !!profiles[0]?.housing && !!profiles[0]?.age_range,
        // Montants effectivement reçus : déclarés par l'utilisateur, jamais estimés.
        receivedTotal: apps.reduce((s, a) => s + (a.status === "granted" ? a.amount_received_minor ?? 0 : 0), 0),
      };
    },
  }),

  "aids.track": defineOp({
    name: "aids.track", mutation: true,
    input: z.object({ aid_slug: z.string().regex(/^[a-z0-9_-]{2,60}$/), status: aidStatus.default("to_check"), notes: optionalText(2000).optional(), deadline: isoDate.nullish(), amount_received_minor: nonNegMinor.nullish() }),
    run: async ({ store }, input) => {
      if (!AID_BY_SLUG.has(input.aid_slug)) throw new AppError("not_found", "Aide inconnue");
      return (await store.upsert("user_aid_applications", [input], ["aid_slug"]))[0]!;
    },
  }),

  "aids.untrack": defineOp({
    name: "aids.untrack", mutation: true, input: z.object({ id: uuid }),
    run: async ({ store }, { id }) => ({ deleted: await store.remove("user_aid_applications", [id]) }),
  }),
};
