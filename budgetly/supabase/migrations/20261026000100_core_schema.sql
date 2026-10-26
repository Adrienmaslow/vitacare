-- =====================================================================
-- BUDGETLY — schéma principal
-- Conventions :
--   * toutes les clés primaires sont des UUID ;
--   * tous les montants sont des entiers en unités mineures (centimes) : bigint ;
--   * chaque table utilisateur porte user_id → auth.users(id) ON DELETE CASCADE ;
--   * la sécurité repose sur Row Level Security (voir migration 0200).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Fonction utilitaire : mise à jour automatique de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  status text check (status in ('student','working_student','apprentice','young_worker','job_seeker','other')),
  age_range text check (age_range in ('under_18','18_20','21_25','26_30','over_30')),
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  institution_type text check (institution_type in ('university','grande_ecole','bts_iut','school','apprenticeship','other','none')),
  study_level text check (study_level in ('bac','bac_1','bac_2','bac_3','bac_4','bac_5','doctorate','other','none')),
  housing text check (housing in ('family','crous','private_rent','shared_rent','owner','other')),
  monthly_income_minor bigint check (monthly_income_minor >= 0),
  fixed_income_minor bigint check (fixed_income_minor >= 0),
  variable_income_minor bigint check (variable_income_minor >= 0),
  family_support_minor bigint check (family_support_minor >= 0),
  has_scholarship boolean,
  receives_housing_aid boolean,
  has_professional_income boolean,
  current_aids text[] not null default '{}',
  objectives text[] not null default '{}',
  safety_threshold_minor bigint not null default 5000 check (safety_threshold_minor >= 0),
  currency char(3) not null default 'EUR',
  onboarding_step smallint not null default 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  gamification_enabled boolean not null default true,
  opportunities_enabled boolean not null default false,
  notification_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('ai_coach','opportunity_matching','aid_eligibility','product_emails')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, purpose)
);

create table public.availability_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  days text[] not null default '{}',
  hours_per_week smallint check (hours_per_week between 0 and 60),
  weekend_ok boolean not null default false,
  mobility text check (mobility in ('none','walk','bike','public_transport','car')),
  radius_km smallint check (radius_km between 0 and 200),
  remote_ok boolean not null default true,
  preferred_categories text[] not null default '{}',
  skills text[] not null default '{}',
  min_hourly_rate_minor bigint check (min_hourly_rate_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Comptes financiers
-- ---------------------------------------------------------------------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('checking','savings','cash','secondary','business','wallet','other')),
  currency char(3) not null default 'EUR',
  initial_balance_minor bigint not null default 0,
  color text not null default '#7357F6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'wallet',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index financial_accounts_user_idx on public.financial_accounts(user_id);

-- ---------------------------------------------------------------------
-- Catégories : user_id NULL = catégorie système partagée (lecture seule)
-- ---------------------------------------------------------------------
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('expense','income','both')),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'tag',
  is_essential boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index transaction_categories_system_slug on public.transaction_categories(slug) where user_id is null;
create unique index transaction_categories_user_slug on public.transaction_categories(user_id, slug) where user_id is not null;

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null check (char_length(pattern) between 2 and 80),
  match_type text not null default 'contains' check (match_type in ('contains','starts_with','exact')),
  category_id uuid not null references public.transaction_categories(id) on delete cascade,
  priority smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern, match_type)
);

-- ---------------------------------------------------------------------
-- Échéances récurrentes et abonnements
-- ---------------------------------------------------------------------
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  label text not null check (char_length(label) between 1 and 120),
  type text not null check (type in ('income','expense')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'EUR',
  category_id uuid references public.transaction_categories(id) on delete set null,
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  start_date date not null,
  end_date date,
  next_date date not null,
  is_active boolean not null default true,
  auto_post boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.financial_accounts(id, user_id) on delete cascade,
  check (end_date is null or end_date >= start_date)
);
create index recurring_user_idx on public.recurring_transactions(user_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (char_length(service) between 1 and 80),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'EUR',
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_payment_date date not null,
  account_id uuid,
  category_id uuid references public.transaction_categories(id) on delete set null,
  kind text not null default 'other' check (kind in ('streaming_video','streaming_music','phone','internet','cloud','software','sport','press','insurance','transport','other')),
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  match_pattern text check (char_length(match_pattern) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.financial_accounts(id, user_id) on delete set null (account_id)
);
create index subscriptions_user_idx on public.subscriptions(user_id);

-- ---------------------------------------------------------------------
-- Imports CSV (les fichiers bruts ne sont jamais stockés)
-- ---------------------------------------------------------------------
create table public.csv_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  filename text not null check (char_length(filename) <= 200),
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  status text not null default 'completed' check (status in ('completed','reverted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.financial_accounts(id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Transactions
--   amount_minor est toujours strictement positif ; le sens est porté par type.
--   Un transfert = 2 lignes (transfer_out / transfer_in) partageant transfer_group_id.
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  date date not null,
  booking_date date,
  type text not null check (type in ('income','expense','transfer_in','transfer_out')),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor < 100000000000),
  currency char(3) not null default 'EUR',
  label text not null check (char_length(label) between 1 and 200),
  category_id uuid references public.transaction_categories(id) on delete set null,
  subcategory text check (char_length(subcategory) <= 60),
  description text check (char_length(description) <= 1000),
  status text not null default 'booked' check (status in ('booked','pending')),
  source text not null default 'manual' check (source in ('manual','csv','recurring','bank','demo')),
  recurring_id uuid references public.recurring_transactions(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  import_id uuid references public.csv_imports(id) on delete cascade,
  transfer_group_id uuid,
  dedup_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.financial_accounts(id, user_id) on delete cascade,
  check ((type in ('transfer_in','transfer_out')) = (transfer_group_id is not null)),
  check (booking_date is null or booking_date >= date - 60)
);
create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index transactions_account_idx on public.transactions(account_id);
create index transactions_category_idx on public.transactions(user_id, category_id);
create index transactions_import_idx on public.transactions(import_id) where import_id is not null;
create index transactions_dedup_idx on public.transactions(user_id, dedup_hash) where dedup_hash is not null;
-- Génération d'échéances idempotente : une seule occurrence par récurrence et par date.
create unique index transactions_recurring_once on public.transactions(recurring_id, date) where recurring_id is not null;
-- Un transfert ne peut avoir qu'une jambe de chaque sens.
create unique index transactions_transfer_leg on public.transactions(transfer_group_id, type) where transfer_group_id is not null;

-- ---------------------------------------------------------------------
-- Budgets (un budget par mois, global si category_id NULL)
-- ---------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category_id uuid references public.transaction_categories(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  alert_thresholds smallint[] not null default '{70,85,100}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index budgets_unique_category on public.budgets(user_id, month, category_id) where category_id is not null;
create unique index budgets_unique_global on public.budgets(user_id, month) where category_id is null;

-- ---------------------------------------------------------------------
-- Objectifs d'épargne
-- ---------------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  kind text not null default 'custom' check (kind in ('computer','travel','license','car','emergency','moving','custom')),
  target_minor bigint not null check (target_minor > 0),
  target_date date,
  status text not null default 'active' check (status in ('active','achieved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.savings_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  amount_minor bigint not null check (amount_minor <> 0),
  date date not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals(id, user_id) on delete cascade
);
create index savings_allocations_goal_idx on public.savings_allocations(goal_id);

-- ---------------------------------------------------------------------
-- Notifications (centre de notifications + alertes financières)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) <= 40),
  title text not null check (char_length(title) <= 140),
  body text not null check (char_length(body) <= 600),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  dedup_key text not null check (char_length(dedup_key) <= 160),
  action_label text check (char_length(action_label) <= 60),
  action_href text check (action_href ~ '^/[A-Za-z0-9/_?=&%-]*$'),
  read_at timestamptz,
  external_delivery jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Revenus complémentaires : suivi des offres sauvegardées et candidatures
--   Les offres elles-mêmes proviennent de fournisseurs externes (voir docs/EXTERNAL_PROVIDERS.md).
-- ---------------------------------------------------------------------
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  external_id text not null check (char_length(external_id) <= 120),
  is_example boolean not null default false,
  title text not null check (char_length(title) <= 200),
  employer text check (char_length(employer) <= 200),
  location text check (char_length(location) <= 200),
  url text check (url ~ '^https://'),
  category text check (char_length(category) <= 40),
  pay_label text check (char_length(pay_label) <= 120),
  status text not null default 'saved' check (status in ('saved','applied','interview','accepted','rejected','withdrawn','completed')),
  notes text check (char_length(notes) <= 2000),
  reminder_date date,
  applied_at date,
  earned_minor bigint check (earned_minor >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);

create table public.earning_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  monthly_target_minor bigint not null check (monthly_target_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Aides : le catalogue est versionné dans le code (src/data/aids.ts),
-- la base ne stocke que le suivi des démarches de l'utilisateur.
-- ---------------------------------------------------------------------
create table public.user_aid_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aid_slug text not null check (aid_slug ~ '^[a-z0-9_-]{2,60}$'),
  status text not null default 'to_discover' check (status in ('to_discover','to_check','preparing','sent','pending','granted','refused')),
  notes text check (char_length(notes) <= 2000),
  deadline date,
  amount_received_minor bigint check (amount_received_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, aid_slug)
);

-- ---------------------------------------------------------------------
-- Économies : bons plans sauvegardés et économies déclarées / vérifiées
-- ---------------------------------------------------------------------
create table public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_slug text not null check (deal_slug ~ '^[a-z0-9_-]{2,60}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, deal_slug)
);

create table public.savings_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  deal_slug text,
  monthly_amount_minor bigint not null check (monthly_amount_minor > 0),
  status text not null check (status in ('declared','verified')),
  started_on date not null,
  evidence text check (char_length(evidence) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Plan d'action
-- ---------------------------------------------------------------------
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  key text not null check (char_length(key) <= 120),
  type text not null check (type in ('cashflow','budget','savings','subscription','aid','earn','deal','data_quality','goal')),
  title text not null check (char_length(title) <= 140),
  description text not null check (char_length(description) <= 600),
  rationale text not null check (char_length(rationale) <= 600),
  priority smallint not null check (priority between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  impact_minor bigint check (impact_minor >= 0),
  impact_kind text check (impact_kind in ('potential','estimated','avoided_risk')),
  time_minutes smallint check (time_minutes between 0 and 600),
  source text not null check (char_length(source) <= 200),
  confidence text not null check (confidence in ('low','medium','high')),
  valid_until date,
  href text check (href ~ '^/[A-Za-z0-9/_?=&%-]*$'),
  cta_label text check (char_length(cta_label) <= 60),
  status text not null default 'todo' check (status in ('todo','in_progress','postponed','done','dismissed')),
  realized_minor bigint check (realized_minor >= 0),
  realized_kind text check (realized_kind in ('saving','extra_income','aid_received')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start, key)
);

-- ---------------------------------------------------------------------
-- Simulations sauvegardées (toujours fictives)
-- ---------------------------------------------------------------------
create table public.financial_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  params jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Vie quotidienne : liste de courses planifiée
-- ---------------------------------------------------------------------
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  quantity smallint not null default 1 check (quantity between 1 and 99),
  estimated_unit_minor bigint check (estimated_unit_minor >= 0),
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gamification (catalogue des succès dans le code)
-- ---------------------------------------------------------------------
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_slug text not null check (achievement_slug ~ '^[a-z0-9_-]{2,60}$'),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, achievement_slug)
);

-- ---------------------------------------------------------------------
-- Journal d'audit minimal (aucun montant, aucune donnée bancaire)
-- ---------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event ~ '^[a-z_.]{3,60}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_events_user_idx on public.audit_events(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','user_consents','availability_preferences','financial_accounts',
    'transaction_categories','categorization_rules','recurring_transactions','subscriptions','csv_imports',
    'transactions','budgets','savings_goals','savings_allocations','notifications','job_applications',
    'earning_targets','user_aid_applications','saved_deals','savings_records','action_items',
    'financial_simulations','shopping_list_items','user_achievements','audit_events'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Création automatique du profil et des préférences à l'inscription
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
