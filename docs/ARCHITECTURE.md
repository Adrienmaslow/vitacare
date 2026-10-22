# Architecture

## Pile technique

| Besoin      | Choix                                                            | Pourquoi                                                   |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| UI          | React 19 + TypeScript strict (`noUncheckedIndexedAccess`)        | typage fort du contenu pédagogique                         |
| Build       | Vite 8                                                           | rapide, découpage automatique du code                      |
| Style       | Tailwind CSS 4 + jetons CSS (`src/styles/index.css`)             | thème clair/sombre par variables                           |
| Composants  | composants accessibles maison (`src/components/ui`)              | évite une dépendance lourde ; `<dialog>` natif, rôles ARIA |
| Icônes      | lucide-react                                                     | légères, arborescentes                                     |
| Routage     | React Router 7, **HashRouter**                                   | aucune erreur 404 au rafraîchissement sur GitHub Pages     |
| Formules    | KaTeX                                                            | rendu rapide, hors ligne                                   |
| Graphiques  | Recharts (chargé seulement sur la page Statistiques)             |                                                            |
| État global | Zustand (préférences, UI) + contexte React (données apprenant)   |                                                            |
| Données     | Dexie / IndexedDB + `dexie-react-hooks`                          | requêtes réactives, migrations                             |
| PWA         | vite-plugin-pwa (Workbox, `generateSW`, mise à jour sur demande) |                                                            |
| Tests       | Vitest, Testing Library, fake-indexeddb, Playwright              |                                                            |

## Arborescence

```
src/
  app/                  App, routes (pages chargées à la demande)
  components/
    ui/                 Button, Card, Badge, Dialog, Switch/Segmented, Progress/Ring, Math (KaTeX + mise en forme)
    layout/             AppShell (barre latérale / barre inférieure), Logo, Toasts
    dashboard/          ChapterCard, ActivityCalendar
    lessons/            LessonBlocks, FormulaCard, badges de statut
    quizzes/            QuestionInput (tous types), QuestionCard (correction immédiate), QuizSession
    visuals/            visualisations interactives (dérive, bandes, dopage, jonction PN, explorateurs)
    charts/             graphiques Recharts
    explain/            panneau « Explique-moi »
    pwa/                enregistrement du service worker, installation, bandeau de mise à jour
  pages/                une page par route
  features/
    progress/           derive.ts (calculs dérivés purs), AchievementWatcher
    assessment/         sélection des questions (modes QCM, examen), notation /20
  content/              CONTENU SCIENTIFIQUE (données pures, aucune UI)
    course/ lessons/ exercises/ quizzes/ formulas/ flashcards/ glossary/ explain/
  engines/              MOTEURS PÉDAGOGIQUES (fonctions pures, testées)
    units/              analyse des nombres et unités, comparaison dimensionnelle
    assessment-engine/  évaluation de chaque type de question
    mastery-engine/     score de maîtrise
    spaced-repetition/  répétition espacée
    recommendation-engine/
    generators/         exercices d'entraînement générés
    achievements/       badges
  db/                   schéma IndexedDB, accès aux données, export/import
  hooks/ stores/ lib/ types/ styles/
tests/ unit/ content/ e2e/
```

Séparation stricte : **contenu** (`content/`) ↔ **moteurs** (`engines/`, purs et testés) ↔ **interface** (`components/`, `pages/`).

## Modèles de données (`src/types/index.ts`)

Contenu : `Course`, `Chapter`, `Lesson` (blocs typés), `Concept`, `Formula`, `Exercise`, `ExercisePart`,
`Question` (union : mcq/formula, truefalse, numeric, matching, ordering, selfcheck), `Answer`/`NumericAnswer`,
`Hint`, `CorrectionStep`, `Flashcard`, `SourceReference`.
Utilisateur : `QuizAttempt`, `Mistake`, `UserProgress`, `ExerciseProgress`, `MasteryScore`,
`RevisionSchedule`, `LearningSession`, `ExamResult`, `Achievement`.

## Moteur de correction numérique

`engines/units/` :

1. Lecture du nombre : virgule ou point, séparateurs de milliers, `1,6e-19`, `1,6·10^-19`, `1,6 × 10⁻¹⁹`, `10^20`.
2. Lecture de l’unité : préfixes SI (p…G, µ/u), puissances (`m^2`, `m²`, `cm-3`), quotients et
   parenthèses (`cm²/(V·s)`), unités collées (`Vs`, `Ωcm`), alias (`ohm`), mots de comptage (`électrons/s`).
3. Conversion SI + **vérification dimensionnelle** (m, kg, s, A, K, mol).
4. Tolérance relative (2 % par défaut, réglable par question).
5. Diagnostic prudent : unité manquante, unité non homogène, facteur 10^k (conversion), signe. Sinon,
   **aucune cause n’est inventée** (catégorie « non déterminée »).

Les démonstrations libres (questions `selfcheck`) utilisent une **autocorrection guidée** : réponse modèle
révélée à la demande + critères explicites cochés par l’étudiant.

## Score de maîtrise (transparent)

`engines/mastery-engine/mastery.ts`

```
maîtrise = Σ(poids × crédit) / (Σ poids + 2)
crédit   = score × facteurIndices × facteurTentative
           facteurIndices = 1 ; 0,75 ; 0,5 ; 0,3  (0, 1, 2, 3 indices ou correction lue)
           facteurTentative = 0,7 à partir du 2e essai
poids    = contexte × difficulté × récence
           contexte : leçon/rapide 0,8 · chapitre/TD/erreurs/diagnostic 1 · généré 1,1 · exercice/examen 1,2
           difficulté : 0,8 / 1 / 1,25 ; récence : demi-vie 21 jours (plancher 0,25)
```

Le « + 2 » (a priori) empêche qu’une seule bonne réponse donne 100 %.
Statuts : **Non étudiée** (aucune donnée) · **En apprentissage** (< 40 %, ou leçon lue sans réponse) ·
**À consolider** (< 75 % ou moins de 4 réponses) · **Maîtrisée** · **À revoir** (≥ 40 % mais deux derniers échecs,
ou rien depuis 21 jours).
**Progression du parcours** (leçons terminées), **maîtrise** et **activité** (temps, réponses) sont trois mesures distinctes.

## Répétition espacée

`engines/spaced-repetition/srs.ts` — variante déterministe de SM-2 :
« À revoir » → retour le jour même, répétitions à 0, facilité −0,2 ; réussite → 1 j, puis 6 j
(Difficile 3 j, Facile 4 j puis 8 j), puis intervalle × facilité (× 0,8 Difficile, × 1,3 Facile).
Facilité ≥ 1,3. Pas de hasard. Consulter une carte n’alimente **pas** la maîtrise.

## Recommandations (règles explicites, pas d’IA)

`engines/recommendation-engine/recommend.ts`, par priorité : diagnostic (premier lancement) →
cartes dues → ≥ 3 erreurs d’unités en 7 jours (mini-QCM) → notion avec ≥ 2 erreurs récentes →
notions « à revoir » → prérequis non ouvert ou faible de la prochaine leçon → leçon suivante →
chapitre maîtrisé à ≥ 60 % (passer au suivant) → TD à commencer. Chaque recommandation affiche sa raison.
Le plan du jour garde l’ordre et s’arrête au temps restant de l’objectif quotidien.

## Temps de travail

Comptage réel (`hooks/useActivityTracker.ts`) : tranches de 30 s uniquement si la page est visible
et qu’il y a eu une interaction depuis moins de 2 minutes. Sessions regroupées si moins de 5 min d’écart.

## Persistance et migrations

- IndexedDB `ece-study` (Dexie) : `attempts`, `mistakes`, `lessonProgress`, `exerciseProgress`, `reviews`,
  `sessions`, `exams`, `achievements`, `meta`, `docs` (PDF locaux, jamais exportés).
- Préférences : `localStorage` (`ece-study-settings`, Zustand persist, version 1).
- **Migrations du schéma** : ajouter `this.version(n+1).stores({...}).upgrade(tx => …)` dans `src/db/index.ts`
  sans modifier les versions précédentes.
- **Export JSON** versionné (`app`, `formatVersion`, `exportedAt`, `settings`, `data`) ; l’import valide
  chaque entrée, migre les anciens formats (`MIGRATIONS` dans `db/backup.ts`) et remplace les données dans
  une transaction unique (rien n’est modifié si le fichier est invalide).

### Synchronisation future (non implémentée)

Il n’y a ni compte ni serveur, donc aucune synchronisation automatique — l’interface le dit.
Architecture prévue : un backend authentifié exposant `POST /sync` qui reçoit le même format que l’export,
fusionne par identifiant et horodatage (`at`, `updatedAt`, `lastReviewedAt`), et renvoie l’état fusionné.
Les tables utilisent déjà des horodatages qui le permettent.

## Assistant « Explique-moi » et IA future

Le panneau actuel utilise uniquement des explications pré-écrites (`content/explain`) : autrement dit,
analogie, exemple simple, erreur fréquente, prérequis, reformulation de la consigne. **Aucun chatbot n’est simulé.**
Pour un futur assistant IA : interface `ExplainContext` déjà isolée (`stores/ui.ts`) ; l’appel devra passer
par un **backend** détenant la clé API (jamais de clé dans le frontend ou le dépôt).

## PWA

`registerType: 'prompt'` : la nouvelle version est téléchargée en arrière-plan puis activée **à la demande**
(bandeau), ce qui évite de mélanger anciennes ressources et nouvelles données. Tout le contenu est inclus
dans le précache : leçons et exercices restent disponibles hors connexion. `navigateFallback` vers
`index.html`, HashRouter pour les routes internes.

## Accessibilité

Navigation clavier, focus visible, lien d’évitement, libellés de formulaire, rôles ARIA (radio, switch,
progressbar, timer, status), textes alternatifs des visualisations, `prefers-reduced-motion` + réglage,
contraste renforcé, trois tailles de texte, tableaux de données pour les graphiques, identité jamais
portée par la seule couleur (icônes + libellés).
