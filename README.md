# ECE STUDY — De l’atome à la puce

Plateforme de révision guidée pour le cours **« De l’atome à la puce » (ECE Paris, ING2, semestre 3)**.
Version 1 : **cours 0, 1, 2** et **TD1, TD2**.

- Parcours guidé : leçons courtes, vérifications, test de validation pour sauter une notion connue.
- Les **vrais exercices du TD1 et du TD2** (15 exercices, 58 questions), question par question, avec
  le bouton **« Je suis bloqué »** (3 indices progressifs), une correction détaillée et un bilan.
- Correction automatique fiable : virgules, notation scientifique, préfixes et unités équivalentes
  (`0,26 Ω` = `260 mΩ`), contrôle des dimensions.
- QCM (leçon, chapitre, méthodes de TD, erreurs, session rapide de 5 min), **examen blanc** chronométré noté sur 20.
- Flashcards à **répétition espacée**, formulaire, fiches imprimables, suivi des erreurs, statistiques.
- **Maîtrise estimée** par notion, distincte de la progression du parcours.
- Fonctionne **hors connexion** et s’installe comme une application (PWA) sur ordinateur et téléphone.

> Site publié (une fois le déploiement activé, voir plus bas) : **https://adrienmaslow.github.io/vitacare/**

---

## 1. Utiliser l’application

### Installer sur ordinateur (Windows, macOS, Linux)

1. Ouvre le site dans **Chrome** ou **Edge**.
2. Clique sur l’icône d’installation dans la barre d’adresse (ou menu ⋮ → « Installer ECE STUDY »).
3. Sur Mac avec Safari 17 ou plus récent : menu **Fichier → Ajouter au Dock**.

### Installer sur Android

Ouvre le site dans **Chrome** → menu ⋮ → **« Installer l’application »** (ou « Ajouter à l’écran d’accueil »).

### Installer sur iPhone / iPad

Ouvre le site dans **Safari** → bouton **Partager** → **« Sur l’écran d’accueil »**.
(iOS ne propose pas de bouton d’installation automatique : c’est une limite d’Apple.)

### Sauvegarder sa progression

- La progression est enregistrée **dans le navigateur de l’appareil** (aucun compte, aucun serveur).
- **Elle n’est pas synchronisée** entre l’ordinateur et le téléphone. Pour transférer :
  **Paramètres → Exporter (JSON)** sur un appareil, puis **Importer une sauvegarde** sur l’autre
  (l’import remplace les données de l’appareil).
- Effacer les « données du site » dans le navigateur efface aussi la progression : exporte régulièrement.

### Consulter tes PDF de cours

Les PDF originaux ne sont **pas** publiés avec le site (dépôt public). Dans **Ressources → Mes documents**,
importe tes propres fichiers : ils restent dans ton navigateur et s’ouvrent à la bonne page depuis les exercices.

---

## 2. Installer le projet sur un ordinateur (développement)

Prérequis : **Node.js 22 LTS** (voir `.nvmrc`) et Git.

```bash
git clone https://github.com/Adrienmaslow/vitacare.git
cd vitacare
npm install          # installe les dépendances
npm run dev          # lance le site en local : http://localhost:5173
```

| Commande                                                | Rôle                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                                           | Serveur de développement                                       |
| `npm run build`                                         | Build de production dans `dist/` (chemin de base `/vitacare/`) |
| `npm run preview`                                       | Sert le build : http://localhost:4173/vitacare/                |
| `npm test`                                              | Tests unitaires + intégrité du contenu                         |
| `npm run test:e2e`                                      | Tests de bout en bout (Playwright, ordinateur + mobile)        |
| `npm run lint` / `npm run typecheck` / `npm run format` | Qualité du code                                                |
| `npm run icons`                                         | Régénère les icônes PWA                                        |

## 3. Publier sur GitHub Pages

Résumé (détails dans [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)) :

1. Sur GitHub : **Settings → Pages → Source : « GitHub Actions »** (une seule fois).
2. Fusionner le code dans la branche `main` : le workflow **« Déploiement GitHub Pages »** construit et publie.
3. Le site est disponible à `https://adrienmaslow.github.io/vitacare/`.

**Mettre le site à jour** : pousser (ou fusionner) sur `main`. Les utilisateurs voient un bandeau
« Une nouvelle version est disponible » et choisissent quand recharger.

## 4. Ajouter du contenu

Tout le contenu est en TypeScript typé dans `src/content/` ; `npm test` vérifie son intégrité
(identifiants uniques, références valides, unités reconnues, bonne réponse acceptée par le moteur).

- **Nouveau cours** : ajouter le chapitre et ses notions dans `src/content/course/index.ts`,
  puis un fichier de leçons `src/content/lessons/cX.ts` (blocs : texte, formule, encadré, exemple,
  visualisation, question de vérification) et l’importer dans `src/content/index.ts`.
- **Nouvel exercice** : dans `src/content/exercises/tdX.ts`, avec la fonction `part()` :
  énoncé, données, 3 indices, étapes de correction, origine de la correction (`livret` ou `ece-study`),
  et une question (`num()`, `mcq()`, `selfcheck()`…).
- **Nouveau QCM** : dans `src/content/quizzes/cX.ts`, avec `mcq()`, `tf()`, `num()`, `match()`, `order()`.
  Chaque choix porte sa justification (`[texte, pourquoi]`).
- **Nouvelle formule** : `src/content/formulas/index.ts` (sens, variables, unités, conditions, pièges, source).

Voir aussi : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/CONTENT_AUDIT.md`](docs/CONTENT_AUDIT.md),
[`docs/TESTING.md`](docs/TESTING.md), [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Droits et confidentialité

- Les supports de cours appartiennent à leurs auteurs (Département d’électronique, ECE). Le dépôt ne
  contient **aucun PDF** (`*.pdf` est ignoré par Git) : les énoncés sont reformulés fidèlement,
  avec toutes leurs données et une référence de page.
- Aucune donnée personnelle n’est envoyée : tout reste sur l’appareil.
