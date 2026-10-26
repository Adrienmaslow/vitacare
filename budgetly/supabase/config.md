# Configuration Supabase

Voir `docs/DEPLOYMENT.md`. Les migrations de `supabase/migrations/` s'appliquent dans l'ordre
(`supabase db push` avec la CLI, ou copie dans l'éditeur SQL). Ne jamais appliquer
`supabase/test-shim.sql` sur un projet Supabase réel : il ne sert qu'aux tests sur PostgreSQL nu.
