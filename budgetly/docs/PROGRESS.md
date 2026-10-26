# État d'avancement et instructions de reprise

_Dernière mise à jour : 26/10/2026._

## Fonctionnalités terminées et vérifiées
Toutes les phases 1 à 14 du plan de développement sont implémentées (voir README, tableau des fonctionnalités).
Vérifications exécutées : lint (0 erreur), typecheck, 140 tests Vitest (dont 11 sur PostgreSQL réel),
build de production, 16 tests Playwright, contrôle visuel de toutes les pages en mode démo (aucune erreur d'exécution).

## Phase 15 (livraison) — état
- [x] Documentation (README, docs/*, CLAUDE.md)
- [x] Workflow GitHub Actions (`.github/workflows/budgetly-ci.yml` à la racine du dépôt)
- [x] Configuration Vercel (`vercel.json`, cron)
- [x] Code poussé sur la branche de développement
- [ ] Création d'un dépôt dédié `budgetly` : non faite (accès limité au dépôt existant) — le projet vit dans `budgetly/`
- [ ] Déploiement : non effectué (nécessite comptes Vercel/Supabase et autorisation de publication)

## Problèmes rencontrés
- Pas d'accès Internet depuis l'environnement : catalogues non vérifiés en ligne (marqués « à vérifier »),
  adaptateur France Travail non testé contre l'API réelle.
- Chromium récent : `scrollIntoView` renvoie une promesse → un effet React qui la renvoyait plantait (corrigé, voir coach).
- PostgreSQL arrondit silencieusement un littéral numérique `1.5` vers `bigint` : la défense repose sur Zod
  (entiers obligatoires) et sur l'API (valeurs transmises en texte, rejetées). Test d'intégration ajouté.

## Prochaines tâches
Voir `docs/ROADMAP.md` § « Avant une mise en production ».

## Reprendre le travail
```bash
cd budgetly && npm ci
npm run db:test:start   # puis exporter TEST_DATABASE_URL affichée
npm test && npm run build && npm run test:e2e
npm run dev
```
