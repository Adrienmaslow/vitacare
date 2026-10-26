# Sources externes et fiabilité

BUDGETLY n'invente **aucune** annonce, aide ou réduction. Toute donnée externe porte :
fournisseur, URL source, date d'ajout, date de vérification, statut (`verified` / `to_verify` / `expired`),
date d'expiration éventuelle et conditions (`src/data/sources.ts`).

## État de vérification au 26/10/2026 — important
L'environnement de développement n'avait **pas d'accès Internet** (politique réseau). Les catalogues ont
été rédigés à partir de connaissances générales sur des dispositifs publics et des services connus, **sans
vérification en ligne** :
- toutes les fiches ont `status: "to_verify"` et `verifiedAt: null` ; l'interface affiche « À vérifier sur la source » ;
- aucun montant ni prix n'est affiché ; les comparaisons utilisent les montants saisis par l'utilisateur ;
- les liens pointent vers les domaines officiels (caf.fr, etudiant.gouv.fr, service-public.fr, ameli.fr,
  actionlogement.fr, visale.fr, 1jeune1solution.gouv.fr…) ou les sites des enseignes.

### Revue des catalogues (à faire avant toute mise en production)
1. Pour chaque entrée de `src/data/aids.ts`, `deals.ts`, `job-platforms.ts` : ouvrir l'URL, confirmer le lien
   exact de la page, relire conditions et documents.
2. Compléter `verifiedAt` (date ISO) et passer `status` à `"verified"` ; ajouter `expiresAt` si l'offre est limitée.
3. N'ajouter un montant (`amountLabel`, `normalPriceMinor`) qu'avec sa date de barème dans le texte.
4. Ouvrir une pull request : la revue de code garde la trace de la vérification.
5. Planifier une revue trimestrielle (les barèmes d'aides changent souvent en janvier et à la rentrée).

## Offres d'emploi
Architecture : interface `OpportunityProvider` (`src/features/earn/types.ts`), un adaptateur par source,
agrégation et score dans l'opération `earn.search`. Un fournisseur indisponible est signalé sans bloquer les autres.

| Fournisseur | Fichier | Activation | État |
|---|---|---|---|
| Démonstration | `providers/demo.ts` | mode démo uniquement | Exemples **fictifs, étiquetés**, sans lien |
| France Travail — Offres d'emploi v2 | `providers/france-travail.ts` | `FRANCE_TRAVAIL_CLIENT_ID` + `FRANCE_TRAVAIL_CLIENT_SECRET` | Implémenté d'après la documentation publique (OAuth2 client credentials, scope `api_offresdemploiv2 o2dsoffre`), **non testé contre l'API réelle** |

Activer France Travail : créer un compte développeur sur francetravail.io, s'abonner à l'API « Offres d'emploi v2 »,
renseigner les deux variables côté serveur (jamais `NEXT_PUBLIC_`). Le filtre de localisation accepte un
numéro de département. Aucune extraction (scraping) de plateformes n'est réalisée.
Sans fournisseur actif, la page affiche des **liens d'orientation** vers des plateformes, jamais de fausses offres.

## Aides
Le moteur `src/features/aids/eligibility.ts` évalue des règles simplifiées et produit uniquement
« potentiellement éligible », « informations insuffisantes » ou « probablement non éligible selon les critères
connus ». Les aides potentielles ne sont jamais ajoutées au solde ni aux prévisions ; seuls les montants
effectivement reçus, saisis par l'utilisateur, sont comptabilisés comme réalisations.

## Coach IA (facultatif)
`src/server/coach-ai.ts` — SDK Anthropic, modèle `ANTHROPIC_MODEL` (défaut `claude-opus-5-5`), effort faible,
repli serveur activé en cas de refus. Activé seulement si `ANTHROPIC_API_KEY` est définie **et** si
l'utilisateur a donné le consentement `ai_coach`. Données transmises : la question et la réponse déjà
calculée (faits, hypothèses). L'historique des transactions n'est jamais envoyé. Le prompt interdit
d'inventer des chiffres, de conseiller des investissements réglementés ou de pousser à l'endettement.

## Banque
`src/features/banking/provider.ts` définit l'interface d'un futur agrégateur agréé ; le fournisseur par défaut
est désactivé. Aucune synchronisation n'est simulée.

## Désactivation propre
Chaque adaptateur expose `isEnabled()`. Une source en erreur renvoie un message « indisponible » dans
`earn.search.errors` ; la page continue de fonctionner.
