# Protocole de validation — CARDIO ECE

Trois niveaux de test, **à ne jamais confondre dans le rapport** :

| Niveau | Ce qui est testé | Ce qui n'est PAS testé | Où |
|--------|------------------|------------------------|----|
| **1. PC (simulation)** | Algorithmes (filtres, détection, BPM, rejets, EEPROM, chaînes) compilés depuis les **mêmes fichiers** que la carte, sur signaux **synthétiques** | Le microcontrôleur, le temps réel, le capteur | `tests/test_algorithms.cpp` |
| **2. Émulation AVR** | Le **binaire réel** `CardioECE.elf` exécuté instruction par instruction (simavr) : timers, interruptions, ADC, I2C, EEPROM, console, avec des périphériques **virtuels** | Le capteur, l'optique, l'électronique, les vrais écrans | `tests/avr_sim/` |
| **3. Matériel** | Le montage réel | — | Protocoles HW-01 à HW-21 ci-dessous, **à exécuter par l'équipe** |

> Les niveaux 1 et 2 ont été **exécutés** (résultats ci-dessous). Le niveau 3 **n'a pas
> encore été réalisé** : les colonnes « Résultat » sont à remplir par l'équipe. Aucun
> résultat de simulation ou d'émulation ne doit être présenté comme une mesure réelle.

## 1. Tests PC (niveau 1)

```bash
cd CardioECE/tests
make run            # compile avec g++ et exécute ; code retour 0 = tout est OK
```

Dernière exécution : **912 vérifications OK, 0 échec**. Fichier de résultats
`tests/results_simulation.csv` (en-tête « RESULTATS DE SIMULATION »).

| Fonction testée | Test | Résultat attendu | Obtenu (simulation) |
|-----------------|------|------------------|---------------------|
| Suppression de la composante continue | `testDcRemoval` : signal constant puis échelon +300 ADC | sortie nulle, échelon absorbé en < 1,4 s | OK |
| BPM régulier | 45, 60, 80, 120, 180 BPM pendant 30 s | erreur moyenne ≤ 1 BPM, écart max ≤ 2 BPM, valide > 99 % | erreur ≤ 0,03 BPM, 100 % |
| Délai d'accrochage | 75 BPM depuis le démarrage | ≤ 8 s | 3,97 s |
| Variation progressive | rampe 60 → 120 BPM (60 s) puis → 70 (30 s) | écart ≤ 6 BPM, valide > 95 % | 5,7 BPM, 100 % |
| Dérive de ligne de base | ±200 ADC sur 8 s | erreur ≤ 1 BPM, valide > 95 % | 0,00 BPM, 100 % |
| Bruit | ±8 et ±20 ADC ; amplitude faible 30 ADC | erreur ≤ 1 BPM | ≤ 0,01 BPM |
| Pics parasites | 60 ADC / 2,3 s ; impulsions 300 et 600 ADC / 0,7 s | erreur ≤ 1 BPM, valide > 95 % | ≤ 0,01 BPM, 100 % |
| Absence de doigt | doigt retiré après 15 s, puis remis | invalide en ≤ 3,1 s, 0 battement accepté, BPM = 0, classe NONE, ré-accrochage | invalide en 2,53 s, 0 accepté, ré-accrochage OK |
| Absence de signal | ADC = 0 (débranché) ; signal plat dès le départ | jamais valide | OK |
| Valeurs aberrantes | parasite à ½ IBI, battement manqué (2 IBI), IBI 200 ms, changement brutal 75 → 120 BPM, timeout | rejet / BPM conservé / ré-accrochage / invalidation | OK |
| Classification | 59, 60, 100, 101, 0 BPM | FAIBLE, NORMAL, NORMAL, ÉLEVÉ, NONE | OK |
| Fonctionnement prolongé | 2 h simulées, démarrage 10 s avant le débordement 32 bits | écart ≤ 2 BPM, jamais invalide | 0,10 BPM, 0 s invalide |
| EEPROM écriture / lecture | 2 enregistrements, « redémarrage », relecture champ par champ | identiques | OK |
| EEPROM effacement | effacement puis redémarrage | 0 enregistrement, aucune résurrection | OK |
| EEPROM mémoire pleine | 126 ajouts puis 1 de plus | `EE_FULL`, rien d'écrasé | OK |
| EEPROM coupure | coupure après l'enregistrement mais avant le CRC d'en-tête ; au milieu d'un enregistrement ; pendant l'effacement | récupération cohérente | OK |
| EEPROM corruption | 1 octet modifié | détecté par CRC | OK |
| EEPROM écritures inutiles | `setLanguage()` avec la même langue | 0 écriture | OK |
| Changement de langue | toutes les chaînes FR/EN | non vides, ≤ 16 caractères, ASCII | OK |

## 2. Émulation du firmware complet (niveau 2)

Prérequis Linux : `sudo apt install gcc-avr avr-libc simavr libsimavr-dev libelf-dev`.

```bash
# 1. compiler le firmware (voir README pour arduino-cli) ; ici avec le script fourni :
OUT=build tools/build_avr.sh <ArduinoCore-avr> <U8g2_Arduino>
# 2. lancer le banc d'émulation
cd tests/avr_sim && make
./cardio_avr_sim ../../build/CardioECE.elf resultats          # binaire capteur
./cardio_avr_sim ../../build_sim/CardioECE.elf --sim           # binaire SIMULATION_MODE=1
```

Périphériques virtuels écrits dans `cardio_avr_sim.c` : onde PPG analogique sur A0
(modèle indépendant du générateur du firmware), **DS1302 modélisé bit à bit**,
deux écrans I2C 0x3C/0x3D qui reconstituent l'image, boutons, encodeur, mesure des
LED et du signal du buzzer.

Dernière exécution : **23/23 OK** (binaire capteur) et **6/6 OK** (binaire simulation).
Journaux : `tests/avr_sim/resultats/emulation_log.txt`,
`emulation_simulation_build_log.txt`. **Captures des deux écrans** :
`tests/avr_sim/resultats/oled_captures_emulation.txt`.

| Vérification (émulation) | Résultat |
|--------------------------|----------|
| RTC neuve (bit CH) → « RTC non réglée », pas de réglage automatique | OK |
| `SET 2026-10-09 14:30:00` puis `GET` via le protocole 3 fils | OK |
| BPM à 72 / 115 (rampe) / 50 BPM | 72,0 / 115,0 / 50,0 |
| Échantillons perdus | 0 (FIFO max 3/16) |
| Marge de pile minimale mesurée (motif en RAM) | 248 o (capteur), 206 o (simulation) |
| LED : verte à 72, rouge à 115, jaune à 50, aucune sans doigt, jamais deux à la fois | OK |
| Enregistrement après 10 mesures, `DUMP` horodaté | `1,72,09/10/2026,14:30:18` |
| Aucun bip après invalidation | OK |
| Fréquences mesurées sur D5 | 440 / 889 / 1827 Hz (consignes 440 / 880 / 1760 ; écart dû à la division entière du Timer2 et à la méthode de mesure) |
| Encodeur : 1 cran → base de temps 10 s ; clic → menu ; historique | OK (captures) |
| Remise sous tension : historique et heure conservés | OK |
| Build simulation : bannière, `SIM BPM 110`, `SIM FINGER 0` | OK |

## 3. Protocoles sur le matériel réel (niveau 3)

Matériel : montage complet, PC avec moniteur série (115200 bauds), chronomètre,
**appareil de référence** (oxymètre de pouls du commerce ou comptage manuel du pouls
radial sur 60 s). Noter pour chaque essai : date, personne, conditions (lumière,
position), version du code (hash Git).

| ID | Fonction | Protocole | Résultat attendu | Résultat obtenu |
|----|----------|-----------|------------------|-----------------|
| HW-01 | Démarrage | Téléverser, ouvrir le moniteur série | Bannière `=== CARDIO ECE ===`, auto-test : jaune, vert, rouge + 3 bips ; `STATUS` : `oled1=1 oled2=1`, `perdus=0` | |
| HW-02 | Fréquence d'échantillonnage | `PLOT 3`, capturer 60 s avec `tests/tools/capture_serial.py`, puis `analyze_csv.py` | fs mesurée = 100,0 Hz ; écarts ≠ 10 ms = 0 (hors lignes série abandonnées) | |
| HW-03 | Signal brut et dérive | Doigt posé 60 s, puis allumer/éteindre la lumière de la pièce ; `PLOT 1` (Serial Plotter) | Courbe filtrée centrée sur 0, ligne de base stable malgré la lumière ; BPM conservé | |
| HW-04 | Seuil adaptatif | Faire varier la pression du doigt (léger → appuyé) | Seuils (`seuil`) suivent l'amplitude ; pas de faux battements ; `amp_adc` de `STATUS` entre 10 et 700 | |
| HW-05 | **Précision BPM** | 5 personnes × 3 essais de 60 s au repos, doigt immobile ; référence : oxymètre (ou pouls radial compté 60 s par une 2e personne). Remplir `tests/data/validation_bpm_TEMPLATE.csv` ; `analyze_csv.py --ref <BPM>` | Erreur absolue moyenne et max, erreur relative ; objectif indicatif ≤ 5 BPM | |
| HW-06 | Perte du doigt | Retirer le doigt pendant une mesure valide ; chronométrer | `-- BPM`, `SIGNAL INVALIDE`, LED éteintes, aucun bip, en ≤ 3 s | |
| HW-07 | Lecture RTC | `GET` ; comparer à l'heure du PC | Date et heure cohérentes ; si `ARRETEE` → HW-09 | |
| HW-08 | Affichage heure | Observer l'écran 1 pendant 1 min | Secondes qui défilent sans saut ni clignotement | |
| HW-09 | Réglage + maintien sur pile | `python3 tests/tools/rtc_drift.py PORT --set` ; débrancher l'USB 10 min ; rebrancher ; `GET` | Heure juste après coupure ; jamais remise à zéro au démarrage | |
| HW-10 | **Dérive RTC** (objectif ≤ 3 s/jour) | Après HW-09 : `rtc_drift.py PORT --log derive.csv` à J0, J+1, J+3, (J+7) ; PC synchronisé NTP ; noter la température de la pièce | dérive = Δécart / Δjours ; vérification initiale à J0 : écart ≤ 1 s | |
| HW-11 | LED | Mode simulation : `SIM BPM 50`, `SIM BPM 75`, `SIM BPM 120`, `SIM FINGER 0` ; puis au doigt (effort léger pour > 100) | jaune / verte / rouge / aucune ; jamais deux LED ; pas de scintillement pendant le rafraîchissement des écrans | |
| HW-12 | Buzzer | Mêmes états qu'HW-11, écouter ; optionnel : mesurer D5 à l'oscilloscope | 1 bip par battement, grave / moyen / aigu ; aucun bip sans mesure valide | |
| HW-13 | Bouton buzzer | Appuyer sur le bouton buzzer depuis l'accueil, le menu, l'historique | Bascule immédiate (< 0,1 s), affichage `SON:ON/OFF` ; état conservé après redémarrage | |
| HW-14 | Écran texte | Observer pendant 2 min, mesure valide puis invalide | Mise en page conforme, aucun clignotement, `-- BPM / SIGNAL INVALIDE` | |
| HW-15 | Écran courbe | Mesure valide, comparer le nombre de pulsations visibles à la base de temps | À 5 s et 72 BPM : 6 pulsations ; courbe jamais écrêtée en permanence | |
| HW-16 | Encodeur | Tourner cran par cran à l'accueil puis dans le menu | Base de temps 2 → 5 → 10 → 20 s (chaque cran), sens correct (sinon `ENCODER_REVERSE 1`), aucun cran perdu | |
| HW-17 | Enregistrement | Mesure valide → bouton ; compter les battements jusqu'au message ; puis essayer sans doigt | `ENR n/10` progresse ; `ENREGISTRE #k` après 10 battements ; sans doigt : `MESURE INVALIDE` ; doigt retiré pendant la collecte : `ENREG. ANNULE` | |
| HW-18 | Persistance EEPROM | 3 enregistrements, couper l'alimentation, rallumer, `DUMP` | 3 lignes identiques avant/après | |
| HW-19 | Historique + effacement | Menu → Historique (parcours) ; Menu → Effacer → NON puis OUI | Dates/heures affichées ; NON ne supprime rien ; OUI vide l'historique, persistant après reboot | |
| HW-20 | Langue | Menu → Langue ; redémarrer | Tous les textes en anglais, langue conservée | |
| HW-21 | Intégration (répétition générale) | Scénario complet de la soutenance, 10 min, un seul téléversement | Aucun blocage, `STATUS` final : `perdus=0`, `pile_marge_min` > 100 | |

### Fichier de validation BPM

`tests/data/validation_bpm_TEMPLATE.csv` : une ligne par essai, colonnes
`date, personne, essai, conditions, bpm_reference, methode_reference, bpm_cardio_ece,
erreur_absolue, erreur_relative_pct`. Les deux dernières colonnes se calculent :
`|cardio − référence|` et `100 × |cardio − référence| / référence`.
