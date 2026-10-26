import { z } from "zod";
import { audit, defineOp } from "@/lib/ops/define";
import { nonNegMinor, optionalText } from "@/lib/validation";
import type { ProfileRow, UserPreferencesRow } from "@/types/db";

export const OBJECTIVES = ["budget", "avoid_overdraft", "save", "find_job", "increase_income", "discover_aids", "reduce_spending", "fund_project"] as const;
export const POLICY_VERSION = "2026-10-26";

async function ensureProfile(store: import("@/lib/data/store").DataStore): Promise<ProfileRow> {
  const [p] = await store.list("profiles", { limit: 1 });
  if (p) return p;
  const [created] = await store.upsert("profiles", [{}], ["user_id"]);
  return created!;
}

async function ensurePreferences(store: import("@/lib/data/store").DataStore): Promise<UserPreferencesRow> {
  const [p] = await store.list("user_preferences", { limit: 1 });
  if (p) return p;
  const [created] = await store.upsert("user_preferences", [{}], ["user_id"]);
  return created!;
}

export const profileOps = {
  "profile.get": defineOp({
    name: "profile.get", mutation: false, input: z.object({}),
    run: async ({ store }) => {
      const [profile, preferences, consents, availability] = await Promise.all([
        ensureProfile(store), ensurePreferences(store), store.list("user_consents"), store.list("availability_preferences", { limit: 1 }),
      ]);
      return { profile, preferences, consents, availability: availability[0] ?? null };
    },
  }),

  "profile.update": defineOp({
    name: "profile.update", mutation: true,
    input: z.object({
      display_name: optionalText(80).optional(),
      status: z.enum(["student", "working_student", "apprentice", "young_worker", "job_seeker", "other"]).nullish(),
      age_range: z.enum(["under_18", "18_20", "21_25", "26_30", "over_30"]).nullish(),
      city: optionalText(80).optional(),
      region: optionalText(80).optional(),
      institution_type: z.enum(["university", "grande_ecole", "bts_iut", "school", "apprenticeship", "other", "none"]).nullish(),
      study_level: z.enum(["bac", "bac_1", "bac_2", "bac_3", "bac_4", "bac_5", "doctorate", "other", "none"]).nullish(),
      housing: z.enum(["family", "crous", "private_rent", "shared_rent", "owner", "other"]).nullish(),
      monthly_income_minor: nonNegMinor.nullish(),
      fixed_income_minor: nonNegMinor.nullish(),
      variable_income_minor: nonNegMinor.nullish(),
      family_support_minor: nonNegMinor.nullish(),
      has_scholarship: z.boolean().nullish(),
      receives_housing_aid: z.boolean().nullish(),
      has_professional_income: z.boolean().nullish(),
      current_aids: z.array(z.string().max(60)).max(20).optional(),
      objectives: z.array(z.enum(OBJECTIVES)).max(8).optional(),
      safety_threshold_minor: nonNegMinor.optional(),
      onboarding_step: z.number().int().min(0).max(10).optional(),
      complete_onboarding: z.boolean().optional(),
    }),
    run: async ({ store, now }, input) => {
      const profile = await ensureProfile(store);
      const { complete_onboarding, ...patch } = input;
      const updated = await store.update("profiles", profile.id, {
        ...patch,
        ...(complete_onboarding ? { onboarding_completed_at: now.toISOString() } : {}),
      });
      return updated;
    },
  }),

  "preferences.update": defineOp({
    name: "preferences.update", mutation: true,
    input: z.object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      gamification_enabled: z.boolean().optional(),
      opportunities_enabled: z.boolean().optional(),
      notification_settings: z.object({
        disabledKinds: z.array(z.string().max(40)).max(20).optional(),
        minPriority: z.enum(["low", "medium", "high", "critical"]).optional(),
        maxPerDay: z.number().int().min(1).max(20).optional(),
      }).optional(),
    }),
    run: async ({ store }, input) => {
      const p = await ensurePreferences(store);
      return store.update("user_preferences", p.id, input);
    },
  }),

  "consents.set": defineOp({
    name: "consents.set", mutation: true,
    input: z.object({ purpose: z.enum(["ai_coach", "opportunity_matching", "aid_eligibility", "product_emails"]), granted: z.boolean() }),
    run: async (ctx, input) => {
      const [row] = await ctx.store.upsert("user_consents", [{ ...input, policy_version: POLICY_VERSION }], ["purpose"]);
      await audit(ctx, input.granted ? "consent.granted" : "consent.revoked", { purpose: input.purpose });
      return row!;
    },
  }),

  "availability.upsert": defineOp({
    name: "availability.upsert", mutation: true,
    input: z.object({
      days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).max(7),
      hours_per_week: z.number().int().min(0).max(60).nullable(),
      weekend_ok: z.boolean(),
      mobility: z.enum(["none", "walk", "bike", "public_transport", "car"]).nullable(),
      radius_km: z.number().int().min(0).max(200).nullable(),
      remote_ok: z.boolean(),
      preferred_categories: z.array(z.string().max(40)).max(16),
      skills: z.array(z.string().trim().min(1).max(40)).max(20),
      min_hourly_rate_minor: nonNegMinor.nullable(),
    }),
    run: async ({ store }, input) => (await store.upsert("availability_preferences", [input], ["user_id"]))[0]!,
  }),

  "account.export": defineOp({
    name: "account.export", mutation: false, sensitive: true, input: z.object({}),
    run: async (ctx) => {
      const tables = [
        "profiles", "user_preferences", "user_consents", "availability_preferences", "financial_accounts", "transactions",
        "categorization_rules", "recurring_transactions", "subscriptions", "csv_imports", "budgets", "savings_goals",
        "savings_allocations", "notifications", "job_applications", "earning_targets", "user_aid_applications", "saved_deals",
        "savings_records", "action_items", "financial_simulations", "shopping_list_items", "user_achievements", "audit_events",
      ] as const;
      const data: Record<string, unknown[]> = {};
      for (const t of tables) data[t] = await ctx.store.list(t);
      data.transaction_categories = (await ctx.store.list("transaction_categories")).filter((c) => c.user_id);
      await audit(ctx, "account.exported");
      return { exportedAt: ctx.now.toISOString(), format: "budgetly-export-v1", data };
    },
  }),
};
