# Audit du contenu

Documents analysés (lus intégralement, diapositive par diapositive / page par page) :

| Réf.     | Document                                            | Pages     | Auteurs                                        |
| -------- | --------------------------------------------------- | --------- | ---------------------------------------------- |
| `cours0` | Cours 0 : Révisions ING1                            | 36 diapos | T. Minot (co-auteurs M. Schneider, N. Rostand) |
| `cours1` | Cours 1 : Conducteurs et composants                 | 53 diapos | M. Schneider (co-auteurs T. Minot, N. Rostand) |
| `cours2` | Cours 2 : Semi-conducteurs et jonction PN           | 44 diapos | M. Schneider (co-auteurs T. Minot, N. Rostand) |
| `livret` | Livret d’exercices TD1–TD2 (extrait du livret ING2) | 18 pages  | Département d’électronique                     |

Les références « diapo N » renvoient au numéro de page du PDF du cours ; « p. N » au numéro de page imprimé du livret.

## Règles appliquées

- **Dépôt public** : aucun PDF n’est versionné ; les énoncés sont **reformulés fidèlement** (titres, numérotation,
  questions et **toutes les données numériques et unités conservées**). Les figures ne sont pas reproduites :
  leur rôle est décrit et la page indiquée. L’étudiant peut importer ses PDF localement (Ressources).
- Chaque leçon, formule, question et exercice indique sa **source** ; les ajouts pédagogiques
  sont marqués « Ajout ECE STUDY » (leçon _Boîte à outils_, analogies, intuitions, exercices générés).
- **Toutes les réponses numériques ont été recalculées** (script de vérification) ; le test
  `tests/content/integrity.test.ts` vérifie que chaque réponse attendue est acceptée par le moteur.
- Aucune citation, page ou exercice officiel n’a été inventé.

## 1. Cartographie des notions

| Cours | Notions (identifiants)                                                              | Pertinence TD1/TD2    |
| ----- | ----------------------------------------------------------------------------------- | --------------------- |
| 0     | Unités et conversions _(ajout)_                                                     | indispensable         |
| 0     | Loi d’Ohm et conventions (d. 6)                                                     | indispensable         |
| 0     | Lois de Kirchhoff (d. 7)                                                            | utile                 |
| 0     | Diviseurs de tension et de courant (d. 9)                                           | utile                 |
| 0     | Sources, transformation MET ↔ MEN (d. 3-4)                                          | hors TD1/TD2          |
| 0     | Méthodes des nœuds et des mailles (d. 11-14)                                        | hors TD1/TD2          |
| 0     | Superposition, Millman (d. 16-20)                                                   | hors TD1/TD2          |
| 0     | Thévenin, Norton (d. 21-28)                                                         | hors TD1/TD2          |
| 0     | AOP idéal, montages fondamentaux (d. 29-35)                                         | hors TD1/TD2          |
| 1     | Convention récepteur (d. 3) ; champ, Coulomb, i = dq/dt (d. 4)                      | utile / indispensable |
| 1     | Vitesse de dérive, Drude, mobilité (d. 6-9)                                         | indispensable         |
| 1     | Densité de courant (d. 10-11) ; loi d’Ohm locale, γ (d. 12)                         | indispensable         |
| 1     | Résistance, résistivité, géométrie, matériaux (d. 13-17)                            | indispensable         |
| 1     | Température (Matthiessen, d. 24) ; impuretés (livret ex. 1.2)                       | indispensable         |
| 1     | Composants, usages de la résistance, potentiomètre, suiveur, modèle réel (d. 19-38) | culture               |
| 1     | Condensateur, C = q/u, i = C du/dt, C = εS/d (d. 39)                                | indispensable         |
| 1     | Applications et modèle réel du condensateur (d. 40-49)                              | culture               |
| 2     | Atome, Bohr, valence (d. 3-5) ; cristal covalent (d. 6)                             | utile                 |
| 2     | Nombre d’atomes par volume (livret ex. 2.4, 2.5, 2.7, 2.9)                          | indispensable         |
| 2     | Énergie thermique (d. 7-9)                                                          | utile                 |
| 2     | Bandes, gap, Fermi ; isolant/SC/conducteur (d. 10-13)                               | indispensable         |
| 2     | Photon et gap (livret ex. 2.2, 2.6)                                                 | indispensable         |
| 2     | Intrinsèque, électrons et trous, n_i(T) (d. 11, 14, 22)                             | indispensable         |
| 2     | Dopage N et P (d. 15-18, 33)                                                        | indispensable         |
| 2     | Loi d’action de masse (d. 20-24)                                                    | indispensable         |
| 2     | Conductivité d’un SC, mobilité vs dopage (d. 19, 26-28)                             | indispensable         |
| 2     | Diffusion, Fick, Einstein (d. 25, 29-31)                                            | utile                 |
| 2     | Jonction PN à l’équilibre, ZCE, V₀ (d. 33-38)                                       | utile                 |
| 2     | Polarisation directe/inverse, I_S, Shockley (d. 39-43)                              | utile                 |

Dépendances : définies par `prerequisiteIds` (notions) et `prerequisiteLessonIds` (leçons) dans `src/content`.

Les éléments « Pour information » des supports (code couleur, marquage CMS, technologies de résistances et
de condensateurs, boîtiers de circuits intégrés) sont résumés dans la leçon _Les composants et la résistance
en pratique_ et dans quelques QCM marqués comme tels.

## 2. Inventaire des exercices (TD1 et TD2 uniquement)

Le livret annonce les TD3 à TD11 (pages 19 à 111) : **non intégrés** dans cette version.
Cours 0 : « Pas d’exercice associé (cf. exemples du cours) » — les exemples du cours sont intégrés aux leçons.

| TD  | Section                   | Ex. | Titre                                          | Questions      | Page  | Correction          |
| --- | ------------------------- | --- | ---------------------------------------------- | -------------- | ----- | ------------------- |
| TD1 | Applications directes     | 1.1 | Choix d’un matériau                            | AD1.1          | 5-6   | livret ✔            |
| TD1 | Applications directes     | 1.2 | Résistivité du cuivre présentant des impuretés | AD1.2, AD1.3   | 6-7   | livret ✔            |
| TD1 | Applications directes     | 1.3 | Vitesse de dérive                              | AD1.4, AD1.5   | 7-8   | livret ✔ (coquille) |
| TD1 | Applications directes     | 1.4 | Vitesse de dérive épisode II                   | AD1.6, AD1.7   | 8-9   | livret ✔            |
| TD1 | Travaux dirigés           | 1.5 | Vitesse de dérive                              | Q1.1 à Q1.4    | 9     | **ECE STUDY**       |
| TD1 | Travaux dirigés           | 1.6 | Capacité électrique                            | Q1.5 à Q1.8    | 9     | **ECE STUDY**       |
| TD2 | Applications directes     | 2.1 | Questions de cours                             | AD2.1 à AD2.4  | 10    | livret ✔            |
| TD2 | Applications directes     | 2.2 | La photorésistance                             | AD2.5, AD2.6   | 10-11 | livret ✔ (arrondi)  |
| TD2 | Applications directes     | 2.3 | Étude du dopage (germanium)                    | AD2.7 à AD2.13 | 11-12 | livret ✔            |
| TD2 | Travaux dirigés           | 2.4 | Étude du dopage (silicium, indium)             | Q2.1 à Q2.5    | 13    | **ECE STUDY**       |
| TD2 | Travaux dirigés           | 2.5 | Résistivité du germanium pur                   | Q2.6 à Q2.12   | 13-14 | **ECE STUDY**       |
| TD2 | Exercices supplémentaires | 2.6 | Phénomène de photoconduction                   | ES2.1 à ES2.3  | 15-16 | livret ✔ (erratum)  |
| TD2 | Exercices supplémentaires | 2.7 | Détermination d’une mobilité                   | ES2.4          | 16    | livret ✔            |
| TD2 | Exercices supplémentaires | 2.8 | Matériau à dopages multiples                   | ES2.5 à ES2.7  | 17-18 | livret ✔ (errata)   |
| TD2 | Exercices supplémentaires | 2.9 | Si le silicium était un métal…                 | ES2.8          | 18    | livret ✔            |

15 exercices, **58 questions interactives** (certaines questions du livret à deux résultats sont scindées,
ex. « Q2.1 (γ) » et « Q2.1 (ρ) »). 25 questions ont une correction calculée par ECE STUDY (les TD 1.5, 1.6,
2.4, 2.5 n’ont pas de corrigé dans le livret) : elles sont signalées dans l’interface.

### Résultats recalculés (corrections ECE STUDY)

| Question    | Résultat                                                                           |
| ----------- | ---------------------------------------------------------------------------------- |
| Q1.1        | R = 120 Ω, γ ≈ 53,1 S/m                                                            |
| Q1.2        | j ≈ 1,27·10³ A/m²                                                                  |
| Q1.3        | E = 24 V/m (cohérent : γE = j)                                                     |
| Q1.4        | n = N/(Sℓ) ≈ 2,55·10²⁸ m⁻³ ; v ≈ 3,1·10⁻⁷ m/s                                      |
| Q1.5 / Q1.6 | C₁ ≈ 3,98 pF, U₁ ≈ 75,3 V ; C₂ ≈ 15,9 pF, U₂ ≈ 18,8 V (ε₀ = 8,85·10⁻¹² F/m)        |
| Q1.8        | σ = Q/S ≈ 0,333 µC/m²                                                              |
| Q2.1        | γᵢ ≈ 3,04·10⁻⁴ S/m ; ρᵢ ≈ 3,29·10³ Ω·m                                             |
| Q2.4        | N_Si ≈ 5,18·10²² cm⁻³ ; p ≈ N_A ≈ 5,2·10¹⁵ cm⁻³ ; n ≈ 1,9·10⁴ cm⁻³                 |
| Q2.5        | γ ≈ 37,3 S/m ; ρ ≈ 2,7·10⁻² Ω·m (× 1,2·10⁵ par rapport à l’intrinsèque)            |
| Q2.6        | N_Ge ≈ 4,44·10²² cm⁻³                                                              |
| Q2.7        | [A] = m⁻³·K⁻³ᐟ²                                                                    |
| Q2.8        | n_i(300 K) ≈ 1,78·10¹⁹ m⁻³ = 1,78·10¹³ cm⁻³                                        |
| Q2.9        | n_i/N ≈ 4·10⁻¹⁰                                                                    |
| Q2.10       | ρ(300 K) ≈ 0,66 Ω·m                                                                |
| Q2.11       | T₁ = 473 K : n_i ≈ 4,0·10²¹ m⁻³, μ_n ≈ 1784, μ_p ≈ 519 cm²/(V·s), ρ ≈ 6,7·10⁻³ Ω·m |
| Q2.12       | lecture graphique (figure 2.2) : autocorrection guidée                             |

**Statut** : calculs vérifiés deux fois (script indépendant + moteur de l’application) ; ils restent à
confronter à la correction donnée en séance de TD.

## 3. Écarts relevés dans les supports

| Où                         | Écart                                                                                                    | Traitement                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Cours 1, diapo 9           | « pour parcourir 1 m : Δt = 1000/5 ≈ 2000 s ≈ 33 min » : 1000 mm ÷ 5 mm/s = **200 s ≈ 3,3 min**          | encadré « erreur du support » dans la leçon    |
| Cours 0, diapo 34          | formule du non-inverseur à lire (1 + R_f/R₁)·V_in                                                        | point de vigilance dans la leçon               |
| Cours 2, diapo 20          | « n = densité des électrons (<0) » : n est une densité de particules, positive (la diapo 28 le confirme) | non repris                                     |
| Cours 2, diapos 23-24      | p = 2,25·10³ et n = 2,25·10⁴ cm⁻³ affichés comme 10³ et 10⁴ (ordre de grandeur)                          | encadré « arrondis »                           |
| Cours 2, diapo 36          | rappel N_A ↔ « dopage N au phosphore », N_D ↔ « dopage P au bore » : inversé                             | encadré + piège de formule                     |
| Cours 2, diapo 40          | « Polarisation inverse : région P reliée à un potentiel supérieur » : c’est **inférieur**                | encadré + explication de QCM                   |
| Livret AD1.4               | μ = 0,14 m²/(V·s) utilisée par la correction mais absente de l’énoncé                                    | donnée affichée avec cette mention             |
| Livret AD1.5               | « 1,1143·10⁻⁴ » au lieu de 1,143·10⁻⁴ s (résultat 0,114 ms correct)                                      | erratum affiché                                |
| Livret AD2.5               | λ_max arrondi à 1 µm (valeur exacte 1,11 µm)                                                             | les deux valeurs acceptées (tolérance 10 %)    |
| Livret ES2.1               | A.N. écrite avec N_D en cm⁻³ et μ en m²/(V·s) ; le résultat 10,4 S/m suppose N_D = 5·10²⁰ m⁻³            | erratum affiché                                |
| Livret ES2.6, zone 2       | « n ≈ N_A » (lire N_D) et dénominateur 10¹³ (lire 10¹⁵) ; résultat correct                               | erratum affiché                                |
| Livret ES2.6, zones 3-4    | « n ≈ N_A = 10¹⁷, p = 689 » : inversé ; zones P ⇒ p ≈ 10¹⁷, n ≈ 689 cm⁻³                                 | erratum + question reformulée                  |
| Livret ES2.7               | ρ = 1/[e(pμ_p − nμ_n)] : le signe doit être +                                                            | erratum + QCM                                  |
| Livret ex. 2.5             | « atomes par cm⁻³ » (lire par cm³)                                                                       | note d’audit                                   |
| Livret ex. 2.4 / 2.9       | masse volumique du silicium 2,42 puis 2,33 g/cm³                                                         | valeur de chaque énoncé utilisée, note d’audit |
| Livret, légende figure 2.4 | « schéma du matériau » alors qu’il s’agit des mobilités à 200 K                                          | décrit correctement                            |

## 4. Éléments non vérifiables ou non reproduits

- **Figures** 1.1 (Δρ du cuivre), 2.1 (photorésistance), 2.2 (n_i vs 1000/T), 2.3 (zones), 2.4 (mobilités) :
  non reproduites. Les valeurs lues sur la figure 1.1 sont celles écrites dans la correction du livret.
  Q2.12 et ES2.7 nécessitent le livret : autocorrection guidée.
- Les animations sont **qualitatives** (échelles exagérées) ; leurs limites sont écrites sous chaque visualisation.

## 5. Contenu pédagogique ajouté par ECE STUDY (hors PDF)

- Leçon « Boîte à outils : unités, préfixes, conversions ».
- Intuitions, analogies, pièges, exemples simples (panneau « Explique-moi », formules).
- 113 questions de QCM (rédigées à partir des cours ; les questions qui citent une diapositive l’indiquent).
- 59 flashcards, lexique de 26 termes.
- 14 générateurs d’exercices d’entraînement (étiquetés « Entraînement supplémentaire — généré »),
  avec des plages de valeurs physiquement réalistes et un résultat calculé par le moteur.

| Élément                     | Statut                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Formules (37)               | relues contre les diapositives citées                                                          |
| Résultats numériques des TD | recalculés, testés automatiquement                                                             |
| QCM                         | vérifiés (bonne réponse acceptée par le moteur, choix uniques) ; relecture humaine recommandée |
| Explications et analogies   | rédigées, non issues du PDF                                                                    |
