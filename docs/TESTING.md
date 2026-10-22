# Tests

## Commandes

```bash
npm test            # Vitest : moteurs, données, composants, intégrité du contenu
npm run test:e2e    # Playwright : 11 scénarios × 2 profils (ordinateur 1280 px, mobile Pixel 7)
npm run typecheck && npm run lint && npm run format:check
```

En environnement sans téléchargement de navigateur, `PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.
Les tests E2E construisent le site et le servent sous `/vitacare/` (même chemin qu’en production).

## Couverture

| Domaine                                                | Fichier                               | Contenu                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Validation numérique, décimales, notation scientifique | `tests/unit/units.test.ts`            | 14 formats de saisie, virgule/point, `·10^`, exposants Unicode                                                                         |
| Conversion d’unités et dimensions                      | `tests/unit/units.test.ts`            | préfixes, `mm²`, `cm⁻³`, `µΩ·cm`, `cm²/Vs`, S/m = Ω⁻¹m⁻¹, 0,26 Ω = 260 mΩ                                                              |
| Diagnostic d’erreur                                    | `tests/unit/units.test.ts`            | unité manquante, non homogène, facteur 10^k, signe, aucune cause inventée                                                              |
| Calcul de la maîtrise et indices                       | `tests/unit/engines.test.ts`          | lecture ≠ maîtrise, 3 indices < autonome, 2e essai, ancienneté, échecs récents                                                         |
| Répétition espacée                                     | `tests/unit/engines.test.ts`          | intervalles, Facile/Difficile, À revoir, déterminisme                                                                                  |
| QCM, correspondances, classement, autocorrection       | `tests/unit/engines.test.ts`          | évaluation de chaque type, scores partiels                                                                                             |
| Enregistrement d’une réponse, erreurs                  | `tests/unit/data.test.ts`             | tentative, erreur, catégorie, correction ultérieure                                                                                    |
| Progression, déblocage, mode essentiel                 | `tests/unit/data.test.ts`             | statuts de leçons, parcours vs maîtrise                                                                                                |
| Recommandations                                        | `tests/unit/data.test.ts`             | diagnostic, mini-QCM unités, prérequis                                                                                                 |
| Import / export                                        | `tests/unit/data.test.ts`             | aller-retour, PDF exclus, rejets explicites, import invalide sans effet                                                                |
| Persistance (IndexedDB)                                | `tests/unit/data.test.ts`             | via fake-indexeddb                                                                                                                     |
| Composants                                             | `tests/unit/ui.test.tsx`              | réponse cachée avant validation, réessai, enregistrement                                                                               |
| Chronomètre                                            | `tests/unit/ui.test.tsx` + E2E examen | arrêt automatique et bilan                                                                                                             |
| Intégrité du contenu                                   | `tests/content/integrity.test.ts`     | identifiants, références, unités, inventaire TD conforme au livret, générateurs                                                        |
| Parcours principaux (E2E)                              | `tests/e2e/main-flows.spec.ts`        | 1 premier lancement · 2 chapitre · 3 leçon · 4 QCM · 5 exercice · 6 indice · 7 correction · 8 sauvegarde · 9 rechargement · 10 reprise |
| Responsive, PWA, thème, 404 (E2E)                      | `tests/e2e/main-flows.spec.ts`        | pas de débordement horizontal, manifeste, service worker actif, thème persistant, export                                               |

## Derniers résultats (exécutés le 22/10/2026)

- `npm test` : **5 fichiers, 82 tests réussis**.
- `npm run test:e2e` : **22 tests réussis** (11 scénarios × ordinateur + mobile).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` : sans erreur.

## Non couvert automatiquement

- Installation réelle de la PWA sur iOS/Android/Windows (vérifiable uniquement sur appareil).
- Contrôle visuel complet de toutes les pages en mode sombre (captures manuelles faites pour le tableau de bord,
  les leçons, les exercices et les QCM).
- Audit d’accessibilité automatisé (axe) : non intégré dans cette version.
