# Calculs financiers

Tous les calculs sont **déterministes**, en **centimes entiers**, implémentés dans des fonctions pures testées.
Aucun chiffre n'est produit par une IA.

## Conventions
- `signedAmount(t)` = `+montant` pour `income` / `transfer_in`, `−montant` pour `expense` / `transfer_out`.
- Division : `mulDiv(a, n, d)` en `BigInt`, arrondi **à la demi-unité éloignée de zéro**.
- Les opérations `pending` sont exclues du solde comptable ; les opérations datées dans le futur sont « programmées ».
- Les **transferts** modifient les soldes des comptes mais ne sont **jamais** des revenus ou des dépenses.

## Indicateurs du tableau de bord (`src/features/finance/dashboard.ts`)
| Indicateur | Formule |
|---|---|
| Solde comptable d'un compte | solde initial + Σ signé des opérations `booked` datées ≤ aujourd'hui |
| Solde total | Σ soldes comptables des comptes non archivés (épargne comprise) |
| Solde disponible | Σ (comptable + en attente) des comptes **hors épargne** |
| Argent en attente | Σ signé des opérations `pending` |
| Épargne disponible | Σ soldes des comptes de type épargne |
| Revenus / dépenses du mois | Σ `income` / `expense` `booked` du 1er du mois à aujourd'hui |
| Épargne du mois | variation nette des comptes d'épargne depuis le 1er (virements compris) |
| Charges fixes restantes | échéances récurrentes de dépense + abonnements actifs, de demain à la fin du mois, **non déjà enregistrés** |
| Reste à vivre | solde disponible + revenus récurrents attendus d'ici fin de mois − charges fixes restantes |
| Prévision fin de mois | scénario réaliste (ci-dessous) au dernier jour du mois |

### Anti double comptage des échéances
Une occurrence prévue (récurrence ou abonnement) est ignorée si une opération liée
(`recurring_id` / `subscription_id`) existe à ± 3 jours. Les opérations saisies ou importées dont le
libellé correspond à un abonnement y sont rattachées automatiquement.

## Prévisions (`src/features/forecasts/engine.ts`)
```
solde(J0) = solde disponible actuel (hors épargne)
solde(j)  = solde(j−1) + revenus récurrents(j) − charges prévues(j) − dépense variable quotidienne × facteur
```
- Dépense variable quotidienne = Σ dépenses `booked` non liées à une échéance, sur les comptes hors épargne,
  pendant les 90 derniers jours (ou depuis la première opération) ÷ nombre de jours observés.
- Facteurs : optimiste 85 %, réaliste 100 %, pessimiste 120 %.
- **Jamais comptés** : missions disponibles, aides potentielles, revenus ponctuels passés.
- Sorties : solde par jour et par scénario, minimum, date de passage sous le seuil de sécurité, date de
  découvert, charges importantes (≥ 20 % des revenus déclarés ou ≥ 100 €), hypothèses.
- Fiabilité : points attribués pour ≥ 60 jours d'historique (+2) ou ≥ 14 (+1), ≥ 30 opérations (+1),
  échéances déclarées (+1) → bonne (≥ 4), moyenne (≥ 2), faible.

## Budgets (`src/features/budgets/service.ts`)
- Consommé = Σ dépenses `booked` du mois dans la catégorie (toutes catégories pour le budget global).
- % = consommé / prévu ; niveaux : < 70 ok, ≥ 70 attention, ≥ 85 presque atteint, > 100 dépassé.
- Rythme attendu à date = prévu × jours écoulés / jours du mois.
- Répartition suggérée : moyenne des 3 derniers mois complets arrondie à 5 € ; si le total dépasse
  revenus − 10 % d'épargne, **seules les catégories non essentielles** sont réduites proportionnellement.

## Objectifs (`src/features/goals/service.ts`)
- Manquant = cible − Σ affectations ; mois restants = mois entiers jusqu'à la date (min 1).
- Versement nécessaire = ⌈manquant / mois restants⌉ arrondi à l'euro supérieur.
- Rythme observé = Σ versements des 3 derniers mois ÷ 3 ; date estimée = aujourd'hui + ⌈manquant / rythme⌉ mois.
- Stratégies : A capacité d'épargne (revenus − dépenses moyens), B −15 % des dépenses non essentielles,
  C heures disponibles × taux horaire (avant cotisations, non garanti), D combinaison.

## Abonnements
Équivalent mensuel = montant × occurrences/an ÷ 12 ; coût annuel = montant × occurrences/an
(hebdo 52, mensuel 12, trimestriel 4, annuel 1).

## Analyses (`src/features/analytics/service.ts`)
Calculées sur les **mois complets** (le mois en cours est partiel) : taux d'épargne, part des charges fixes,
dépense quotidienne moyenne (× 12 ÷ 365), capacité d'épargne, marge de sécurité (jours couverts),
comparaisons M-1, moyenne 3 et 6 mois, N-1 (si 12 mois disponibles). Avertissement si < 3 mois.

## Simulateur
Variation nette mensuelle = Δrevenus + heures × taux − Δloyer − Δdépenses − Δabonnements − épargne programmée,
répartie quotidiennement (× 12 / 365) sur la prévision réaliste ; charge exceptionnelle à sa date.

## Rentabilité d'une mission (`src/features/earn/service.ts`)
Brut = forfait ou taux × heures ; cotisations **uniquement si l'utilisateur saisit un taux** ;
net estimé = brut − cotisations − frais ; gain horaire réel = net ÷ (heures de travail + trajet).

## Plan d'action (`src/features/action-plan/engine.ts`)
Score /100 = urgence (30) + impact (25, relatif à 10 % des revenus) + faisabilité selon le temps (15)
+ confiance (15) + pertinence (10) + préférences (5 si objectif déclaré, 0 si type déjà écarté).
Sélection : la meilleure action de chaque type, puis au plus une seconde par type, 5 maximum.
Règles de bienveillance : pas d'objectif d'épargne proposé pendant un risque de découvert ; jamais de
réduction des dépenses essentielles ; un revenu complémentaire n'est jamais intégré aux prévisions.
