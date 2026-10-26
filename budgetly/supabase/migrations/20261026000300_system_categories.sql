-- Généré par scripts/generate-category-seed.mjs — ne pas modifier à la main.
insert into public.transaction_categories (id, user_id, slug, name, kind, color, icon, is_essential) values
  ('00000000-0000-4000-8000-000000000001', null, 'logement', 'Logement', 'expense', '#7357F6', 'home', true),
  ('00000000-0000-4000-8000-000000000002', null, 'alimentation', 'Alimentation', 'expense', '#22C55E', 'shopping-basket', true),
  ('00000000-0000-4000-8000-000000000003', null, 'transport', 'Transport', 'expense', '#0EA5E9', 'train-front', true),
  ('00000000-0000-4000-8000-000000000004', null, 'sante', 'Santé', 'expense', '#EF4444', 'heart-pulse', true),
  ('00000000-0000-4000-8000-000000000005', null, 'loisirs', 'Loisirs', 'expense', '#F59E0B', 'party-popper', false),
  ('00000000-0000-4000-8000-000000000006', null, 'shopping', 'Shopping', 'expense', '#EC4899', 'shopping-bag', false),
  ('00000000-0000-4000-8000-000000000007', null, 'etudes', 'Études', 'expense', '#6366F1', 'graduation-cap', true),
  ('00000000-0000-4000-8000-000000000008', null, 'abonnements', 'Abonnements', 'expense', '#A855F7', 'repeat', false),
  ('00000000-0000-4000-8000-000000000009', null, 'assurance', 'Assurance', 'expense', '#14B8A6', 'shield-check', true),
  ('00000000-0000-4000-8000-00000000000a', null, 'restaurants', 'Restaurants', 'expense', '#F97316', 'utensils', false),
  ('00000000-0000-4000-8000-00000000000b', null, 'voyage', 'Voyage', 'expense', '#06B6D4', 'plane', false),
  ('00000000-0000-4000-8000-00000000000c', null, 'telephonie', 'Téléphone & internet', 'expense', '#8B5CF6', 'smartphone', true),
  ('00000000-0000-4000-8000-00000000000d', null, 'frais-bancaires', 'Frais bancaires', 'expense', '#64748B', 'landmark', false),
  ('00000000-0000-4000-8000-00000000000e', null, 'autres', 'Autres', 'both', '#94A3B8', 'circle-dashed', false),
  ('00000000-0000-4000-8000-000000000101', null, 'salaire', 'Salaire', 'income', '#22C55E', 'briefcase', false),
  ('00000000-0000-4000-8000-000000000102', null, 'bourse', 'Bourse', 'income', '#10B981', 'graduation-cap', false),
  ('00000000-0000-4000-8000-000000000103', null, 'aides', 'Aides', 'income', '#84CC16', 'hand-heart', false),
  ('00000000-0000-4000-8000-000000000104', null, 'soutien-familial', 'Soutien familial', 'income', '#2DD4BF', 'users', false),
  ('00000000-0000-4000-8000-000000000105', null, 'missions', 'Missions & extras', 'income', '#4ADE80', 'sparkles', false),
  ('00000000-0000-4000-8000-000000000106', null, 'revenus-autres', 'Autres revenus', 'income', '#A3E635', 'plus-circle', false)
on conflict (id) do update set name = excluded.name, kind = excluded.kind, color = excluded.color,
  icon = excluded.icon, is_essential = excluded.is_essential;
