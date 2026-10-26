# CLAUDE.md — instructions pour reprendre BUDGETLY

## Commandes
```bash
npm run dev            # serveur de développement (http://localhost:3000, /demo pour la démo)
npm run lint           # ESLint (0 erreur attendue)
npm run typecheck      # tsc --noEmit
npm test               # Vitest (unitaires + intégration si TEST_DATABASE_URL)
npm run db:test:start  # PostgreSQL local jetable pour les tests d'intégration
npm run build && npm run test:e2e   # Playwright sur le build (port 3100)
node scripts/generate-category-seed.mjs   # après modification de src/data/categories.ts
npm run icons          # régénère les icônes PWA
```

## Architecture (à respecter)
- Pages (`src/app`) → hooks `useOp`/`useMutationOp` → `callOp` → opération (`src/features/*/ops.ts`) → services purs + `DataStore`.
- **Toute nouvelle fonctionnalité de données = une opération** déclarée avec `defineOp` et ajoutée à
  `src/lib/ops/registry.ts`. Ne jamais appeler Supabase directement depuis une page.
- Les calculs financiers vont dans des fonctions **pures** testées (`service.ts`/`engine.ts`), jamais dans les composants.
- Modifier le schéma = nouvelle migration `supabase/migrations/AAAAMMJJHHMMSS_nom.sql` + mise à jour de
  `src/types/db.ts`, `src/lib/data/defaults.ts` (défauts, colonnes nullables) et, si unicité, `UNIQUE` dans `local-store.ts`.

## Règles non négociables
- Montants en **centimes entiers** (`Minor`) ; convertir les saisies avec `parseAmount`, diviser avec `mulDiv`.
- Jamais de chiffre, d'offre, d'aide ou de promotion inventés. Une donnée externe porte sa source (`SourceInfo`).
- Les revenus potentiels (missions, aides) ne sont jamais ajoutés aux soldes ou prévisions.
- Ne jamais réduire les dépenses essentielles dans une recommandation ; pas d'incitation à l'endettement.
- Toute table utilisateur : `user_id`, RLS (migration 0200), FK composite `(id, user_id)` pour les références internes.
- Aucun secret côté client (`NEXT_PUBLIC_` uniquement pour les valeurs publiques) ; modules serveur avec `import "server-only"`.
- Dates métier : chaînes `AAAA-MM-JJ` via `src/lib/dates.ts`.
- Textes de l'interface en français, tutoiement, bienveillants.
- Ne pas déclarer une fonctionnalité terminée sans test exécuté.

## Conventions
- TypeScript strict, `noUncheckedIndexedAccess`. Composants UI maison dans `src/components/ui` (Radix + Tailwind).
- Couleurs via les tokens de `globals.css` (`bg-brand`, `text-muted`, `bg-surface`…), mode sombre par classe `.dark`.
- Accessibilité : labels via `Field`, `aria-label` sur les boutons-icônes, graphiques dans `<figure aria-label>`.
- Effets React : corps en bloc `{ … }` (ne jamais renvoyer la valeur d'un appel, ex. `scrollIntoView`).

## Modules
accounts · transactions · imports · finance (soldes, échéancier, tableau de bord) · budgets · forecasts · alerts ·
notifications · goals · subscriptions · analytics · earn (+ providers) · aids · deals · life · action-plan · coach ·
simulations · gamification · profile · demo · banking (interface seulement).

## Documentation
`docs/ARCHITECTURE.md`, `DATABASE.md`, `FINANCIAL_CALCULATIONS.md`, `EXTERNAL_PROVIDERS.md`, `SECURITY.md`,
`DEPLOYMENT.md`, `DEMO.md`, `ROADMAP.md`, `TESTING.md`, `PROGRESS.md` (état et reprise).
