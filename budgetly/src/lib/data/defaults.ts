/**
 * Valeurs par défaut des colonnes, miroir des DEFAULT SQL.
 * Utilisées par le magasin local (mode démo / tests) et pour typer les insertions.
 * Les colonnes nullables absentes valent null.
 */
export const TABLE_DEFAULTS = {
  profiles: {
    current_aids: [] as string[], objectives: [] as string[], safety_threshold_minor: 5000, currency: "EUR", onboarding_step: 0,
  },
  user_preferences: {
    theme: "system" as const, gamification_enabled: true, opportunities_enabled: false, notification_settings: {},
  },
  user_consents: {},
  availability_preferences: {
    days: [] as string[], weekend_ok: false, remote_ok: true, preferred_categories: [] as string[], skills: [] as string[],
  },
  financial_accounts: { currency: "EUR", initial_balance_minor: 0, color: "#7357F6", icon: "wallet", is_archived: false },
  transaction_categories: { color: "#64748B", icon: "tag", is_essential: false },
  categorization_rules: { match_type: "contains" as const, priority: 100 },
  recurring_transactions: { currency: "EUR", is_active: true, auto_post: true },
  subscriptions: { currency: "EUR", kind: "other" as const, status: "active" as const },
  csv_imports: { row_count: 0, imported_count: 0, duplicate_count: 0, error_count: 0, status: "completed" as const },
  transactions: { currency: "EUR", status: "booked" as const, source: "manual" as const },
  budgets: { alert_thresholds: [70, 85, 100] },
  savings_goals: { kind: "custom" as const, status: "active" as const },
  savings_allocations: {},
  notifications: { priority: "medium" as const, external_delivery: {} },
  job_applications: { is_example: false, status: "saved" as const, snapshot: {} },
  earning_targets: {},
  user_aid_applications: { status: "to_discover" as const },
  saved_deals: {},
  savings_records: {},
  action_items: { score_breakdown: {}, status: "todo" as const },
  financial_simulations: {},
  shopping_list_items: { quantity: 1, checked: false },
  user_achievements: {} as { unlocked_at?: string },
  audit_events: { metadata: {} },
} as const;

/** Colonnes nullables par table (valeur null si absentes à l'insertion). */
export const NULLABLE_COLUMNS: Record<string, readonly string[]> = {
  profiles: ["display_name","status","age_range","city","region","institution_type","study_level","housing","monthly_income_minor","fixed_income_minor","variable_income_minor","family_support_minor","has_scholarship","receives_housing_aid","has_professional_income","onboarding_completed_at"],
  availability_preferences: ["hours_per_week","mobility","radius_km","min_hourly_rate_minor"],
  recurring_transactions: ["category_id","end_date"],
  subscriptions: ["account_id","category_id","match_pattern"],
  transactions: ["booking_date","category_id","subcategory","description","recurring_id","subscription_id","import_id","transfer_group_id","dedup_hash"],
  budgets: ["category_id"],
  savings_goals: ["description","target_date"],
  savings_allocations: ["note"],
  notifications: ["action_label","action_href","read_at"],
  job_applications: ["employer","location","url","category","pay_label","notes","reminder_date","applied_at","earned_minor"],
  user_aid_applications: ["notes","deadline","amount_received_minor"],
  savings_records: ["deal_slug","evidence"],
  action_items: ["impact_minor","impact_kind","time_minutes","valid_until","href","cta_label","realized_minor","realized_kind","completed_at"],
  shopping_list_items: ["estimated_unit_minor"],
};
