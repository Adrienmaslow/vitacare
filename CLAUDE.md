# ECE STUDY — consignes pour les agents

Application React/TypeScript (Vite, Tailwind 4, Dexie, PWA) de révision pour « De l’atome à la puce » (ECE ING2).
Le dépôt contient aussi `PJ_WEB_2026_…zip` (projet sans rapport) : ne pas le modifier.

## Commandes

- `npm run dev` · `npm run build` (base `/vitacare/`) · `npm run preview`
- `npm test` (Vitest) · `npm run test:e2e` (Playwright ; `PW_CHROMIUM_PATH` si navigateur préinstallé)
- `npm run typecheck` · `npm run lint` · `npm run format`

## Règles

- **Exactitude scientifique d’abord.** Toute réponse numérique ajoutée doit être recalculée ; `tests/content/integrity.test.ts` doit passer.
- **Ne jamais committer de PDF** ni reproduire intégralement les supports (dépôt public). Reformuler fidèlement, citer la page/diapo (`SourceReference`).
- Distinguer contenu du PDF (`origin: 'pdf'`, `correctionOrigin: 'livret'`) et ajouts (`'ece-study'`). Signaler les erreurs du support (`erratum`, callout `erratum`) et les documenter dans `docs/CONTENT_AUDIT.md`.
- Ne jamais afficher la bonne réponse avant validation ; ne jamais fabriquer de statistiques.
- Contenu dans `src/content`, logique pure dans `src/engines` (testée), UI dans `src/components` / `src/pages`.
- Schéma IndexedDB : ajouter une nouvelle `version()` dans `src/db/index.ts`, ne jamais modifier les précédentes. Export : incrémenter `EXPORT_FORMAT_VERSION` + migration dans `src/db/backup.ts`.
- Interface en français, sans emojis ; accessibilité (labels, rôles ARIA, reduced-motion) obligatoire.
- Aucune clé d’API dans le frontend.
