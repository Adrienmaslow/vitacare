// Génère la migration de catalogue des catégories système depuis src/data/categories.ts.
// Usage : node scripts/generate-category-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../src/data/categories.ts", import.meta.url), "utf8");
const rows = [...src.matchAll(/\{ id: "([^"]+)", slug: "([^"]+)", name: "([^"]+)", kind: "(\w+)", color: "(#[0-9A-Fa-f]{6})", icon: "([^"]+)", isEssential: (true|false) \}/g)];
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const values = rows
  .map(([, id, slug, name, kind, color, icon, ess]) => `  (${q(id)}, null, ${q(slug)}, ${q(name)}, ${q(kind)}, ${q(color)}, ${q(icon)}, ${ess})`)
  .join(",\n");
const sql = `-- Généré par scripts/generate-category-seed.mjs — ne pas modifier à la main.
insert into public.transaction_categories (id, user_id, slug, name, kind, color, icon, is_essential) values
${values}
on conflict (id) do update set name = excluded.name, kind = excluded.kind, color = excluded.color,
  icon = excluded.icon, is_essential = excluded.is_essential;
`;
writeFileSync(new URL("../supabase/migrations/20261026000300_system_categories.sql", import.meta.url), sql);
console.log(`${rows.length} catégories écrites.`);
