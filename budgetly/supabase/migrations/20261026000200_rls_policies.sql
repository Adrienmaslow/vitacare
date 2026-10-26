-- =====================================================================
-- BUDGETLY — Row Level Security
-- Principe : chaque ligne n'est visible et modifiable que par son propriétaire
-- (user_id = auth.uid()). Les catégories système (user_id NULL) sont lisibles
-- par tout utilisateur authentifié mais jamais modifiables via l'API.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','user_consents','availability_preferences','financial_accounts',
    'categorization_rules','recurring_transactions','subscriptions','csv_imports',
    'transactions','budgets','savings_goals','savings_allocations','notifications','job_applications',
    'earning_targets','user_aid_applications','saved_deals','savings_records','action_items',
    'financial_simulations','shopping_list_items','user_achievements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy "%s_select_own" on public.%I for select to authenticated using (user_id = (select auth.uid()))$p$, t, t);
    execute format($p$create policy "%s_insert_own" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))$p$, t, t);
    execute format($p$create policy "%s_update_own" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t, t);
    execute format($p$create policy "%s_delete_own" on public.%I for delete to authenticated using (user_id = (select auth.uid()))$p$, t, t);
  end loop;
end $$;

-- Catégories : système en lecture, personnelles en lecture/écriture.
alter table public.transaction_categories enable row level security;
alter table public.transaction_categories force row level security;
create policy "categories_select" on public.transaction_categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "categories_insert_own" on public.transaction_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories_update_own" on public.transaction_categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories_delete_own" on public.transaction_categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- Journal d'audit : insertion et lecture par le propriétaire, jamais de modification.
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
create policy "audit_select_own" on public.audit_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "audit_insert_own" on public.audit_events
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Une règle de catégorisation, un budget, une transaction ou un abonnement ne peut
-- référencer qu'une catégorie système ou une catégorie de son propriétaire.
create or replace function public.category_is_usable(p_category uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_category is null or exists (
    select 1 from public.transaction_categories c
    where c.id = p_category and (c.user_id is null or c.user_id = p_user)
  );
$$;

alter table public.transactions add constraint transactions_category_owner check (public.category_is_usable(category_id, user_id));
alter table public.budgets add constraint budgets_category_owner check (public.category_is_usable(category_id, user_id));
alter table public.categorization_rules add constraint rules_category_owner check (public.category_is_usable(category_id, user_id));
alter table public.recurring_transactions add constraint recurring_category_owner check (public.category_is_usable(category_id, user_id));
alter table public.subscriptions add constraint subscriptions_category_owner check (public.category_is_usable(category_id, user_id));

-- Les rôles API n'ont aucun accès aux fonctions internes.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.category_is_usable(uuid, uuid) from public, anon;
grant execute on function public.category_is_usable(uuid, uuid) to authenticated;

-- Le rôle anonyme n'accède à aucune table.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
