/** Évaluation des défis à partir des données réelles (idempotent). */
import type { ActionItemRow, AidApplicationRow, CsvImportRow, UserAchievementRow } from "@/types/db";
import type { FinancialSnapshot } from "../finance/snapshot";
import { ACHIEVEMENTS } from "@/data/achievements";

export interface AchievementContext {
  snapshot: FinancialSnapshot;
  actions: ActionItemRow[];
  aidApplications: AidApplicationRow[];
  imports: CsvImportRow[];
  comparedDeal: boolean;
  completedMonths: number;
}

export function earnedAchievements(ctx: AchievementContext): string[] {
  const s = ctx.snapshot;
  const days = new Set(s.transactions.filter((t) => t.source !== "recurring").map((t) => t.date));
  const earned: string[] = [];
  if (s.accounts.length) earned.push("first-account");
  if (s.budgets.length) earned.push("first-budget");
  if (days.size >= 7) earned.push("tracking-7-days");
  if (s.goals.length) earned.push("first-goal");
  if (ctx.aidApplications.length) earned.push("aid-explorer");
  if (ctx.comparedDeal) earned.push("subscription-check");
  if (ctx.completedMonths >= 1) earned.push("first-review");
  if (ctx.actions.filter((a) => a.status === "done").length >= 3) earned.push("three-actions");
  if (ctx.imports.some((i) => i.status === "completed")) earned.push("csv-import");
  return earned;
}

export function achievementView(unlocked: UserAchievementRow[]) {
  const map = new Map(unlocked.map((u) => [u.achievement_slug, u.unlocked_at]));
  return ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: map.get(a.slug) ?? null }));
}
