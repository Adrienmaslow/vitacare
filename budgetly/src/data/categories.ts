/**
 * Catégories système. Source de vérité unique : la migration SQL de catalogue
 * est générée à partir de ce fichier (scripts/generate-category-seed.mjs) et un
 * test vérifie que les deux restent synchronisés.
 */
export type CategoryKind = "expense" | "income" | "both";

export interface SystemCategory {
  /** UUID stable : identique en base, en démo et dans les tests. */
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  isEssential: boolean;
}

export const SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  { id: "00000000-0000-4000-8000-000000000001", slug: "logement", name: "Logement", kind: "expense", color: "#7357F6", icon: "home", isEssential: true },
  { id: "00000000-0000-4000-8000-000000000002", slug: "alimentation", name: "Alimentation", kind: "expense", color: "#22C55E", icon: "shopping-basket", isEssential: true },
  { id: "00000000-0000-4000-8000-000000000003", slug: "transport", name: "Transport", kind: "expense", color: "#0EA5E9", icon: "train-front", isEssential: true },
  { id: "00000000-0000-4000-8000-000000000004", slug: "sante", name: "Santé", kind: "expense", color: "#EF4444", icon: "heart-pulse", isEssential: true },
  { id: "00000000-0000-4000-8000-000000000005", slug: "loisirs", name: "Loisirs", kind: "expense", color: "#F59E0B", icon: "party-popper", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000006", slug: "shopping", name: "Shopping", kind: "expense", color: "#EC4899", icon: "shopping-bag", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000007", slug: "etudes", name: "Études", kind: "expense", color: "#6366F1", icon: "graduation-cap", isEssential: true },
  { id: "00000000-0000-4000-8000-000000000008", slug: "abonnements", name: "Abonnements", kind: "expense", color: "#A855F7", icon: "repeat", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000009", slug: "assurance", name: "Assurance", kind: "expense", color: "#14B8A6", icon: "shield-check", isEssential: true },
  { id: "00000000-0000-4000-8000-00000000000a", slug: "restaurants", name: "Restaurants", kind: "expense", color: "#F97316", icon: "utensils", isEssential: false },
  { id: "00000000-0000-4000-8000-00000000000b", slug: "voyage", name: "Voyage", kind: "expense", color: "#06B6D4", icon: "plane", isEssential: false },
  { id: "00000000-0000-4000-8000-00000000000c", slug: "telephonie", name: "Téléphone & internet", kind: "expense", color: "#8B5CF6", icon: "smartphone", isEssential: true },
  { id: "00000000-0000-4000-8000-00000000000d", slug: "frais-bancaires", name: "Frais bancaires", kind: "expense", color: "#64748B", icon: "landmark", isEssential: false },
  { id: "00000000-0000-4000-8000-00000000000e", slug: "autres", name: "Autres", kind: "both", color: "#94A3B8", icon: "circle-dashed", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000101", slug: "salaire", name: "Salaire", kind: "income", color: "#22C55E", icon: "briefcase", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000102", slug: "bourse", name: "Bourse", kind: "income", color: "#10B981", icon: "graduation-cap", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000103", slug: "aides", name: "Aides", kind: "income", color: "#84CC16", icon: "hand-heart", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000104", slug: "soutien-familial", name: "Soutien familial", kind: "income", color: "#2DD4BF", icon: "users", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000105", slug: "missions", name: "Missions & extras", kind: "income", color: "#4ADE80", icon: "sparkles", isEssential: false },
  { id: "00000000-0000-4000-8000-000000000106", slug: "revenus-autres", name: "Autres revenus", kind: "income", color: "#A3E635", icon: "plus-circle", isEssential: false },
] as const;

export const CATEGORY_BY_SLUG = new Map(SYSTEM_CATEGORIES.map((c) => [c.slug, c]));

export function systemCategoryId(slug: string): string {
  const c = CATEGORY_BY_SLUG.get(slug);
  if (!c) throw new Error(`Catégorie système inconnue : ${slug}`);
  return c.id;
}
