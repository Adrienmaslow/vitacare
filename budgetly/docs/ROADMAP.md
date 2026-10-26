# Roadmap

## Livré (MVP + modules avancés)
Voir le tableau du README : authentification, onboarding, multicomptes, transactions, import CSV, tableau de
bord, budgets, prévisions, alertes, abonnements, objectifs, plan d'action, coach (niveau 1 + adaptateur IA),
simulateur, gagner, aides, bons plans, vie quotidienne, analyses, gamification, démo, PWA, tests, CI.

## Avant une mise en production
1. **Revue humaine des catalogues** (aides, bons plans, plateformes) et passage au statut `verified` — prioritaire.
2. Provisionner Supabase (UE), SMTP, domaine ; tester le parcours d'inscription réel.
3. Obtenir l'accès France Travail et valider l'adaptateur contre l'API réelle (tests de contrat).
4. Compléter mentions légales / politique de confidentialité avec un juriste ; registre des traitements.
5. CSP stricte avec nonces ; limitation de débit partagée (Redis) ; purge planifiée du journal d'audit.

## Évolutions
- Notifications push (Web Push + VAPID) et e-mail transactionnel, avec confirmation de livraison du fournisseur.
- Connexion bancaire via agrégateur agréé (interface `BankingProvider` prête), réconciliation par empreinte.
- Vues SQL / fonctions pour les agrégats si les volumes dépassent quelques milliers d'opérations par utilisateur.
- Formulaires d'édition remontés par clé (supprimer les avertissements `set-state-in-effect`).
- Règles d'éligibilité enrichies par région (aides régionales/municipales) via des sources open data.
- Application mobile Expo réutilisant `src/features`, `src/lib`, `src/data` et l'API `/api/ops`.
- Multi-devises (le schéma porte déjà `currency`).
- Tableaux de bord partagés (colocation) avec partage explicite.
