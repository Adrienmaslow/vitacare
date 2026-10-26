# Tests

| Niveau | Outil | Fichiers | Nombre | Base |
|---|---|---|---|---|
| Unitaires (services) | Vitest | `tests/unit/*.test.ts` | 125 | LocalStore |
| Composants | Vitest + Testing Library (jsdom) | `tests/unit/components` | 4 | — |
| Intégration | Vitest + `pg` | `tests/integration/rls.test.ts` | 11 | PostgreSQL 16 réel + migrations + RLS |
| E2E | Playwright | `tests/e2e/*.spec.ts` | 16 (15 desktop + 1 mobile) | build de production, mode démo |

## Dernière exécution (26/10/2026, environnement de développement)
```
npm run lint        → 0 erreur (12 avertissements)
npm run typecheck   → OK
vitest run (avec TEST_DATABASE_URL) → Test Files 11 passed (11) · Tests 140 passed (140)
next build          → OK (37 routes)
playwright test     → 16 passed
```

## Couverture fonctionnelle
- **Montants** : conversion texte → centimes (formats FR/EN, ambiguïtés rejetées), arrondis, pas d'erreur 0,1 + 0,2.
- **Soldes** : comptable/attente/disponible/programmé, transferts neutres, comptes archivés, séries.
- **Tableau de bord** : reste à vivre sans double comptage d'un abonnement déjà payé.
- **Prévisions** : moyenne variable hors échéances, 3 scénarios, découvert, aucun revenu inventé, fiabilité.
- **Budgets** : consommation, seuils, transferts/attente exclus, répartition sans toucher aux essentiels.
- **Objectifs** : versement nécessaire, rythme, date estimée, stratégies A-D.
- **Abonnements, alertes (anti-spam), plan d'action (diversité, bienveillance, score), coach (11 intentions), simulateur, aides, bons plans, rentabilité, score d'opportunité, adaptateur France Travail.**
- **Import CSV** : encodages, séparateurs, débit/crédit, dates, lignes invalides, injections, doublons exacts/probables/internes.
- **Catégorisation** : priorités règle > historique > commerçant > mot-clé, ambiguïtés.
- **Opérations** : validation, erreurs structurées, transferts atomiques, idempotence des échéances, import/annulation, budgets uniques, objectifs, candidatures, démarches, export.
- **Intégration PostgreSQL** : trigger de profil, isolation Alice/Bob en lecture/écriture/suppression, rôle anonyme, catégories personnelles, contraintes, index uniques, parcours complet, suppression en cascade.
- **E2E** : landing, protection des routes privées, création de compte, ajout d'opération et mise à jour des indicateurs, import CSV + annulation, budget, prévisions, opportunités + sauvegarde, aides + suivi, objectif, plan d'action + résultat, coach, simulateur, navigation mobile, manifest/service worker, absence de défilement horizontal, API non authentifiée refusée, en-têtes de sécurité.

## Lancer les tests
```bash
npm test                              # unitaires (+ intégration si TEST_DATABASE_URL est défini)
npm run db:test:start                 # démarre un PostgreSQL local jetable (initdb), affiche l'URL
TEST_DATABASE_URL=postgresql://postgres@localhost:54329/budgetly_test npm run test:integration
npm run build && npm run test:e2e     # démarre `next start` sur le port 3100
```
En CI (`.github/workflows/budgetly-ci.yml`), un service PostgreSQL 16 est fourni et les trois niveaux s'exécutent.

## Non couvert automatiquement
- Parcours d'inscription réel (nécessite un projet Supabase et la réception d'e-mails).
- Appels réels à l'API France Travail et à l'API Anthropic (nécessitent des identifiants).
