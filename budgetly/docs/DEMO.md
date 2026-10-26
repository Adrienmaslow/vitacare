# Mode démonstration & guide de soutenance

## Le mode démonstration
- Accès : bouton « Essayer la démonstration » ou `/demo`.
- Personnage fictif : **Léa, 21 ans**, étudiante salariée à Lyon, en location seule.
- Données générées dans le navigateur (graine fixe, relatives à la date du jour) : 3 comptes (courant, Livret A,
  espèces), 6 mois d'historique (≥ 100 opérations), revenus 1 200 €/mois (job 600 €, soutien familial 400 €,
  APL 200 €), loyer 450 €, courses ≈ 220 €, transport 75 €, abonnements ≈ 35 €, loisirs ≈ 130 €, budgets sur
  3 mois, 3 objectifs, 5 abonnements, 2 démarches d'aide, 2 candidatures **d'exemple**, un scénario sauvegardé.
- **Calibrage** : le solde initial du compte courant est calculé pour que la prévision réaliste de fin de mois
  affiche un manque d'environ **80 €** (dépenses exceptionnelles du mois : réparation d'ordinateur, billets de train).
- Cohérence : les soldes ne sont jamais saisis, ils sont calculés ; toute modification met à jour graphiques et calculs.
- Isolation : données uniquement dans le `localStorage` du visiteur, régénérées chaque jour ; bouton « Réinitialiser ».
- Les opportunités affichées sont des exemples fictifs explicitement étiquetés ; aucun lien de candidature.

## Scénario de soutenance (7 à 9 minutes)
| Temps | Écran | Ce qu'on montre | Message clé |
|---|---|---|---|
| 0:00 | Landing `/` | Problème, 5 piliers, aperçu interactif | « Un copilote, pas un simple tableur » |
| 0:45 | Inscription `/signup` puis `/demo` | Formulaire réel (Supabase), puis entrée en démo | Authentification réelle ; démo isolée |
| 1:15 | Onboarding `/app/onboarding` (ouvrir l'URL) | 7 étapes facultatives : ressources, dépenses | Minimisation des données |
| 2:00 | Import `/app/import` | Relevé d'exemple → colonnes détectées → doublon interne → catégories → import | Fichier jamais stocké ; import annulable |
| 3:00 | Tableau de bord `/app` | Bandeau « risque de fin de mois », 10 indicateurs avec définitions (ℹ︎), donut cliquable | Formules explicites |
| 3:45 | Prévisions `/app/forecast` | Trajectoire réel/pointillés, zone d'incertitude, date de découvert, hypothèses, fiabilité | Aucun revenu inventé |
| 4:30 | Plan d'action `/app/action-plan` | Action n°1 « limiter à 4,60 €/jour », « Pourquoi cette action ? » (score détaillé) | Moteur déterministe et explicable |
| 5:15 | Aides `/app/aids` | Statuts prudents, conditions, source « à vérifier », suivi de démarche | Jamais ajoutée au solde |
| 5:45 | Gagner `/app/earn` | Exemple étiqueté, score de compatibilité, onglet Rentabilité | Gain réel après frais, non garanti |
| 6:30 | Économiser `/app/deals` | Comparateur : forfait 16,99 € → 9,99 € avec frais de SIM | Économie calculée, pas promise |
| 7:00 | Plan d'action | Marquer une action « terminée » avec résultat réel → onglet Résultats | Réalisations ≠ projections |
| 7:30 | Simulateur `/app/simulator` | « 8 h de plus / mois » → risque supprimé, effet sur les objectifs | Scénario fictif, application explicite |
| 8:15 | Coach `/app/coach` | « Est-ce que je peux acheter un ordinateur à 700 € ? » | Faits vs estimations |
| 8:45 | Mobile / PWA | Navigation basse, installation | Mobile d'abord |

### Questions probables du jury
- *Comment évitez-vous les erreurs de calcul ?* Centimes entiers, `BigInt` pour les divisions, 140 tests dont 11 sur PostgreSQL.
- *Et la sécurité ?* RLS forcée + clés étrangères composites testées avec deux utilisateurs ; voir `docs/SECURITY.md`.
- *Les aides sont-elles fiables ?* Liens officiels, statut « à vérifier » tant qu'un humain n'a pas validé la fiche ; estimation à 3 états.
- *Pourquoi pas d'IA partout ?* Les décisions et chiffres doivent être vérifiables ; l'IA ne fait que reformuler, avec consentement.

## Schémas utiles
- Architecture : `docs/ARCHITECTURE.md`
- Base de données : `docs/DATABASE.md`
- Moteur de recommandations : `docs/FINANCIAL_CALCULATIONS.md` § Plan d'action
