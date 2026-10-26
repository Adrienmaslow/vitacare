/**
 * Types des lignes de la base, alignés sur supabase/migrations.
 * Les montants sont des entiers en centimes (suffixe _minor).
 * Les dates « date » sont des chaînes ISO AAAA-MM-JJ ; les horodatages sont ISO 8601.
 */
export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;
export type Minor = number;

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type AccountType = "checking" | "savings" | "cash" | "secondary" | "business" | "wallet" | "other";
export type TransactionType = "income" | "expense" | "transfer_in" | "transfer_out";
export type TransactionStatus = "booked" | "pending";
export type TransactionSource = "manual" | "csv" | "recurring" | "bank" | "demo";

interface Base {
  id: UUID;
  user_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ProfileRow extends Base {
  display_name: string | null;
  status: "student" | "working_student" | "apprentice" | "young_worker" | "job_seeker" | "other" | null;
  age_range: "under_18" | "18_20" | "21_25" | "26_30" | "over_30" | null;
  city: string | null;
  region: string | null;
  institution_type: "university" | "grande_ecole" | "bts_iut" | "school" | "apprenticeship" | "other" | "none" | null;
  study_level: "bac" | "bac_1" | "bac_2" | "bac_3" | "bac_4" | "bac_5" | "doctorate" | "other" | "none" | null;
  housing: "family" | "crous" | "private_rent" | "shared_rent" | "owner" | "other" | null;
  monthly_income_minor: Minor | null;
  fixed_income_minor: Minor | null;
  variable_income_minor: Minor | null;
  family_support_minor: Minor | null;
  has_scholarship: boolean | null;
  receives_housing_aid: boolean | null;
  has_professional_income: boolean | null;
  current_aids: string[];
  objectives: string[];
  safety_threshold_minor: Minor;
  currency: string;
  onboarding_step: number;
  onboarding_completed_at: ISODateTime | null;
}

export interface NotificationSettings {
  disabledKinds?: string[];
  minPriority?: "low" | "medium" | "high" | "critical";
  maxPerDay?: number;
}

export interface UserPreferencesRow extends Base {
  theme: "light" | "dark" | "system";
  gamification_enabled: boolean;
  opportunities_enabled: boolean;
  notification_settings: NotificationSettings;
}

export type ConsentPurpose = "ai_coach" | "opportunity_matching" | "aid_eligibility" | "product_emails";
export interface UserConsentRow extends Base {
  purpose: ConsentPurpose;
  granted: boolean;
  policy_version: string;
}

export interface AvailabilityRow extends Base {
  days: string[];
  hours_per_week: number | null;
  weekend_ok: boolean;
  mobility: "none" | "walk" | "bike" | "public_transport" | "car" | null;
  radius_km: number | null;
  remote_ok: boolean;
  preferred_categories: string[];
  skills: string[];
  min_hourly_rate_minor: Minor | null;
}

export interface AccountRow extends Base {
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_minor: Minor;
  color: string;
  icon: string;
  is_archived: boolean;
}

export interface CategoryRow extends Base {
  user_id: UUID; // vide ("") côté application pour les catégories système (NULL en base)
  slug: string;
  name: string;
  kind: "expense" | "income" | "both";
  color: string;
  icon: string;
  is_essential: boolean;
}

export interface CategorizationRuleRow extends Base {
  pattern: string;
  match_type: "contains" | "starts_with" | "exact";
  category_id: UUID;
  priority: number;
}

export interface RecurringRow extends Base {
  account_id: UUID;
  label: string;
  type: "income" | "expense";
  amount_minor: Minor;
  currency: string;
  category_id: UUID | null;
  frequency: Frequency;
  start_date: ISODate;
  end_date: ISODate | null;
  next_date: ISODate;
  is_active: boolean;
  auto_post: boolean;
}

export type SubscriptionKind =
  | "streaming_video" | "streaming_music" | "phone" | "internet" | "cloud" | "software"
  | "sport" | "press" | "insurance" | "transport" | "other";

export interface SubscriptionRow extends Base {
  service: string;
  amount_minor: Minor;
  currency: string;
  frequency: Frequency;
  next_payment_date: ISODate;
  account_id: UUID | null;
  category_id: UUID | null;
  kind: SubscriptionKind;
  status: "active" | "paused" | "cancelled";
  match_pattern: string | null;
}

export interface CsvImportRow extends Base {
  account_id: UUID;
  filename: string;
  row_count: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  status: "completed" | "reverted";
}

export interface TransactionRow extends Base {
  account_id: UUID;
  date: ISODate;
  booking_date: ISODate | null;
  type: TransactionType;
  amount_minor: Minor;
  currency: string;
  label: string;
  category_id: UUID | null;
  subcategory: string | null;
  description: string | null;
  status: TransactionStatus;
  source: TransactionSource;
  recurring_id: UUID | null;
  subscription_id: UUID | null;
  import_id: UUID | null;
  transfer_group_id: UUID | null;
  dedup_hash: string | null;
}

export interface BudgetRow extends Base {
  month: ISODate;
  category_id: UUID | null;
  amount_minor: Minor;
  alert_thresholds: number[];
}

export type GoalKind = "computer" | "travel" | "license" | "car" | "emergency" | "moving" | "custom";
export interface SavingsGoalRow extends Base {
  name: string;
  description: string | null;
  kind: GoalKind;
  target_minor: Minor;
  target_date: ISODate | null;
  status: "active" | "achieved" | "archived";
}

export interface SavingsAllocationRow extends Base {
  goal_id: UUID;
  amount_minor: Minor;
  date: ISODate;
  note: string | null;
}

export type Priority = "low" | "medium" | "high" | "critical";
export interface NotificationRow extends Base {
  kind: string;
  title: string;
  body: string;
  priority: Priority;
  dedup_key: string;
  action_label: string | null;
  action_href: string | null;
  read_at: ISODateTime | null;
  external_delivery: Record<string, unknown>;
}

export type JobStatus = "saved" | "applied" | "interview" | "accepted" | "rejected" | "withdrawn" | "completed";
export interface JobApplicationRow extends Base {
  provider: string;
  external_id: string;
  is_example: boolean;
  title: string;
  employer: string | null;
  location: string | null;
  url: string | null;
  category: string | null;
  pay_label: string | null;
  status: JobStatus;
  notes: string | null;
  reminder_date: ISODate | null;
  applied_at: ISODate | null;
  earned_minor: Minor | null;
  snapshot: Record<string, unknown>;
}

export interface EarningTargetRow extends Base {
  monthly_target_minor: Minor;
}

export type AidStatus = "to_discover" | "to_check" | "preparing" | "sent" | "pending" | "granted" | "refused";
export interface AidApplicationRow extends Base {
  aid_slug: string;
  status: AidStatus;
  notes: string | null;
  deadline: ISODate | null;
  amount_received_minor: Minor | null;
}

export interface SavedDealRow extends Base {
  deal_slug: string;
}

export interface SavingsRecordRow extends Base {
  label: string;
  deal_slug: string | null;
  monthly_amount_minor: Minor;
  status: "declared" | "verified";
  started_on: ISODate;
  evidence: string | null;
}

export type ActionType = "cashflow" | "budget" | "savings" | "subscription" | "aid" | "earn" | "deal" | "data_quality" | "goal";
export type ActionStatus = "todo" | "in_progress" | "postponed" | "done" | "dismissed";
export interface ActionItemRow extends Base {
  week_start: ISODate;
  key: string;
  type: ActionType;
  title: string;
  description: string;
  rationale: string;
  priority: number;
  score_breakdown: Record<string, number>;
  impact_minor: Minor | null;
  impact_kind: "potential" | "estimated" | "avoided_risk" | null;
  time_minutes: number | null;
  source: string;
  confidence: "low" | "medium" | "high";
  valid_until: ISODate | null;
  href: string | null;
  cta_label: string | null;
  status: ActionStatus;
  realized_minor: Minor | null;
  realized_kind: "saving" | "extra_income" | "aid_received" | null;
  completed_at: ISODateTime | null;
}

export interface SimulationRow extends Base {
  name: string;
  params: Record<string, unknown>;
}

export interface ShoppingItemRow extends Base {
  name: string;
  quantity: number;
  estimated_unit_minor: Minor | null;
  checked: boolean;
}

export interface UserAchievementRow extends Base {
  achievement_slug: string;
  unlocked_at: ISODateTime;
}

export interface AuditEventRow extends Base {
  event: string;
  metadata: Record<string, unknown>;
}

export interface Tables {
  profiles: ProfileRow;
  user_preferences: UserPreferencesRow;
  user_consents: UserConsentRow;
  availability_preferences: AvailabilityRow;
  financial_accounts: AccountRow;
  transaction_categories: CategoryRow;
  categorization_rules: CategorizationRuleRow;
  recurring_transactions: RecurringRow;
  subscriptions: SubscriptionRow;
  csv_imports: CsvImportRow;
  transactions: TransactionRow;
  budgets: BudgetRow;
  savings_goals: SavingsGoalRow;
  savings_allocations: SavingsAllocationRow;
  notifications: NotificationRow;
  job_applications: JobApplicationRow;
  earning_targets: EarningTargetRow;
  user_aid_applications: AidApplicationRow;
  saved_deals: SavedDealRow;
  savings_records: SavingsRecordRow;
  action_items: ActionItemRow;
  financial_simulations: SimulationRow;
  shopping_list_items: ShoppingItemRow;
  user_achievements: UserAchievementRow;
  audit_events: AuditEventRow;
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

type Generated = "id" | "user_id" | "created_at" | "updated_at";
type NullableKeys<T> = { [K in keyof T]-?: null extends T[K] ? K : never }[keyof T];
type DefaultedKeys<T extends TableName> = Extract<keyof (typeof import("@/lib/data/defaults").TABLE_DEFAULTS)[T], keyof Row<T>>;
type OptionalKeys<T extends TableName> = NullableKeys<Row<T>> | DefaultedKeys<T>;

/**
 * Colonnes fournies à l'insertion : id/user_id/horodatages sont générés,
 * les colonnes nullables ou ayant une valeur par défaut (cf. TABLE_DEFAULTS) sont facultatives.
 */
export type Insert<T extends TableName> = Omit<Row<T>, Generated | OptionalKeys<T>> &
  Partial<Pick<Row<T>, Exclude<OptionalKeys<T>, Generated>>> & { id?: UUID };
export type Patch<T extends TableName> = Partial<Omit<Row<T>, "id" | "user_id" | "created_at" | "updated_at">>;
