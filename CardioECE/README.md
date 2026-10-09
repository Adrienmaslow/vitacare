# CARDIO ECE — Cardiofréquencemètre PPG sur Arduino (ATmega328P)

Programme embarqué complet : acquisition du capteur photopléthysmographique **WPSE340**,
**algorithme de détection des battements développé par l'équipe** (aucune bibliothèque
de calcul de BPM), horloge **DS1302**, trois LED, buzzer à trois tonalités, **deux écrans
OLED I2C** (texte + courbe), historique en **EEPROM** et menu **bilingue FR/EN**.

| Document | Contenu |
|----------|---------|
| [`TRACABILITE.md`](TRACABILITE.md) | Exigences ET1.1 → ET6.5 ↔ fonctions ↔ tests |
| [`WIRING.md`](WIRING.md) | Câblage, tensions, résistances, conflits de broches |
| [`ALGORITHME_PPG.md`](ALGORITHME_PPG.md) | Traitement du signal : formules, constantes, résultats simulés |
| [`ALGORIGRAMMES.md`](ALGORIGRAMMES.md) | Algorigrammes Mermaid : programme principal, ISR, menu, enregistrement |
| [`TESTS.md`](TESTS.md) | Protocoles de validation (PC, émulation, matériel) |
| [`SOUTENANCE_TECHNIQUE.md`](SOUTENANCE_TECHNIQUE.md) | Explications techniques et questions probables du jury |

> ⚠️ **Points à confirmer avant la soutenance** :
> 1. les cinq PDF de référence n'étaient pas accessibles pendant le développement :
>    vérifier la numérotation ET dans `TRACABILITE.md` ;
> 2. broches **provisoires** (RTC A1-A3, capteur A0, 2e bouton D6) et rôles CLK/DT/SW
>    de l'encodeur : voir `WIRING.md` ;
> 3. adresse du 2e écran (0x3D), type de buzzer (passif ?), contrôleur des écrans
>    (SSD1306 ou SH1106) ;
> 4. **aucun test n'a encore été fait sur le matériel réel** (protocoles HW-01 à HW-21).

## 1. Fonctionnement général

```
WPSE340 ─A0─► ADC ◄─ Timer1 100 Hz (interruption) ──► FIFO 16 éch.
                                                          │  loop()
         ┌────────────────────────────────────────────────┘
         ▼
 médian 5 ─► moyenne glissante centrée (1,28 s) ─► passe-bas ─► enveloppes
 ─► seuil adaptatif + hystérésis + réfractaire ─► battement horodaté
 ─► IBI validés (médiane ±30 %) ─► BPM = 60000·n / ΣIBI ─► valide / invalide
         │
         ├─► LED (jaune < 60 ≤ verte ≤ 100 < rouge)      FS3
         ├─► bip grave / moyen / aigu par battement     FS4
         ├─► OLED 1 : BPM, heure, état, menu            FS5
         ├─► OLED 2 : courbe 2/5/10/20 s (encodeur)     FS5
         └─► bouton : moyenne de 10 mesures + date ─► EEPROM   FS6
 DS1302 (pile) ─► heure affichée + horodatage            FS2
```

Fonctions secondaires : console série (réglage de l'heure, export CSV temps réel,
export de l'historique, état interne), mode **SIMULATION** (signal synthétique, même
traitement), auto-test LED/buzzer au démarrage.

## 2. Matériel

Arduino Uno ou Nano (ATmega328P 16 MHz 5 V) · capteur WPSE340 · module DS1302
« MH-Real-Time Clock » + pile CR2032 · 2 × OLED 128×64 I2C (SSD1306 ou SH1106) ·
LED rouge, jaune, verte + 3 × 220 Ω · buzzer **passif** · encodeur rotatif KY-040 ·
1 ou 2 boutons poussoirs. Détails : [`WIRING.md`](WIRING.md).

## 3. Architecture logicielle

```
CardioECE/
├── CardioECE.ino        setup() / loop() non bloquante, actions communes
├── config.h             TOUTE la configuration (broches, seuils, filtres, périodes…)
├── App.h                objets partagés (déclarations)
├── PPGSensor.*          Timer1 + ADC + FIFO (ISR)                         FS1
├── PPGProcessor.*       médian, composante continue, filtre, seuil, détection  FS1  (C++ pur)
├── HeartRate.*          IBI, rejets, BPM, validité, classification         FS1/FS3 (C++ pur)
├── PPGSimulator.*       générateur PPG synthétique (SIMULATION_MODE)      (C++ pur)
├── RTCManager.*         pilote DS1302 3 fils écrit à la main               FS2
├── LEDManager.*         updateHeartRateIndicators()                        FS3
├── BuzzerManager.*      tonalités Timer2 non bloquantes                    FS4
├── InputManager.*       anti-rebond, appui court/long, encodeur PCINT
├── DisplayManager.*     2 OLED : texte sans tampon + courbe en mode page   FS5
├── MenuManager.*        accueil, menu, historique, effacement, langue      FS5/FS6
├── Recorder.*           BPM moyen de 10 mesures + horodatage               FS6
├── EEPROMManager.*      en-tête, CRC-8, générations, récupération          FS6 (C++ pur*)
├── Strings.*            textes FR/EN en Flash (X-macro)                    FS6 (C++ pur)
├── Format.*             mise en forme sans printf                          (C++ pur)
├── SerialConsole.*      commandes série, export Serial Plotter/Teleplot/CSV
├── pgmcompat.h          PROGMEM sur AVR, neutre sur PC
├── tests/               tests PC, banc d'émulation simavr, outils Python
└── tools/               compilation avr-gcc et rapport de taille
```
\* « C++ pur » : compilable sur PC sans Arduino → testé par `tests/test_algorithms.cpp`
avec **exactement** le code du firmware.

**Ordonnancement** : Timer0 → `millis()` ; Timer1 → échantillonnage 100 Hz ;
Timer2 → buzzer ; PCINT0 → encodeur. `loop()` traite la FIFO en priorité (3 fois par
tour), puis des tâches courtes et bornées (≤ 2 lignes de texte ou 1 bande de courbe par
tour). Aucun `delay()` en fonctionnement normal, aucune allocation dynamique, aucune
classe `String`.

**Mémoire** (mesurée) : Flash **28 162 / 32 256 o**, SRAM statique **1 598 / 2 048 o**,
marge de pile minimale observée **248 o** (émulation). Le mode simulation ajoute ≈ 2 Ko
de Flash et 42 o de RAM.

## 4. Bibliothèques

| Bibliothèque | Version testée | Rôle | Remarque |
|--------------|----------------|------|----------|
| Cœur `arduino:avr` (Wire, EEPROM) | 1.8.6 | I2C, EEPROM | `Wire.setWireTimeout()` requiert ≥ 1.8.3 |
| **U8g2** (olikraus) | 2.37.1 | pilotage SSD1306/SH1106 | utilisée via son **API C** (voir `DisplayManager.cpp`) |

Aucune autre dépendance. **Interdit et non utilisé** : PulseSensor Playground ou toute
bibliothèque calculant le BPM.

## 5. Compilation

### Avec arduino-cli (recommandé)

```bash
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install "U8g2"
arduino-cli compile --fqbn arduino:avr:uno CardioECE
#   Nano ancien bootloader : --fqbn arduino:avr:nano:cpu=atmega328old
#   Mode simulation sans modifier config.h :
arduino-cli compile --fqbn arduino:avr:uno \
  --build-property "compiler.cpp.extra_flags=-DSIMULATION_MODE=1" CardioECE
```

### Avec l'IDE Arduino 2.x

Ouvrir `CardioECE/CardioECE.ino`, installer **U8g2** (Gestionnaire de bibliothèques),
choisir la carte « Arduino Uno » (ou Nano), Vérifier.

### Ce qui a été réellement exécuté pendant le développement

`arduino-cli` n'a **pas** pu être utilisé (téléchargements bloqués par la politique
réseau de l'environnement de développement). La compilation a été faite avec
**avr-gcc 7.3.0** (même version que l'IDE), le cœur **ArduinoCore-avr 1.8.6** et
**U8g2 2.37.1**, en reproduisant les options de l'IDE (`tools/build_avr.sh`) :
compilation **réussie, sans avertissement**, pour `SIMULATION_MODE` 0 et 1
(`tools/size_report.sh`). Le binaire a ensuite été **exécuté en émulation** (simavr).
Les commandes `arduino-cli` ci-dessus restent à lancer une fois sur votre machine.

## 6. Téléversement

```bash
arduino-cli board list                                   # trouver le port
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:uno CardioECE   # (COM3 sous Windows)
arduino-cli monitor -p /dev/ttyACM0 -c baudrate=115200
```

**Premier démarrage** : régler l'heure **une seule fois** (elle est ensuite conservée
par la pile du DS1302 et n'est **jamais** réécrite au démarrage) :

```
SET 2026-10-09 14:30:00          (ou : python3 tests/tools/rtc_drift.py PORT --set)
```

## 7. Commandes utilisateur

| Organe | Action | Effet |
|--------|--------|-------|
| Bouton D4 « Enregistrer » | appui | démarre l'enregistrement (10 battements valides) ; 2e appui = annuler |
| Bouton D6 « Buzzer » | appui | son ON/OFF, depuis n'importe quel écran (mémorisé) |
| (si un seul bouton) D4 | appui long 0,8 s | son ON/OFF |
| Encodeur, accueil | rotation | base de temps de la courbe : 2 / 5 / 10 / 20 s |
| Encodeur | clic | ouvrir le menu / valider |
| Encodeur | appui long | retour à l'accueil depuis n'importe quel écran |
| Menu | Mesure, Historique, Effacer données (confirmation, NON par défaut), Langue FR/EN, Buzzer, Retour | — |

Console série (115200 bauds, fin de ligne LF ou CR) :

| Commande | Rôle |
|----------|------|
| `STATUS` | BPM, qualité, battements acceptés/rejetés, FIFO, EEPROM, écrans, RAM libre, marge de pile |
| `GET` / `SET AAAA-MM-JJ HH:MM:SS` | lire / régler la RTC |
| `PLOT 0` `1` `2` `3` | arrêt / Serial Plotter / Teleplot / CSV (validation) |
| `DUMP` | export CSV de l'historique |
| `ERASE YES` | effacer l'historique |
| `LANG FR` `LANG EN` · `BUZ ON` `BUZ OFF` · `TEST` | réglages, auto-test LED + bips |
| `SIM BPM 72.5` · `SIM NOISE 10` · `SIM DRIFT 100 20` · `SIM SPIKES 2000 150` · `SIM FINGER 0` · `SIM CONNECT 0` · `SIM AMP 60` | **mode simulation uniquement** |

## 8. Configuration (`config.h`)

Broches, adresses I2C et contrôleur des écrans, fréquence d'échantillonnage, fenêtre
de moyenne glissante (`DC_WINDOW_LOG2`), moyenne centrée ou causale (`DC_CENTERED`),
filtre médian, seuils de détection et de qualité, période réfractaire, bornes des IBI,
tolérance de cohérence, délais d'invalidation, seuils de classification (60 / 100),
fréquences et durée des bips, type de buzzer, anti-rebond, appui long, sens de
l'encodeur, périodes de rafraîchissement, bases de temps, nombre de mesures par
enregistrement, exigence d'une heure valide, mode `SIMULATION_MODE`.

## 9. Tests

```bash
tests/run_all.sh                                      # tests PC (912 vérifications)
tests/run_all.sh <ArduinoCore-avr> <U8g2_Arduino>     # + compilation AVR + émulation
```

Voir [`TESTS.md`](TESTS.md). Outils de validation sur matériel : `tests/tools/`
(`capture_serial.py`, `analyze_csv.py`, `rtc_drift.py`).

## 10. Limitations connues

* **Non testé sur le matériel réel** : seuls des tests PC (signaux simulés) et une
  émulation du microcontrôleur ont été réalisés. Les seuils `MIN_AMPLITUDE_ADC`
  et `MAX_AMPLITUDE_ADC` dépendent de l'amplitude réelle du WPSE340 et devront
  peut-être être ajustés (commande `STATUS`, champ `amp_adc`).
* **Retard d'environ 0,7 s** entre le pouls au doigt et le bip / la courbe (prix de la
  moyenne centrée, qui supprime parfaitement les dérives linéaires). Mettre
  `DC_CENTERED 0` pour supprimer ce retard au prix d'une moins bonne tenue aux dérives.
* Le BPM affiché moyenne 5 intervalles : après un changement brusque de rythme, il
  rejoint la nouvelle valeur en 3 à 5 battements.
* Classification **indicative** (adulte au repos) : ce n'est pas un dispositif médical
  ni un diagnostic ; le BPM seul ne suffit pas à juger d'un état de santé
  (âge, effort, médicaments, arythmies ne sont pas pris en compte).
* Mouvements du doigt : les artefacts longs (> 20 ms) ne sont pas filtrés ; ils
  provoquent des rejets puis, s'ils durent, l'invalidation de la mesure (jamais une
  valeur fausse « silencieuse » dans les essais simulés).
* Dérive du DS1302 : dépend du quartz du module (typ. ±20 ppm ≈ 1,7 s/jour, plus en
  température) ; **elle ne peut pas être garantie par logiciel** : à mesurer (HW-10).
* EEPROM : 126 enregistrements ; quand elle est pleine, l'enregistrement est refusé
  (message « MEMOIRE PLEINE ») — effacer via le menu.
* Les accents ne sont pas affichés (police 8×8 ASCII).
