/*
 * config.h — CARDIO ECE
 * ---------------------------------------------------------------------------
 * Fichier UNIQUE de configuration : broches, adresses I2C, seuils, filtrage,
 * buzzer, temporisations, encodeur, EEPROM.
 *
 * Ce fichier ne dépend PAS d'Arduino.h : il est aussi inclus par les tests
 * sur PC (tests/), ce qui garantit que l'algorithme testé sur PC utilise
 * exactement les mêmes constantes que la carte.
 *
 * Légende des commentaires :
 *   [CONFIRMÉ]   : information fournie par l'équipe (message Discord Luck8).
 *   [PROVISOIRE] : hypothèse à vérifier sur le montage réel avant la soutenance.
 * ---------------------------------------------------------------------------
 */
#ifndef CARDIO_CONFIG_H
#define CARDIO_CONFIG_H

#include <stdint.h>

// ===========================================================================
// 0. MODE DE FONCTIONNEMENT
// ===========================================================================
// 1 = le signal PPG est généré par PPGSimulator (aucun capteur nécessaire).
//     Le traitement (filtres, détection, BPM, LED, buzzer, EEPROM, écrans)
//     est STRICTEMENT le même code qu'en mode capteur : seule la source de
//     l'échantillon change. Tous les écrans affichent "SIM".
// 0 = lecture réelle du WPSE340 sur l'entrée analogique.
#ifndef SIMULATION_MODE
#define SIMULATION_MODE 0
#endif

// ===========================================================================
// 1. BROCHES (Arduino Uno / Nano — ATmega328P)
// ===========================================================================
// Numéros "digital" Arduino : A0=14, A1=15, A2=16, A3=17 (Uno/Nano).
#define PIN_BUZZER        5    // [CONFIRMÉ] D5  -> buzzer
#define PIN_LED_RED       10   // [CONFIRMÉ] D10 -> LED rouge
#define PIN_LED_YELLOW    11   // [CONFIRMÉ] D11 -> LED jaune
#define PIN_LED_GREEN     12   // [CONFIRMÉ] D12 -> LED verte

// Encodeur rotatif : D9, D8, D7 [CONFIRMÉ comme "encodeur"].
// Attribution CLK/DT/SW [PROVISOIRE] : si le sens de rotation est inversé,
// mettre ENCODER_REVERSE à 1 plutôt que de recâbler.
#define PIN_ENC_A         9    // CLK (sortie A)
#define PIN_ENC_B         8    // DT  (sortie B)
#define PIN_ENC_SW        7    // SW  (bouton intégré à l'encodeur)

#define PIN_BTN_RECORD    4    // [CONFIRMÉ] D4 -> bouton (affecté à l'enregistrement)

// Deuxième bouton (buzzer ON/OFF) : [PROVISOIRE] non mentionné dans le câblage.
// Si aucun 2e bouton n'est câblé : HAS_BUZZER_BUTTON = 0, et un APPUI LONG
// sur le bouton D4 bascule alors le buzzer (l'appui court enregistre).
#define HAS_BUZZER_BUTTON 1
#define PIN_BTN_BUZZER    6    // [PROVISOIRE] D6

// RTC DS1302 (bus série 3 fils) : [PROVISOIRE] broches non communiquées.
// A1..A3 sont utilisées en numérique (aucun conflit avec l'ADC de A0).
#define PIN_RTC_SCLK      15   // A1 -> CLK du module
#define PIN_RTC_IO        16   // A2 -> DAT du module
#define PIN_RTC_CE        17   // A3 -> RST (= CE) du module

// Capteur WPSE340 : sortie analogique "S" -> A0 [PROVISOIRE].
#define PPG_ADC_CHANNEL   0    // canal ADC (0 = A0)

// I2C matériel : A4 = SDA, A5 = SCL (imposé par l'ATmega328P, non modifiable).

// ===========================================================================
// 2. ÉCRANS OLED (I2C)
// ===========================================================================
// Adresses 7 bits. Les modules SSD1306 sont en 0x3C par défaut ; le second
// doit être passé en 0x3D (résistance/pont "ADDR" au dos). [PROVISOIRE]
#define OLED_TEXT_ADDR    0x3C   // écran 1 : texte / menu
#define OLED_GRAPH_ADDR   0x3D   // écran 2 : courbe PPG
// Contrôleur : 0 = SSD1306 (0.96"), 1 = SH1106 (souvent les 1.3"). [PROVISOIRE]
#define OLED_TEXT_SH1106  0
#define OLED_GRAPH_SH1106 0
#define I2C_CLOCK_HZ      400000UL  // Fast-mode, supporté par SSD1306/SH1106

// ===========================================================================
// 3. ACQUISITION PPG
// ===========================================================================
// fs = 100 Hz : le PPG utile est < 5 Hz (fondamental 0,5–3,3 Hz + harmoniques)
// -> Shannon largement respecté ; résolution temporelle 10 ms, améliorée par
// interpolation linéaire du franchissement de seuil (cf. ALGORITHME_PPG.md).
#define SAMPLE_RATE_HZ        100
#define SAMPLE_PERIOD_MS      (1000 / SAMPLE_RATE_HZ)   // 10 ms
// FIFO ISR -> loop() : 16 échantillons = 160 ms de marge si loop() est
// ralentie (pire cas mesuré par conception : écriture EEPROM ~35 ms).
// Puissance de 2 obligatoire. Débordements visibles par la commande STATUS.
#define SAMPLE_FIFO_SIZE      16

// Validité de l'échantillon brut : proche de 0 ou 1023 = saturation ADC
#define ADC_SATURATION_LOW    5
#define ADC_SATURATION_HIGH   1018

// ===========================================================================
// 4. TRAITEMENT DU SIGNAL (voir ALGORITHME_PPG.md)
// ===========================================================================
// Filtre médian sur 5 échantillons (50 ms) appliqué au signal brut :
// supprime totalement une impulsion parasite de 1 ou 2 échantillons
// (≤ 20 ms : décharge, contact, parasite électrique) sans déformer les
// fronts ni le pic systolique (≈ 10 échantillons de large). Retard 20 ms.
#define MEDIAN_ENABLED        1

// Moyenne glissante pour la composante continue : N = 128 échantillons
// = 1,28 s. Doit être >= ~1 période cardiaque pour ne pas "suivre" le pouls,
// mais courte pour suivre la dérive (luminosité, pression du doigt).
// Coupure (-3 dB) du passe-haut obtenu : 0,59 Hz (35 BPM).
// Puissance de 2 -> division par décalage. RAM : 128 x 10 bits = 160 o.
#define DC_WINDOW_LOG2        7
#define DC_WINDOW             (1 << DC_WINDOW_LOG2)

// 1 = moyenne CENTRÉE (phase linéaire, annule une dérive linéaire, retard
//     de N/2 = 0,64 s sur la courbe et le bip) ; 0 = moyenne CAUSALE (aucun
//     retard, mais sensible aux dérives rapides). Comparaison : TESTS.md.
#ifndef DC_CENTERED
#define DC_CENTERED           1
#endif

// Échelle virgule fixe : signal centré exprimé en 1/8 de pas ADC.
#define SIGNAL_SHIFT          3

// Passe-bas : moyenne glissante de 4 échantillons (40 ms). Zéros de
// transmission à 25 Hz et 50 Hz (secteur) ; gain 0,98 à 3 Hz et 0,94 à
// 5 Hz : les pics cardiaques ne sont pas écrasés.
#define LP_WINDOW_LOG2        2
#define LP_WINDOW             (1 << LP_WINDOW_LOG2)

// Enveloppes (suivi d'amplitude) : attaque instantanée, décroissance
// exponentielle vers 0 de constante tau = 2^8 / fs = 2,56 s.
#define ENV_DECAY_SHIFT       8

// Seuils de détection, en 1/16 de l'amplitude crête-à-crête autour du centre
// des enveloppes : armement en dessous de centre - 2/16, déclenchement au
// dessus de centre + 2/16 (hystérésis = 25 % de l'amplitude).
#define THR_HIGH_NUM16        2
#define THR_LOW_NUM16         2

// Qualité du signal (amplitude crête-à-crête, en pas ADC)
#define MIN_AMPLITUDE_ADC     10    // en dessous : bruit / pas de doigt
#define MAX_AMPLITUDE_ADC     700   // au dessus : mouvement / saturation

// Période réfractaire : max(REFRACTORY_MIN_MS, médiane(IBI) * 1/2).
// 250 ms -> 240 BPM maximum détectable, et masque l'onde dicrote.
#define REFRACTORY_MIN_MS     250

// ===========================================================================
// 5. CALCUL BPM ET VALIDATION
// ===========================================================================
#define IBI_MIN_MS            300   // 200 BPM : au dessus = non plausible
#define IBI_MAX_MS            1500  // 40 BPM  : en dessous = non plausible
#define IBI_HISTORY           8     // intervalles conservés (médiane)
#define BPM_AVG_COUNT         5     // intervalles moyennés pour le BPM affiché
#define MIN_VALID_INTERVALS   4     // intervalles cohérents avant affichage
#define IBI_TOLERANCE_PCT     30    // écart max à la médiane (%)
#define MAX_CONSEC_REJECTS    4     // rejets d'affilée -> nouveau rythme
#define BEAT_TIMEOUT_MS       3000  // aucun battement accepté -> invalide
#define SIGNAL_LOSS_MS        1000  // qualité insuffisante -> invalide

// ===========================================================================
// 6. CLASSIFICATION (indicative, adulte au repos — PAS un diagnostic)
// ===========================================================================
#define BPM_LOW_BELOW         60    // BPM < 60          -> FAIBLE (jaune)
#define BPM_HIGH_ABOVE        100   // BPM > 100         -> ÉLEVÉ  (rouge)
                                    // 60 <= BPM <= 100  -> NORMAL (vert)

// LED : 0 = anode vers la broche (HIGH = allumée), 1 = logique inversée
// (LED RGB à anode commune).
#define LED_ACTIVE_LOW        0

// ===========================================================================
// 7. BUZZER
// ===========================================================================
// 0 = buzzer PASSIF (tone(), trois fréquences possibles) — requis par FS4.
// 1 = buzzer ACTIF (son fixe : seules les durées diffèrent).
#define BUZZER_IS_ACTIVE      0
#define TONE_LOW_HZ           440   // grave  : BPM faible  (La3)
#define TONE_NORMAL_HZ        880   // moyen  : BPM normal  (La4)
#define TONE_HIGH_HZ          1760  // aigu   : BPM élevé   (La5)
#define BEEP_DURATION_MS      60    // bref, < IBI min (300 ms)
#define TONE_UI_HZ            2500  // bip de confirmation d'interface
#define BEEP_UI_MS            25

// ===========================================================================
// 8. INTERFACE : BOUTONS, ENCODEUR, PÉRIODES
// ===========================================================================
#define DEBOUNCE_MS           25
#define LONG_PRESS_MS         800
#define ENCODER_STEPS_PER_DETENT 4   // KY-040 : 4 transitions par cran
#define ENCODER_REVERSE       0

#define RTC_READ_PERIOD_MS    200   // lecture RTC (détecte chaque seconde)
#define TEXT_REFRESH_MS       100   // écran texte (seules les lignes modifiées)
#define GRAPH_REFRESH_MS      100   // écran graphique (10 images/s)
#define MENU_TIMEOUT_MS       30000 // retour automatique à l'écran principal
#define MESSAGE_DURATION_MS   2500  // durée des messages temporaires

// Bases de temps du graphique (secondes). La zone de tracé fait
// GRAPH_PLOT_WIDTH = 100 colonnes : chaque colonne couvre exactement
// T x fs / 100 = T échantillons (2, 5, 10, 20) -> l'échelle est exacte.
#define GRAPH_PLOT_WIDTH      100
#define GRAPH_SCALE_COUNT     4
#define GRAPH_DEFAULT_SCALE   1     // index : 5 s

// ===========================================================================
// 9. ENREGISTREMENT ET EEPROM
// ===========================================================================
#define RECORD_SAMPLES        10    // 10 mesures consécutives valides (CDC)
#define RECORD_TIMEOUT_MS     30000 // abandon si 10 mesures non obtenues
#define RECORD_REQUIRE_RTC    1     // refuse d'enregistrer sans heure valide

#define EEPROM_SIZE_BYTES     1024  // ATmega328P
#define EEPROM_HEADER_SIZE    16
#define EEPROM_RECORD_SIZE    8
#define EEPROM_CAPACITY       ((EEPROM_SIZE_BYTES - EEPROM_HEADER_SIZE) / EEPROM_RECORD_SIZE) // 126
#define EEPROM_MAGIC0         0x43  // 'C'
#define EEPROM_MAGIC1         0x45  // 'E'
#define EEPROM_FORMAT_VERSION 1

// ===========================================================================
// 10. LIAISON SÉRIE
// ===========================================================================
#define SERIAL_BAUD           115200UL
#define SERIAL_LINE_MAX       32

#endif // CARDIO_CONFIG_H
