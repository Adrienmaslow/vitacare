# Tableau de traçabilité des exigences ET1.1 → ET6.5

> ⚠️ **À vérifier avant la soutenance.** Les cinq PDF de référence (cahier des charges
> `PPG 2026 V2`, Q/R enseignants, grilles de soutenance et de rapport, modèle de
> rapport) **n'étaient pas accessibles** lors du développement : ni dans le dépôt Git,
> ni dans le Google Drive connecté. Les exigences ci-dessous sont **reconstituées** à
> partir de la description détaillée fournie par l'équipe (fonctions FS1 à FS6).
> **Recopier l'intitulé officiel de chaque ET** dans la colonne « Exigence » et
> ajuster la correspondance si la numérotation officielle diffère.

Légende des niveaux de vérification :

| Code | Signification |
|------|---------------|
| **PC** | Test automatique sur ordinateur (`tests/test_algorithms.cpp`) : même code source que la carte, signal **simulé**. |
| **EMU** | Test automatique du **binaire AVR réel** dans l'émulateur simavr (`tests/avr_sim/`) avec périphériques virtuels. **Pas un test matériel.** |
| **HW-xx** | Protocole à exécuter sur le **vrai matériel** (voir `TESTS.md`). Résultat **non encore mesuré**. |

État : ✅ vérifié au niveau indiqué · ⏳ à faire sur matériel.

## FS1 — Acquisition et traitement du signal cardiaque

| ET | Exigence (reconstituée) | Implémentation (fichier → fonction) | Vérification | État |
|----|-------------------------|-------------------------------------|--------------|------|
| ET1.1 | Acquérir périodiquement la sortie analogique du WPSE340 à fréquence fixe, indépendante de `loop()` ; export des données brutes | `PPGSensor.cpp` → `begin()`, `ISR(TIMER1_COMPA_vect)`, `pop()` (Timer1 100 Hz + FIFO) ; `SerialConsole::plotSample()` (PLOT 1/2/3) | EMU : 0 échantillon perdu, FIFO max 3/16 ; HW-01, HW-02 | ✅ EMU ⏳ HW |
| ET1.2 | Supprimer la composante continue / dérive par moyenne glissante | `PPGProcessor::process()` étape 1 (somme glissante, buffer circulaire 128 éch., moyenne centrée) | PC : `testDcRemoval`, `testBaselineDrift` (±200 ADC) ; HW-03 | ✅ PC ⏳ HW |
| ET1.3 | Filtrer, suivre l'amplitude, seuil adaptatif, limiter les faux battements | `PPGProcessor::process()` étapes 2-5 (passe-bas MA4, enveloppes, seuils ±12,5 %, hystérésis, période réfractaire) | PC : bruit ±8/±20 ADC, pics parasites, faible amplitude ; HW-04 | ✅ PC ⏳ HW |
| ET1.4 | Calculer BPM = 60000 / IBI, stabilisé sur plusieurs intervalles, rejet des valeurs aberrantes | `HeartRate::update()`, `recompute()`, `medianIbi()` | PC : 45/60/80/120/180 BPM (erreur ≤ 0,03 BPM), rampe, `testOutlierRules` ; EMU : 72/115/50 BPM ; HW-05 | ✅ PC+EMU ⏳ HW |
| ET1.5 | Perte du doigt / signal : invalidation, `-- BPM`, LED éteintes, pas de bip, pas d'enregistrement ; fonctionnement longue durée | `HeartRate::update()` (SIGNAL_LOSS_MS, BEAT_TIMEOUT_MS), `Recorder::update()`, différences `uint32_t` | PC : `testNoFinger`, `testNoSignal`, `testLongRun` (2 h, passage 0xFFFFFFFF) ; EMU : retrait du doigt ; HW-06 | ✅ PC+EMU ⏳ HW |

Aucune bibliothèque de détection de battement n'est utilisée (règle absolue n°1) :
les seules dépendances sont `Wire`, `EEPROM` (cœur Arduino) et `U8g2` (affichage).

## FS2 — Horloge temps réel DS1302

| ET | Exigence (reconstituée) | Implémentation | Vérification | État |
|----|-------------------------|----------------|--------------|------|
| ET2.1 | Lire heure, minutes, secondes et date complète | `RTCManager.cpp` → `burstRead()`, `decode()`, `update()` (protocole 3 fils écrit à la main) | EMU : modèle DS1302 bit à bit, `GET` ; HW-07 | ✅ EMU ⏳ HW |
| ET2.2 | Vérifier la cohérence des valeurs | `decode()` (BCD, bit CH, plages, jours/mois, années bissextiles, 3 erreurs consécutives) | EMU : RTC neuve → « non réglée » ; HW-07 | ✅ EMU ⏳ HW |
| ET2.3 | Afficher l'heure sur l'OLED 1 ; horodater les enregistrements | `MenuManager.cpp` → `homeLine()` lignes 1-2 ; `Recorder::toggle()` | EMU : captures écran + `DUMP` horodaté ; HW-08 | ✅ EMU ⏳ HW |
| ET2.4 | Conserver l'heure après coupure (pile) ; jamais de réglage systématique au démarrage ; procédure de réglage explicite | `RTCManager::begin()` en lecture seule ; `setDateTime()` uniquement via `SET` ; `tests/tools/rtc_drift.py --set` | EMU : session 2 (redémarrage) heure conservée ; HW-09 | ✅ EMU ⏳ HW |
| ET2.5 | Dérive ≤ 3 s/jour avec vérification initiale | Non garantissable par logiciel (quartz 32,768 kHz du module) → protocole de mesure `rtc_drift.py` | HW-10 (3 à 7 jours) | ⏳ HW |

## FS3 — Indicateurs LED

| ET | Exigence (reconstituée) | Implémentation | Vérification | État |
|----|-------------------------|----------------|--------------|------|
| ET3.1 | LED jaune si BPM faible (< 60) | `classifyBpm()` + `LEDManager::updateHeartRateIndicators()` | PC : seuils ; EMU : 50 BPM → jaune seule ; HW-11 | ✅ EMU ⏳ HW |
| ET3.2 | LED verte si BPM normal (60-100) | idem | EMU : 72 BPM → verte seule ; HW-11 | ✅ EMU ⏳ HW |
| ET3.3 | LED rouge si BPM élevé (> 100) | idem | EMU : 115 BPM → rouge seule ; HW-11 | ✅ EMU ⏳ HW |
| ET3.4 | Une seule LED à la fois, aucune si mesure invalide | `LEDManager::apply()` (tout éteindre puis allumer une seule) | EMU : 0 chevauchement sur toute la session, 0 LED sans doigt ; HW-11 | ✅ EMU ⏳ HW |
| ET3.5 | Seuils configurables, mise à jour automatique sans clignotement | `config.h` (BPM_LOW_BELOW, BPM_HIGH_ABOVE), écriture des broches uniquement sur changement | Revue de code ; HW-11 | ✅ ⏳ HW |

## FS4 — Buzzer

| ET | Exigence (reconstituée) | Implémentation | Vérification | État |
|----|-------------------------|----------------|--------------|------|
| ET4.1 | Bip synchronisé sur chaque battement validé | `processSamples()` → `BuzzerManager::beatBeep()` sur `HR_EV_BEAT_ACCEPTED` et mesure valide | EMU : 96 bips, 0 bip après invalidation ; HW-12 | ✅ EMU ⏳ HW |
| ET4.2 | Trois tonalités : grave / moyenne / aiguë selon la classe | `BuzzerManager::frequencyFor()` | EMU : 440 / 889 / 1827 Hz mesurés sur la broche D5 ; HW-12 | ✅ EMU ⏳ HW |
| ET4.3 | Fréquences et durée configurables | `config.h` (TONE_*_HZ, BEEP_DURATION_MS) | Revue de code | ✅ |
| ET4.4 | Bouton ON/OFF réactif depuis n'importe quel écran, anti-rebond non bloquant | `InputManager::update()` (25 ms), `handleButtons()` traité à chaque tour de `loop()` ; état mémorisé en EEPROM | HW-13 | ⏳ HW |
| ET4.5 | Pas de `delay()`, pas de blocage de la mesure pendant un bip | Générateur Timer2 par interruption (`toneStart()`) | EMU : 0 échantillon perdu pendant 96 bips | ✅ EMU |

## FS5 — Deux écrans OLED

| ET | Exigence (reconstituée) | Implémentation | Vérification | État |
|----|-------------------------|----------------|--------------|------|
| ET5.1 | Deux écrans I2C indépendants, adresses distinctes (0x3C / 0x3D), compatibles avec 2 Ko de SRAM | `DisplayManager.cpp` : u8x8 sans tampon + u8g2 mode page (128 o) ; total RAM statique 1 598 o | EMU : 2 écrans détectés, captures ; HW-14 | ✅ EMU ⏳ HW |
| ET5.2 | Écran 1 : BPM, heure, état ; `-- BPM` / `SIGNAL INVALIDE` ; sans clignotement | `MenuManager::homeLine()` ; `updateText()` (seules les lignes modifiées) | EMU : captures « Accueil » et « Doigt retiré » ; HW-14 | ✅ EMU ⏳ HW |
| ET5.3 | Écran 2 : courbe PPG traitée, temps réel, normalisation verticale | `DisplayManager::pushSample()` (min/max par colonne, centrage sur les enveloppes) | EMU : capture courbe ; HW-15 | ✅ EMU ⏳ HW |
| ET5.4 | Graduation temporelle lisible, échelle horizontale indiquée et exacte | 100 colonnes × T éch. = T × 100 Hz ; quadrillage et libellés `-5s 1s/div 0` | EMU : 6 pulsations sur 5 s à 72 BPM ; HW-15 | ✅ EMU ⏳ HW |
| ET5.5 | Encodeur rotatif : changer la base de temps (2/5/10/20 s) | `MenuManager::handleInput()` → `DisplayManager::changeScale()` ; décodage quadrature sur PCINT | EMU : 1 cran → `-10s 2s/div` ; HW-16 | ✅ EMU ⏳ HW |

## FS6 — EEPROM, enregistrements, menu

| ET | Exigence (reconstituée) | Implémentation | Vérification | État |
|----|-------------------------|----------------|--------------|------|
| ET6.1 | Bouton : enregistrement du BPM moyen de 10 mesures consécutives valides + jour, mois, année, heure, minute, seconde ; non bloquant | `Recorder.cpp` (définition des mesures, annulation, délai) | EMU : enregistrement #1 « 72 BPM, 09/10/2026 14:30:18 » ; HW-17 | ✅ EMU ⏳ HW |
| ET6.2 | Stockage dans l'EEPROM interne, persistant, signature, version, intégrité, mémoire pleine, écritures limitées | `EEPROMManager.cpp` (en-tête + CRC-8, générations, `EEPROM.update()`, récupération après coupure) | PC : `testEEPROM` (coupures simulées, plein, corruption) ; EMU : relu après redémarrage ; HW-18 | ✅ PC+EMU ⏳ HW |
| ET6.3 | Consulter l'historique avec dates et heures dans le menu | `MenuManager::historyLine()` | EMU : capture « Historique » ; HW-19 | ✅ EMU ⏳ HW |
| ET6.4 | Effacer l'historique après confirmation | `UI_ERASE_CONFIRM` (choix par défaut NON) → `EEPROMManager::eraseAll()` | PC : effacement + reboot ; HW-19 | ✅ PC ⏳ HW |
| ET6.5 | Menu bilingue FR/EN, chaînes centralisées en Flash, langue mémorisée | `Strings.h` (X-macro, PROGMEM), `appSetLanguage()` | PC : `testStrings` (toutes les chaînes ≤ 16 car., ASCII) ; HW-20 | ✅ PC ⏳ HW |

## Exigences transverses

| Exigence | Implémentation | Vérification |
|----------|----------------|--------------|
| Pas de `delay()` en fonctionnement normal | seuls `delayMicroseconds(1..4)` dans le pilote DS1302 (≈ 0,7 ms par lecture) | `grep -n "delay(" *.cpp *.ino` → aucun |
| Pas d'allocation dynamique, pas de `String` | objets statiques uniquement | revue de code ; `__brkval` = 0 (STATUS) |
| Débordement de `millis()` | toutes les comparaisons en `(uint32_t)(a - b) >= d` | PC : `testLongRun` démarre à 0xFFFFFFFF − 10 s |
| RAM / Flash compatibles ATmega328P | Flash 28 162 / 32 256 o ; RAM statique 1 598 / 2 048 o ; marge de pile mesurée 248 o | `tools/size_report.sh` ; EMU (STATUS `pile_marge_min`) |
| Mode simulation clairement identifié | `SIMULATION_MODE` : « SIM » sur les deux écrans, bannière série, CSV `source=SIMULATION` | EMU / revue |
