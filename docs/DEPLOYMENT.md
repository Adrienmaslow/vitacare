# Déploiement

## GitHub Pages (recommandé)

1. **Activer Pages** (une seule fois) : dépôt GitHub → **Settings → Pages → Build and deployment →
   Source : « GitHub Actions »**.
2. **Publier** : fusionner la branche de travail dans `main` (ou lancer manuellement le workflow
   _Déploiement GitHub Pages_ depuis l’onglet **Actions → Run workflow**).
3. Le workflow `.github/workflows/deploy.yml` : `npm ci` → `npm test` → `npm run build` avec
   `BASE_PATH=/<nom-du-dépôt>/` → publication de `dist/`.
4. Adresse : **https://adrienmaslow.github.io/vitacare/**

### Chemin de base et routes internes

- Les assets sont générés avec le préfixe `/vitacare/` (variable `BASE_PATH`, par défaut `/vitacare/` au build).
  Si le dépôt est renommé, le workflow suit automatiquement le nouveau nom.
- Domaine personnalisé : construire avec `BASE_PATH=/`.
- Les routes utilisent un **hash** (`/vitacare/#/exercices/td1-ex1-2`) : un rafraîchissement ne provoque
  jamais d’erreur 404. `404.html` est en plus une copie de `index.html`.

### Mises à jour

Chaque déploiement produit des fichiers versionnés et un nouveau service worker. Les utilisateurs voient
« Une nouvelle version d’ECE STUDY est disponible » et choisissent **Mettre à jour** ; les anciennes ressources
sont alors nettoyées (`cleanupOutdatedCaches`). Les données (IndexedDB) ne sont pas touchées.

## Vérifier avant publication

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run build
npm run preview        # http://localhost:4173/vitacare/
npm run test:e2e
```

Le job CI vérifie aussi que `dist/` contient le manifeste, le service worker, les icônes et **aucun PDF**.

## Autres hébergeurs statiques

Netlify, Vercel, Cloudflare Pages : commande `npm run build`, dossier `dist`, variable `BASE_PATH=/`.

## Données et confidentialité

Aucun secret n’est nécessaire. Ne jamais ajouter de clé d’API dans le frontend : une future fonction d’IA
devra passer par un backend (voir `ARCHITECTURE.md`).
