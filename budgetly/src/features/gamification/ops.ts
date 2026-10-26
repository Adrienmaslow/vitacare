import { z } from "zod";
import { defineOp } from "@/lib/ops/define";
import { endOfMonth, startOfMonth, addMonths } from "@/lib/dates";
import { loadSnapshot } from "../finance/snapshot";
import { achievementView, earnedAchievements } from "./service";

export const gamificationOps = {
  /** Évalue les défis et débloque les nouveaux succès (idempotent). */
  "achievements.get": defineOp({
    name: "achievements.get", mutation: true, input: z.object({}),
    run: async ({ store, today }) => {
      const [s, actions, aidApplications, imports, saved, records, unlocked, prefs] = await Promise.all([
        loadSnapshot(store, today), store.list("action_items"), store.list("user_aid_applications"), store.list("csv_imports"),
        store.list("saved_deals"), store.list("savings_records"), store.list("user_achievements"), store.list("user_preferences", { limit: 1 }),
      ]);
      const first = s.transactions.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null);
      const lastComplete = endOfMonth(addMonths(startOfMonth(today), -1));
      const completedMonths = first && first <= startOfMonth(addMonths(today, -1)) && first <= lastComplete ? 1 : 0;
      const earned = earnedAchievements({ snapshot: s, actions, aidApplications, imports, comparedDeal: saved.length + records.length > 0, completedMonths });
      const have = new Set(unlocked.map((u) => u.achievement_slug));
      const fresh = earned.filter((slug) => !have.has(slug));
      if (fresh.length && prefs[0]?.gamification_enabled !== false) await store.upsert("user_achievements", fresh.map((achievement_slug) => ({ achievement_slug })), ["achievement_slug"]);
      const all = await store.list("user_achievements");
      const days = [...new Set(s.transactions.filter((t) => t.source === "manual" || t.source === "csv").map((t) => t.created_at.slice(0, 10)))].sort().reverse();
      let streak = 0;
      for (let d = today, i = 0; i < days.length; i++) {
        if (days[i] === d) { streak++; d = new Date(Date.parse(d) - 86_400_000).toISOString().slice(0, 10); } else break;
      }
      return { enabled: prefs[0]?.gamification_enabled !== false, achievements: achievementView(all), newlyUnlocked: prefs[0]?.gamification_enabled === false ? [] : fresh, streak };
    },
  }),

  "quiz.complete": defineOp({
    name: "quiz.complete", mutation: true, input: z.object({ quiz: z.string().max(40), score: z.number().int().min(0).max(20), total: z.number().int().min(1).max(20) }),
    run: async ({ store }, { score, total }) => {
      const passed = score * 100 >= total * 70;
      if (passed) await store.upsert("user_achievements", [{ achievement_slug: "quiz-budget" }], ["achievement_slug"]);
      return { passed };
    },
  }),
};
