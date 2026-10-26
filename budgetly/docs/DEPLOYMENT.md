# Déploiement (Vercel + Supabase)

> Aucun déploiement public n'a été effectué : cette procédure est à suivre par le propriétaire du projet.

## 1. Supabase
1. Créer un projet (région **UE** recommandée, ex. Paris/Francfort) sur supabase.com.
2. Appliquer les migrations dans l'ordre :
   - CLI : `npx supabase link --project-ref <ref>` puis `npx supabase db push` (les fichiers sont dans `supabase/migrations`) ;
   - ou copier le contenu de chaque fichier dans l'éditeur SQL.
   **Ne pas** exécuter `supabase/test-shim.sql`.
3. Vérifier dans *Table editor* que la RLS est activée (icône bouclier) sur toutes les tables.
4. *Authentication → URL configuration* :
   - Site URL : `https://<votre-domaine>`
   - Redirect URLs : `https://<votre-domaine>/auth/callback`, `http://localhost:3000/auth/callback`
5. *Authentication → Providers* : e-mail activé avec confirmation ; mot de passe minimum 10 caractères.
   Google (facultatif) : renseigner client ID/secret Google, puis `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
6. *Authentication → Emails* : configurer un SMTP (Resend, Brevo…) pour la production — le SMTP intégré de
   Supabase est limité. Traduire les modèles d'e-mails en français.
7. Récupérer `Project URL`, clé `anon`/publishable et clé `service_role` (*Settings → API*).

## 2. Vercel
1. Importer le dépôt GitHub ; **Root Directory : `budgetly`** ; framework Next.js détecté.
2. Variables d'environnement (Production + Preview) :
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (chaîne aléatoire longue), et facultativement
   `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
   `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`.
3. Déployer. `vercel.json` déclare la tâche planifiée `/api/cron/alerts` (tous les jours à 6 h UTC) ;
   Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.
4. Domaine personnalisé : *Settings → Domains*, puis mettre à jour `NEXT_PUBLIC_SITE_URL` et les URL de redirection Supabase.

## 3. Vérifications après déploiement
- [ ] `/` et `/demo` fonctionnent.
- [ ] Inscription → e-mail reçu → lien → onboarding.
- [ ] Deux comptes de test ne voient pas leurs données respectives.
- [ ] `/api/cron/alerts` sans en-tête renvoie 401 ; l'exécution planifiée apparaît dans les logs Vercel.
- [ ] Suppression de compte depuis les paramètres.
- [ ] Lighthouse : PWA installable, accessibilité.

## 4. Surveillance minimale
- Logs Vercel (erreurs `[op:…]` sans données personnelles) et alertes d'échec des crons.
- Supabase : *Logs → Auth / Postgres*, alertes de quota.
- Facultatif : brancher un service de suivi d'erreurs (Sentry) en filtrant les données personnelles.

## 5. Connecteurs externes
Voir `docs/EXTERNAL_PROVIDERS.md`. Sans variables, chaque connecteur est simplement désactivé.

## Exécution locale avec Supabase (facultatif)
Avec Docker : `npx supabase init` puis `npx supabase start`, appliquer les migrations, et utiliser l'URL/clé
locales dans `.env.local`.
