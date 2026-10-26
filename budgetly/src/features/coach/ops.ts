import { z } from "zod";
import { audit, defineOp } from "@/lib/ops/define";
import { loadSnapshot } from "../finance/snapshot";
import { answer } from "./engine";

export const coachOps = {
  "coach.ask": defineOp({
    name: "coach.ask", mutation: false, sensitive: true,
    input: z.object({ question: z.string().trim().min(2).max(500), useAI: z.boolean().default(false) }),
    run: async (ctx, { question, useAI }) => {
      const s = await loadSnapshot(ctx.store, ctx.today);
      const det = answer(question, s);
      let aiText: string | null = null;
      let aiStatus: "not_requested" | "no_consent" | "unavailable" | "used" = "not_requested";
      if (useAI) {
        const consents = await ctx.store.list("user_consents", { eq: { purpose: "ai_coach" } });
        if (!consents[0]?.granted) aiStatus = "no_consent";
        else if (!ctx.coachAI) aiStatus = "unavailable";
        else {
          // Seule la réponse déterministe (déjà calculée) est transmise : jamais l'historique brut.
          aiText = await ctx.coachAI.rephrase({ question, answer: det }).catch(() => null);
          aiStatus = aiText ? "used" : "unavailable";
          if (aiText) await audit(ctx, "coach.ai_used", { intent: det.intent });
        }
      }
      return { ...det, aiText, aiStatus, aiAvailable: !!ctx.coachAI };
    },
  }),
};
