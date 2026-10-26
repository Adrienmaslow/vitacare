# Sécurité et confidentialité

## Modèle de menace couvert
| Risque | Mesure | Vérification |
|---|---|---|
| Lecture des données d'un autre utilisateur | RLS forcée + filtre `user_id` applicatif + FK composites | `tests/integration/rls.test.ts` |
| Écriture pour le compte d'autrui | politiques `WITH CHECK`, `user_id` imposé par le store | idem |
| Rattachement à une ressource d'autrui | FK `(id, user_id)`, contrainte `category_is_usable` | idem |
| Accès anonyme | rôle `anon` sans droits ; `/api/ops` exige `getUser()` valide | E2E `a11y-security.spec.ts` |
| Données invalides / injection | schémas Zod stricts, requêtes paramétrées, identifiants SQL validés (PgStore) | tests `ops.test.ts` |
| Injection CSV (formules) | neutralisation à l'import et à l'export (`sanitizeCell`, `toCsv`) | tests CSV |
| Fichiers malveillants | taille ≤ 2 Mo, ≤ 5000 lignes, détection binaire/HTML, parsing côté client, fichier jamais stocké | tests CSV |
| Abus / force brute | limitation de débit par utilisateur (120/min, 10/min pour les opérations sensibles), limites Supabase Auth | — |
| CSRF | vérification de l'en-tête `Origin` sur les routes mutantes, cookies `SameSite` | — |
| Open redirect | `next` limité aux chemins internes dans `/auth/callback` et `/login` | — |
| Fuite d'informations | erreurs normalisées (`AppError`), messages génériques pour les erreurs internes, journal sans données personnelles | — |
| Secrets | aucune clé côté client ; `server-only` sur les modules sensibles ; `.env*` ignorés par Git | revue |
| Cache partagé | `Cache-Control: private, no-store` sur `/api/*` ; service worker sans données | E2E PWA |
| Clickjacking & co. | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | E2E |

## Authentification
Supabase Auth (e-mail + mot de passe, vérification d'e-mail, réinitialisation, OAuth Google optionnel).
Le proxy (`src/proxy.ts`) rafraîchit la session et protège `/app/*` côté serveur ; chaque appel d'API
revalide l'utilisateur avec `auth.getUser()` (validation du JWT auprès de Supabase, pas seulement du cookie).
Mots de passe : 10 caractères minimum, lettres et chiffres (à renforcer aussi dans les paramètres Supabase).
La réinitialisation ne révèle pas si un e-mail existe.

## Mode démonstration
Les données fictives vivent uniquement dans le `localStorage` du visiteur. Le cookie de démo donne accès aux
pages `/app`, mais **jamais** à `/api/ops` (qui exige une session) : aucune donnée réelle n'est exposée.

## Journalisation
`audit_events` : consentements, imports, exports, usage IA — sans montant ni libellé. Les erreurs serveur
inattendues sont journalisées avec le nom de l'opération et le message, sans données d'entrée.

## RGPD (protection dès la conception)
- Minimisation : profil entièrement facultatif ; fichiers CSV non stockés ; aucune ligne brute d'import conservée.
- Consentements spécifiques et révocables (`user_consents`) : éligibilité aux aides, opportunités, IA, e-mails.
- Export complet (JSON) et suppression définitive (cascade) depuis les paramètres.
- Politique de confidentialité et mentions légales fournies **à compléter** : leur présence ne garantit pas la
  conformité ; une analyse juridique (registre des traitements, DPA avec les sous-traitants, hébergement UE) reste nécessaire.

## Limites connues
- Limitation de débit en mémoire : par instance serverless. En production à forte charge, utiliser un stockage
  partagé (Redis) ou les règles du pare-feu Vercel.
- Pas de politique de sécurité du contenu (CSP) stricte : à ajouter avec des nonces une fois les domaines finaux connus.
- La purge du journal d'audit (12 mois recommandés) doit être planifiée (tâche SQL ou cron).
