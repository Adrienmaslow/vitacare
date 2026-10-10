/*
 * ============================================================================
 *  CARDIO ECE  —  Programme intégré FS1 + FS2 + FS3 + FS4 + FS5
 * ============================================================================
 *  Carte : Arduino Uno (ATmega328P)
 *
 *  Fusion des 5 sketches de tests unitaires, avec un seul setup() et un seul
 *  loop(). Le code interne de chaque FS est repris tel quel ; seules les
 *  liaisons entre les blocs ont été ajoutées :
 *    FS1 Capteur  : version de FS1_Capteur (la plus récente), une seule fois.
 *    FS2 Horloge  : bibliothèque virtuabotixRTC = référence pour l'heure ;
 *                   FS5 lit l'heure à travers l'objet RTC de FS2.
 *    FS3 Voyants  : LED rouge / jaune / verte selon le BPM de FS1.
 *    FS4 Beeper   : un beep par battement de FS1, bouton marche/arrêt.
 *    FS5 Écrans   : écran 1 = heure (FS2) + BPM (FS1), écran 2 = courbe PPG,
 *                   encodeur = échelle de temps.
 *
 *  Seules modifications par rapport aux tests unitaires (nécessaires à l'intégration) :
 *    - FS2 : setDS1302Time() n'est appelé que si l'horloge est arrêtée (bit CH),
 *      sinon l'heure serait remise à 18:56:01 à chaque démarrage.
 *    - FS5 : son propre pilote DS1302 (D2/D3/D6) est supprimé ; l'écran 1 lit
 *      l'heure par l'objet RTC de FS2 (fonction rtc_lire). D6 est libre.
 *    - FS1 : la LED D13 de battement du test est retirée (D13 = RST du DS1302).
 *    - FS3 / FS4 : une seule commande de simulation "S <bpm>" pour les deux.
 *    - RAM (2 Ko) : le tampon d'image OLED de 1 Ko ne tenait plus. D'où :
 *      liaison série légère à la place de Serial, nombres de l'écran affichés
 *      avec ltoa(), encodeur lu directement sur le port, FIFO FS1 de 8 cases.
 *
 *  Bibliothèques à installer (Gestionnaire de bibliothèques de l'IDE) :
 *     "virtuabotixRTC" (ArduinoRTClibrary)
 *     "Adafruit SSD1306" (installe aussi Adafruit GFX et Adafruit BusIO)
 *
 *  Câblage :
 *     Capteur WPSE340  S -> A0     + -> 5V     - -> GND
 *     RTC DS1302       CLK -> D2   DAT -> D3   RST -> D13
 *     Buzzer passif    + -> D5     - -> GND
 *     Bouton beep      D4 -> bouton -> GND
 *     Encodeur         CLK -> D9   DT -> D8    SW -> D7
 *     LED              D10 -> 220 ohm -> ROUGE,  D11 -> 220 ohm -> JAUNE,
 *                      D12 -> 220 ohm -> VERTE   (cathodes à GND)
 *     OLED 1 (0x3C) et OLED 2 (0x3D)   SDA -> A4   SCL -> A5
 *
 *  Timers : Timer0 = millis(), Timer1 = échantillonnage FS1 (1 kHz),
 *           Timer2 = tone() du buzzer FS4. Aucun conflit.
 *
 *  Moniteur série 115200 bauds ("Nouvelle ligne") :
 *     S 45 / S 80 / S 130 -> simule ce BPM pour les LED (FS3) et les beeps (FS4)
 *     S 0                 -> retour au capteur
 * ============================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "virtuabotixRTC.h"

// ============================================================================
//  Types utilisés par le programme (déclarés en tête de fichier pour que
//  les prototypes générés automatiquement par l'IDE Arduino les connaissent)
// ============================================================================
enum EtatCardiaque { ETAT_INCONNU, ETAT_FAIBLE, ETAT_NORMAL, ETAT_ELEVE };

struct Bouton {
  uint8_t  pin;
  bool     etatStable;
  bool     dernierLu;
  uint32_t tChange;
};

struct DateHeure {
  uint8_t  sec, min, heure, jour, mois;
  uint16_t annee;
};

// ============================================================================
//  Liaison série légère
//  L'objet Serial de l'IDE réserve 2 x 64 octets de tampons en RAM. Avec le
//  tampon d'image de 1 Ko des écrans OLED (Adafruit_SSD1306) et FS1, la RAM
//  de l'Uno (2 Ko) ne suffit plus : l'écran ne s'initialiserait pas.
//  On le remplace par cette classe (même Serial.print / println / read) :
//  émission directe sur l'UART, réception par interruption (8 octets).
// ============================================================================
class SerieLegere : public Print {
public:
  void begin(unsigned long vitesse) {
    uint16_t ubrr = (F_CPU / 4 / vitesse - 1) / 2;     // même calcul que l'IDE
    UCSR0A = _BV(U2X0);
    UBRR0H = ubrr >> 8;
    UBRR0L = ubrr;
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);                // 8 bits, pas de parité, 1 stop
    UCSR0B = _BV(TXEN0) | _BV(RXEN0) | _BV(RXCIE0);
  }
  size_t write(uint8_t c) {
    while (!(UCSR0A & _BV(UDRE0))) {}                  // attend que l'UART soit libre
    UDR0 = c;
    return 1;
  }
  using Print::write;
  int available() { return (uint8_t)(tete - queue); }
  int read() { return tete == queue ? -1 : recu[queue++ & 7]; }
  volatile uint8_t recu[8];
  volatile uint8_t tete = 0, queue = 0;
};
SerieLegere serieLegere;
#define Serial serieLegere
ISR(USART_RX_vect) { serieLegere.recu[serieLegere.tete++ & 7] = UDR0; }

// ============================================================================
//  Broches
// ============================================================================
const uint8_t PIN_CAPTEUR   = A0;    // FS1 : sortie S du WPSE340
#define DS1302_CLK_PIN 2             // FS2 : horloge DS1302
#define DS1302_DAT_PIN 3
#define DS1302_RST_PIN 13
const uint8_t PIN_LED_ROUGE = 10;    // FS3
const uint8_t PIN_LED_JAUNE = 11;
const uint8_t PIN_LED_VERTE = 12;
const uint8_t PIN_BUZZER    = 5;     // FS4
const uint8_t PIN_BOUTON    = 4;
const uint8_t PIN_ENC_CLK   = 9;     // FS5 : encodeur (port B -> PCINT0)
const uint8_t PIN_ENC_DT    = 8;
const uint8_t PIN_ENC_SW    = 7;
const uint8_t ADR_ECRAN_1   = 0x3C;  // FS5 : écrans I2C (SDA A4, SCL A5)
const uint8_t ADR_ECRAN_2   = 0x3D;

// ============================================================================
//  Réglages
// ============================================================================
// Sortie du moniteur série :
//   0 = résumé texte 1 fois par seconde (heure FS2 + BPM + LED FS3)
//   1 = courbes de FS1 pour le traceur série (Outils -> Traceur série)
#define SORTIE_SERIE 0
#define MODE_TRACEUR 1                   // FS1 : 1 = traceur IDE, 0 = Teleplot
const uint8_t PTS_PAR_AFFICHAGE = 4;     // FS1 : 1 point affiché pour 4 échantillons
const float   LISSAGE_AFFICHAGE = 0.35;  // FS1 : lissage pour l'affichage seulement

// FS2 : heure écrite dans le DS1302 UNIQUEMENT s'il est arrêté (jamais réglé
// ou pile vide). Pour forcer un nouveau réglage : mettre l'heure ci-dessous,
// FORCER_REGLAGE_HEURE à 1, téléverser, puis remettre 0 et téléverser à nouveau.
#define FORCER_REGLAGE_HEURE 0
#define CURRENT_SECONDS 1
#define CURRENT_MINUTES 56
#define CURRENT_HOURS 18
#define CURRENT_DAY_OF_WEEK 5
#define CURRENT_DAY_OF_MONTH 9
#define CURRENT_MONTH 10
#define CURRENT_YEAR 2026

// FS4
const uint16_t FREQ_GRAVE  = 440;     // Hz
const uint16_t FREQ_MODERE = 880;
const uint16_t FREQ_AIGU   = 1760;
const uint8_t  DUREE_BEEP  = 60;      // ms

// ============================================================================
//  FS1 — bloc réutilisé tel quel dans les sketches FS3 à FS6
// ============================================================================
const uint8_t  PERIODE_ECH_MS   = 10;      // 1 échantillon traité toutes les 10 ms (100 Hz)
const uint8_t  MESURES_PAR_ECH  = 10;      // 10 mesures du CAN à 1 kHz par échantillon
const uint8_t  FENETRE_ANTI_SCINT = 20;    // moyenne sur 20 mesures = 20 ms = 1 période
                                           // à 50 Hz, 2 périodes à 100 Hz
const uint16_t SATURATION_BAS   = 5;       // CAN <= 5 ou >= 1018 : capteur saturé
const uint16_t SATURATION_HAUT  = 1018;
const uint8_t  SATURATION_MAINTIEN = 50;   // reste "saturé" 0,5 s après la dernière saturation
const float    SEUIL_PERTURB    = 1.0;     // signal sorti de plus de 1 x l'amplitude
                                           // habituelle au-delà du min/max -> perturbation
const uint16_t GEL_MS           = 400;     // durée du gel après une perturbation
const uint16_t REPRISE_MS       = 1500;    // réapprentissage de l'amplitude ensuite
const uint8_t  N_MOYENNE        = 50;      // moyenne glissante : 50 points x 20 ms = 1 s
const float    ALPHA_LISSAGE    = 0.2;     // passe-bas (0 < alpha <= 1), appliqué 2 fois
const float    OUBLI_ENV        = 0.003;   // le max et le min récents se rapprochent de
                                           // 0,3 % de l'écart par échantillon (~25 %/s)
const float    AMPLITUDE_MIN    = 4.0;     // écart max-min (pas de CAN) pour détecter un doigt...
const float    AMPLITUDE_PERTE  = 2.5;     // ... et en dessous duquel on considère qu'il est parti
                                           // (hystérésis : pas de clignotement près du seuil)
const float    SEUIL_HAUT       = 0.4;     // détection : signal dans les 30 % du haut
const float    SEUIL_BAS        = -0.4;    // réarmement : signal revenu dans les 30 % du bas
                                           // (la 2e bosse du PPG ne réarme pas la détection)
const uint16_t REFRACTAIRE_MS   = 300;     // 2 battements à moins de 300 ms = impossible
const uint8_t  REFRACTAIRE_PCT  = 50;      // ... ni à moins de 50 % de l'intervalle moyen
                                           // (évite de compter l'onde dicrote, 2e bosse du PPG)
const uint8_t  BPM_MIN          = 40;      // hors [40 ; 200] -> valeur aberrante
const uint8_t  BPM_MAX          = 200;
const uint16_t TIMEOUT_MS       = 2500;    // plus de battement depuis 2,5 s -> invalide
const uint8_t  N_IBI            = 5;       // intervalles utilisés pour le BPM (médiane)
const uint8_t  ECART_MIN_PCT    = 70;      // intervalle < 70 % de la médiane -> faux battement
const uint8_t  ECART_MAX_PCT    = 160;     // intervalle > 160 % de la médiane -> battement raté
const uint8_t  MAX_REJETS       = 3;       // 3 rejets d'affilée -> le rythme a vraiment changé

// --- FIFO remplie par l'interruption du Timer1, vidée par loop() ------------
// Chaque case contient la SOMME des 20 dernières mesures (0..20460) ; le bit 15
// indique qu'au moins une mesure était saturée.
const uint8_t     TAILLE_FIFO = 8;         // 80 ms de marge (un envoi d'image OLED = ~25 ms) ;
                                           // 8 au lieu de 16 : 16 octets de RAM rendus à la pile
                                           // dans le programme intégré (tampon OLED de 1 Ko)
const uint16_t    BIT_SATURE  = 0x8000;
volatile uint16_t fifoEch[TAILLE_FIFO];
volatile uint8_t  fifoEcriture = 0;
volatile uint8_t  fifoLecture  = 0;

uint16_t sommeBloc = 0, sommeBlocPrec = 0; // sommes des 10 mesures actuelles / précédentes
uint8_t  nbBloc = 0;
bool     satBloc = false, satBlocPrec = false;
bool     premierBloc = true;

// Appelée à chaque mesure du CAN (1 kHz)
void fs1_acquerir(uint16_t adc) {
  sommeBloc += adc;
  if (adc <= SATURATION_BAS || adc >= SATURATION_HAUT) satBloc = true;
  if (++nbBloc < MESURES_PAR_ECH) return;

  // Fin d'un bloc de 10 ms : somme sur 20 ms = ce bloc + le précédent
  if (!premierBloc) {
    uint16_t mot = sommeBloc + sommeBlocPrec;
    if (satBloc || satBlocPrec) mot |= BIT_SATURE;
    uint8_t suivant = (fifoEcriture + 1) % TAILLE_FIFO;
    if (suivant != fifoLecture) {          // si la FIFO est pleine, on perd l'échantillon
      fifoEch[fifoEcriture] = mot;
      fifoEcriture = suivant;
    }
  }
  premierBloc = false;
  sommeBlocPrec = sommeBloc; satBlocPrec = satBloc;
  sommeBloc = 0; nbBloc = 0; satBloc = false;
}

ISR(TIMER1_COMPA_vect) {                   // appelée toutes les 1 ms
  uint16_t adc = ADC;                      // résultat de la conversion lancée il y a 1 ms
  ADCSRA |= (1 << ADSC);                   // lance la conversion suivante (~104 us)
  fs1_acquerir(adc);
}

// --- Variables internes ------------------------------------------------------
uint32_t numeroEch = 0;                    // base de temps : t = numeroEch x 10 ms
int16_t  bufferMoy[N_MOYENNE];             // signal lissé x16 (entier : 2 octets/valeur)
uint8_t  idxMoy = 0, nbEchMoy = 0;
int32_t  sommeMoy = 0;
int16_t  pointPrec = 0;                    // 1er des 2 échantillons regroupés
bool     echImpair = false;
float    signalLisse = -1;                 // -1 = pas encore initialisé
float    lissage1 = 0;                     // sortie du 1er filtre
float    envHaut = 0, envBas = 0;          // maximum et minimum récents du signal recentré
float    envBrutHaut = 0, envBrutBas = 0;  // idem pour le signal brut (détection des sauts)
float    ecartAvantPerturb = 0;            // amplitude du pouls mémorisée avant un saut
bool     arme = true;                      // prêt à détecter un nouveau battement
bool     battementVu = false;
uint32_t tDernierBattement = 0;
uint16_t ibi[N_IBI];                       // intervalles entre battements (ms)
uint8_t  idxIbi = 0, nbIbi = 0;
uint8_t  nbRejets = 0;                     // intervalles rejetés consécutifs
uint32_t tFinGel = 0, tFinReprise = 0;     // gestion des perturbations lumineuses
uint8_t  compteurSat = 0;

// --- Sorties de FS1 ------------------------------------------------------------
float    valeurBrute      = 0;             // 0..1023 (moyenne anti-scintillement)
float    signalRecentre   = 0;             // signal - moyenne (pas de CAN)
float    signalNorm       = 0;             // [-1 ; 1]
float    bpm              = 0;             // médiane des 5 derniers intervalles
float    bpmInstantane    = 0;             // 60000 / dernier intervalle
bool     bpmValide        = false;
bool     doigtPresent     = false;
bool     nouveauBattement = false;         // mis à true à chaque battement, remis à false par l'utilisateur
bool     nouvelleMesure   = false;         // mis à true à chaque nouvel intervalle valide
bool     capteurSature    = false;         // trop de lumière (ou capteur mal branché)
bool     perturbation     = false;         // changement brusque de lumière en cours de traitement

uint32_t fs1_tempsMs() { return numeroEch * PERIODE_ECH_MS; }

void fs1_init() {
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1  = 0;
  OCR1A  = 249;                                        // 16 MHz / 64 / 250 = 1 kHz
  TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10);   // mode CTC, prédiviseur 64
  TIMSK1 = (1 << OCIE1A);                              // interruption sur comparaison
  // CAN : référence AVcc (5 V), entrée A0, horloge 16 MHz / 128 = 125 kHz
  ADMUX  = (1 << REFS0) | ((PIN_CAPTEUR - A0) & 0x07);
  ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);
  ADCSRA |= (1 << ADSC);                               // 1re conversion
  interrupts();
}

void fs1_reinitialiserBpm() {
  nbIbi = 0;
  idxIbi = 0;
  nbRejets = 0;
  bpm = 0;
  bpmValide = false;
  battementVu = false;
}

// Médiane des intervalles mémorisés : on trie une copie et on prend la valeur
// du milieu. Contrairement à la moyenne, une seule valeur fausse (battement
// compté en double ou raté) ne fait presque pas bouger le résultat.
uint16_t fs1_medianeIbi() {
  uint16_t tri[N_IBI];
  for (uint8_t i = 0; i < nbIbi; i++) tri[i] = ibi[i];
  for (uint8_t i = 1; i < nbIbi; i++) {          // tri par insertion
    uint16_t v = tri[i];
    int8_t k = i - 1;
    while (k >= 0 && tri[k] > v) { tri[k + 1] = tri[k]; k--; }
    tri[k + 1] = v;
  }
  if (nbIbi % 2) return tri[nbIbi / 2];
  return (tri[nbIbi / 2 - 1] + tri[nbIbi / 2]) / 2;
}

// La mesure n'est fiable que si au moins 3 intervalles sont proches (±20 %)
// de la médiane : sinon, on n'affiche rien plutôt qu'une valeur fausse.
bool fs1_coherent(uint16_t mediane) {
  uint8_t proches = 0;
  for (uint8_t i = 0; i < nbIbi; i++) {
    int32_t d = (int32_t)ibi[i] - mediane;
    if (d < 0) d = -d;
    if (d * 5 <= mediane) proches++;
  }
  return proches >= 3;
}

void fs1_calculerBpm() {
  if (nbIbi < 3) { bpmValide = false; return; }   // au moins 3 intervalles
  uint16_t m = fs1_medianeIbi();
  bpm = 60000.0 / m;
  bpmValide = fs1_coherent(m) && bpm >= BPM_MIN && bpm <= BPM_MAX;
}

// Recale la moyenne glissante (ligne de base) sur la valeur actuelle
void fs1_recalerBase() {
  int16_t v16 = (int16_t)(signalLisse * 16);
  for (uint8_t i = 0; i < N_MOYENNE; i++) bufferMoy[i] = v16;
  sommeMoy = (int32_t)v16 * N_MOYENNE;
  nbEchMoy = N_MOYENNE;
  pointPrec = v16;
}

void fs1_traiter(uint16_t mot) {
  numeroEch++;
  uint32_t t = fs1_tempsMs();
  float brut = (mot & ~BIT_SATURE) / (float)FENETRE_ANTI_SCINT;   // moyenne sur 20 ms
  valeurBrute = brut;

  // 0. Saturation : trop de lumière, le signal du pouls est écrêté
  if (mot & BIT_SATURE) compteurSat = SATURATION_MAINTIEN;
  else if (compteurSat > 0) compteurSat--;
  capteurSature = compteurSat > 0;

  // 1. Lissage passe-bas : deux filtres exponentiels en cascade (2e ordre).
  //    Chaque filtre fait  y = y + alpha * (x - y)  : y suit x avec retard,
  //    les variations rapides (bruit) sont atténuées, le pouls (~1 Hz) passe.
  if (signalLisse < 0) { signalLisse = brut; lissage1 = brut; }
  lissage1    += ALPHA_LISSAGE * (brut - lissage1);
  signalLisse += ALPHA_LISSAGE * (lissage1 - signalLisse);

  // 2. Moyenne glissante sur 1 s. Pour économiser la RAM (2 Ko sur l'Uno), on
  //    range un point toutes les 20 ms (moyenne de 2 échantillons) -> 50 points.
  //    Buffer circulaire + somme courante : on retire le plus ancien point et
  //    on ajoute le nouveau, sans décaler le tableau.
  int16_t v16 = (int16_t)(signalLisse * 16);
  if (!echImpair) {
    pointPrec = v16;
    echImpair = true;
  } else {
    echImpair = false;
    int16_t point = (pointPrec + v16) / 2;
    if (nbEchMoy == N_MOYENNE) sommeMoy -= bufferMoy[idxMoy];
    else                       nbEchMoy++;
    bufferMoy[idxMoy] = point;
    sommeMoy += point;
    idxMoy = (idxMoy + 1) % N_MOYENNE;
  }
  float moyenne = nbEchMoy ? (float)sommeMoy / (16.0 * nbEchMoy) : signalLisse;

  // 3. Recentrage : on retire la composante continue (dérive)
  signalRecentre = signalLisse - moyenne;

  if (capteurSature) {                     // rien d'exploitable : pas de mesure
    doigtPresent = false;
    perturbation = false;
    signalNorm = 0;
    envHaut = envBas = 0;
    fs1_reinitialiserBpm();
    return;
  }

  // 3 bis. Changement brusque de lumière ?
  //   En temps normal le signal reste entre envBas et envHaut. S'il s'en
  //   écarte de plus d'une amplitude complète, ce n'est pas le pouls mais un
  //   saut de luminosité (ou un mouvement) : on gèle la détection.
  //   On regarde le signal AVANT le lissage : le saut y est immédiat, alors
  //   qu'après le filtre il arrive progressivement et passerait inaperçu.
  //   Pendant la reprise (amplitude en cours de réapprentissage), on compare
  //   à l'amplitude mémorisée avant le saut, avec plus de marge : un 2e saut
  //   (lumière qui revient, fin d'une ombre) est ainsi lui aussi détecté.
  float brutRecentre = brut - moyenne;
  float ecartBrut = envBrutHaut - envBrutBas;
  bool  enReprise = t >= tFinGel && t < tFinReprise;
  float marge = enReprise ? 1.5 * SEUIL_PERTURB * ecartAvantPerturb
                          : SEUIL_PERTURB * ecartBrut;
  if ((enReprise || (doigtPresent && t >= tFinReprise)) &&
      (brutRecentre > envBrutHaut + marge || brutRecentre < envBrutBas - marge)) {
    if (!enReprise) ecartAvantPerturb = ecartBrut;
    tFinGel = t + GEL_MS;
    tFinReprise = tFinGel + REPRISE_MS;
  }
  if (battementVu && t - tDernierBattement > TIMEOUT_MS) fs1_reinitialiserBpm();
  perturbation = t < tFinGel;
  if (perturbation) {
    // Pendant le gel : les filtres et la ligne de base sautent directement au
    // nouveau niveau de lumière, on oublie l'ancienne amplitude (elle sera
    // réapprise), le BPM est conservé.
    lissage1 = signalLisse = brut;
    fs1_recalerBase();
    signalRecentre = 0;
    signalNorm = 0;
    envHaut = envBas = 0;
    envBrutHaut = envBrutBas = 0;
    arme = false;
    return;
  }
  envBrutHaut -= OUBLI_ENV * ecartBrut;
  envBrutBas  += OUBLI_ENV * ecartBrut;
  if (brutRecentre > envBrutHaut) envBrutHaut = brutRecentre;
  if (brutRecentre < envBrutBas)  envBrutBas  = brutRecentre;

  // 4. Normalisation entre le minimum et le maximum récents -> [-1 ; 1]
  //    (le pic du pouls est étroit et haut, le creux large et peu profond :
  //    on suit donc le haut ET le bas séparément). Les deux bornes se
  //    rapprochent lentement pour s'adapter si l'amplitude diminue.
  float ecart = envHaut - envBas;
  envHaut -= OUBLI_ENV * ecart;
  envBas  += OUBLI_ENV * ecart;
  if (signalRecentre > envHaut) envHaut = signalRecentre;
  if (signalRecentre < envBas)  envBas  = signalRecentre;
  ecart = envHaut - envBas;

  doigtPresent = (nbEchMoy == N_MOYENNE) &&
                 (ecart >= (doigtPresent ? AMPLITUDE_PERTE : AMPLITUDE_MIN));
  if (!doigtPresent) {
    signalNorm = 0;
    if (t >= tFinReprise) fs1_reinitialiserBpm();   // pas pendant la reprise
    return;
  }
  signalNorm = 2.0 * (signalRecentre - envBas) / ecart - 1.0;

  // 5. Détection par seuil avec hystérésis + période réfractaire adaptative
  uint32_t refractaire = REFRACTAIRE_MS;
  if (bpmValide) {
    uint32_t r = 60000.0 / bpm * REFRACTAIRE_PCT / 100;
    if (r > refractaire) refractaire = r;
  }
  if (arme && signalNorm > SEUIL_HAUT &&
      (!battementVu || t - tDernierBattement > refractaire)) {
    arme = false;

    // 6. Intervalle entre deux battements -> contrôle de cohérence -> BPM
    if (!battementVu) {
      battementVu = true;
      tDernierBattement = t;
      nouveauBattement = true;
      return;
    }
    uint32_t intervalle = t - tDernierBattement;
    // Rythme de référence : seulement s'il est déjà fiable
    uint16_t ref = bpmValide ? fs1_medianeIbi() : 0;

    if (ref && intervalle * 100 < (uint32_t)ref * ECART_MIN_PCT && nbRejets < MAX_REJETS) {
      // Trop tôt par rapport au rythme habituel : c'est la 2e bosse du pouls
      // ou un mouvement du doigt. On l'ignore complètement (pas de beep).
      nbRejets++;
      return;
    }
    nouveauBattement = true;
    tDernierBattement = t;

    bool horsPlage = intervalle < 60000UL / BPM_MAX || intervalle > 60000UL / BPM_MIN;
    bool rate = ref && intervalle * 100 > (uint32_t)ref * ECART_MAX_PCT;
    if (horsPlage || (rate && nbRejets < MAX_REJETS)) {
      // Battement raté entre les deux : l'intervalle est faux, on ne le garde
      // pas, mais ce battement sert de nouveau point de départ.
      nbRejets++;
      return;
    }
    if (nbRejets >= MAX_REJETS) {
      // Plusieurs rejets d'affilée : ce n'est plus un accident, le rythme a
      // réellement changé (effort, repos...). On repart de zéro.
      nbIbi = 0;
      idxIbi = 0;
    }
    nbRejets = 0;
    ibi[idxIbi] = intervalle;
    idxIbi = (idxIbi + 1) % N_IBI;
    if (nbIbi < N_IBI) nbIbi++;
    bpmInstantane = 60000.0 / intervalle;
    nouvelleMesure = true;
    fs1_calculerBpm();
  }
  if (!arme && signalNorm < SEUIL_BAS) arme = true;
}

// Traite UN échantillon s'il y en a un en attente. À appeler en boucle :
//    while (fs1_update()) { ... }
bool fs1_update() {
  if (fifoLecture == fifoEcriture) return false;
  uint16_t v = fifoEch[fifoLecture];
  fifoLecture = (fifoLecture + 1) % TAILLE_FIFO;
  fs1_traiter(v);
  return true;
}
// ======================== fin du bloc FS1 ===================================

// ============================================================================
//  FS1 — affichage des courbes sur le moniteur série (SORTIE_SERIE = 1)
// ============================================================================
#if SORTIE_SERIE == 1
float    courbeAff = 0;          // signal normalisé, lissé pour l'affichage
float    sommeAff = 0;
uint8_t  nbAff = 0;
bool     battementAff = false;   // un battement a eu lieu depuis le dernier point

void afficherPoint() {
  float pouls = sommeAff / nbAff * 100.0;      // -100 .. +100
  float bpmAff = bpmValide ? bpm : 0;
#if MODE_TRACEUR == 1
  // Traceur de l'IDE : toutes les courbes sur la même échelle (-120 .. +200).
  // "haut" et "bas" sont deux lignes fixes qui bloquent l'échelle automatique :
  // la courbe ne "saute" plus à chaque rafraîchissement.
  Serial.print(F("haut:200,bas:-120,pouls:"));
  Serial.print(pouls, 1);
  Serial.print(F(",seuil:"));
  Serial.print(SEUIL_HAUT * 100.0, 0);
  Serial.print(F(",battement:"));
  Serial.print(battementAff ? 150 : -120);     // pic vertical à chaque battement
  Serial.print(F(",bpm:"));
  Serial.println(bpmAff, 0);
#else
  // Teleplot : une courbe par graphique, échelles indépendantes
  Serial.print(F(">brut:"));   Serial.println(valeurBrute, 1);
  Serial.print(F(">pouls:"));  Serial.println(pouls, 1);
  Serial.print(F(">bpm:"));    Serial.println(bpmAff, 1);
  if (battementAff) Serial.println(F(">battement:1"));
#endif
}
#endif

// ============================================================================
//  FS2 — Horloge DS1302 (bibliothèque virtuabotixRTC) : référence de l'heure
// ============================================================================
virtuabotixRTC RTC(DS1302_CLK_PIN, DS1302_DAT_PIN, DS1302_RST_PIN);
unsigned long temps_precedent = 0;

void calculTime(){

      RTC.updateTime();
	    Serial.print(RTC.year);
	    Serial.print("/");
	    Serial.print(RTC.month);
	    Serial.print("/");
	    Serial.print(RTC.dayofmonth);

	   Serial.print(" ");

	   Serial.print(RTC.hours);
	   Serial.print(":");
	   Serial.print(RTC.minutes);
	   Serial.print(":");
	   Serial.print(RTC.seconds);
     Serial.println(" ");

}

void fs2_init() {
  // Bit CH (bit 7 du registre des secondes, adresse 0x80) : 1 = oscillateur
  // arrêté. On ne règle l'heure que dans ce cas : après une coupure, la pile
  // a gardé l'heure, elle n'est pas écrasée à chaque démarrage.
  if (FORCER_REGLAGE_HEURE || (RTC.DS1302_read(0x80) & 0x80)) {
    RTC.setDS1302Time(
	     CURRENT_SECONDS,
	     CURRENT_MINUTES,
	     CURRENT_HOURS,
	     CURRENT_DAY_OF_WEEK,
	     CURRENT_DAY_OF_MONTH,
	     CURRENT_MONTH,
	     CURRENT_YEAR
	   );
  }
}

// Liaison FS2 -> FS5 : l'écran 1 lit l'heure à travers l'objet RTC de FS2
void rtc_lire(DateHeure &d) {
  RTC.updateTime();
  d.sec   = RTC.seconds;
  d.min   = RTC.minutes;
  d.heure = RTC.hours;
  d.jour  = RTC.dayofmonth;
  d.mois  = RTC.month;
  d.annee = RTC.year;
}
// ========================= fin du bloc FS2 ==================================

// ============================================================================
//  Classement de la fréquence cardiaque (adulte au repos) :
//   < 60 bpm  : bradycardie -> faible
//   60 à 100  : normale
//   > 100 bpm : tachycardie -> élevée
// ============================================================================
const uint8_t BPM_BAS  = 60;
const uint8_t BPM_HAUT = 100;


EtatCardiaque classer(float f, bool valide) {
  if (!valide)       return ETAT_INCONNU;   // valeur aberrante ou pas de mesure
  if (f < BPM_BAS)   return ETAT_FAIBLE;
  if (f > BPM_HAUT)  return ETAT_ELEVE;
  return ETAT_NORMAL;
}
// ======================= fin du bloc Etat ===================================

// ============================================================================
//  Boutons poussoirs avec anti-rebond (bouton câblé entre la broche et GND,
//  résistance de tirage interne INPUT_PULLUP -> appuyé = LOW)
// ============================================================================
const uint8_t ANTI_REBOND_MS = 20;


void bouton_init(Bouton &b, uint8_t pin) {
  b.pin = pin;
  pinMode(pin, INPUT_PULLUP);
  b.etatStable = b.dernierLu = digitalRead(pin);
  b.tChange = millis();
}

// Renvoie true une seule fois, au moment où le bouton est enfoncé
bool bouton_appui(Bouton &b) {
  bool lu = digitalRead(b.pin);
  if (lu != b.dernierLu) { b.dernierLu = lu; b.tChange = millis(); }
  if (millis() - b.tChange >= ANTI_REBOND_MS && lu != b.etatStable) {
    b.etatStable = lu;
    return lu == LOW;
  }
  return false;
}
// ======================= fin du bloc Bouton =================================

// ============================================================================
//  Lecture d'une commande tapée dans le moniteur série (non bloquant)
// ============================================================================
char    ligne[8];
uint8_t lgLigne = 0;

bool lireLigneSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (lgLigne > 0) { ligne[lgLigne] = 0; lgLigne = 0; return true; }
    } else if (lgLigne < sizeof(ligne) - 1) {
      ligne[lgLigne++] = c;
    }
  }
  return false;
}
// ======================== fin du bloc Série =================================

int bpmSimule = 0;                        // 0 = mode capteur (commande S, FS3 et FS4)

// ============================================================================
//  FS3 — Voyants
// ============================================================================
void fs3_init() {
  pinMode(PIN_LED_ROUGE, OUTPUT);
  pinMode(PIN_LED_JAUNE, OUTPUT);
  pinMode(PIN_LED_VERTE, OUTPUT);
}

void fs3_afficher(EtatCardiaque e) {
  digitalWrite(PIN_LED_ROUGE, e == ETAT_ELEVE);
  digitalWrite(PIN_LED_JAUNE, e == ETAT_FAIBLE);
  digitalWrite(PIN_LED_VERTE, e == ETAT_NORMAL);
}

// ============================================================================
//  FS4 — Beeper
// ============================================================================
Bouton   boutonBeep;
bool     beepActif = true;
uint32_t tBeepSimule = 0;

void fs4_beep(EtatCardiaque e) {
  if (!beepActif || e == ETAT_INCONNU) return;   // pas de beep si mesure aberrante
  uint16_t f = (e == ETAT_FAIBLE) ? FREQ_GRAVE : (e == ETAT_ELEVE) ? FREQ_AIGU : FREQ_MODERE;
  tone(PIN_BUZZER, f, DUREE_BEEP);
}

// ============================================================================
//  Encodeur rotatif (type KY-040) lu par interruption "pin change"
//  CLK et DT doivent être sur le port B (D8 à D13) -> vecteur PCINT0.
//  Si le sens est inversé : SENS_ENCODEUR = -1.
//  Si un cran fait avancer de 2 : TRANSITIONS_PAR_CRAN = 2.
// ============================================================================
const int8_t  SENS_ENCODEUR = 1;
const int8_t  TRANSITIONS_PAR_CRAN = 4;

volatile int16_t encPas = 0;
volatile int8_t  encAccu = 0;
volatile uint8_t encEtat = 0;

// Décodage en quadrature : index = (ancien état AB << 2) | nouvel état AB
// +1 / -1 pour une transition valide dans un sens ou l'autre, 0 sinon (rebond).
ISR(PCINT0_vect) {
  static const int8_t TABLE[16] PROGMEM = { 0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0 };   // en Flash
  // Lecture directe du port (même résultat que digitalRead, mais sans appel
  // de fonction : l'interruption utilise beaucoup moins de pile)
  uint8_t ab = ((*portInputRegister(digitalPinToPort(PIN_ENC_CLK)) & digitalPinToBitMask(PIN_ENC_CLK)) ? 2 : 0) |
               ((*portInputRegister(digitalPinToPort(PIN_ENC_DT))  & digitalPinToBitMask(PIN_ENC_DT))  ? 1 : 0);
  encEtat = ((encEtat << 2) | ab) & 0x0F;
  encAccu += (int8_t)pgm_read_byte(&TABLE[encEtat]);
  if (encAccu >= TRANSITIONS_PAR_CRAN)       { encPas++; encAccu = 0; }
  else if (encAccu <= -TRANSITIONS_PAR_CRAN) { encPas--; encAccu = 0; }
}

void encodeur_init() {
  pinMode(PIN_ENC_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC_DT,  INPUT_PULLUP);
  encEtat = (digitalRead(PIN_ENC_CLK) << 1) | digitalRead(PIN_ENC_DT);
  *digitalPinToPCMSK(PIN_ENC_CLK) |= bit(digitalPinToPCMSKbit(PIN_ENC_CLK));
  *digitalPinToPCMSK(PIN_ENC_DT)  |= bit(digitalPinToPCMSKbit(PIN_ENC_DT));
  PCICR |= bit(digitalPinToPCICRbit(PIN_ENC_CLK));
}

// Nombre de crans tournés depuis le dernier appel (+ horaire, - anti-horaire)
int16_t encodeur_lire() {
  noInterrupts();
  int16_t p = encPas;
  encPas = 0;
  interrupts();
  return SENS_ENCODEUR * p;
}
// ======================= fin du bloc Encodeur ===============================

// ============================================================================
//  Écrans OLED SSD1306 128x64 sur le bus I2C (SDA = A4, SCL = A5)
//  Écran 1 : adresse 0x3C (d'origine)   Écran 2 : adresse 0x3D (résistance déplacée)
//  Une seule instance (un seul buffer de 1 Ko : la RAM de l'Uno ne fait que
//  2 Ko) : on change simplement l'adresse I2C avant d'envoyer l'image.
// ============================================================================

class EcransOLED : public Adafruit_SSD1306 {
public:
  EcransOLED() : Adafruit_SSD1306(128, 64, &Wire, -1) {}
  void choisirEcran(uint8_t adresse) { i2caddr = adresse; }   // i2caddr est "protected"
};
EcransOLED ecran;

// Initialise un écran ; renvoie false s'il ne répond pas
bool oled_initEcran(uint8_t adresse) {
  if (!ecran.begin(SSD1306_SWITCHCAPVCC, adresse)) return false;
  ecran.clearDisplay();
  ecran.display();
  return true;
}

// Affiche la LED 13 en clignotement rapide si un écran est absent
void oled_erreur() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) { digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); delay(100); }
}
// Affichage d'un nombre sur l'écran. ecran.print(nombre) passe par
// Print::printNumber, qui réserve 33 octets sur la pile : avec le tampon
// d'image de 1 Ko, la pile débordait dans ce tampon (mesuré). ltoa() écrit
// le même texte dans un petit tableau.
void ecranEntier(long v) {
  char t[8];
  ltoa(v, t, 10);
  ecran.print(t);
}

void ecranDecimal(float v) {              // même rendu que ecran.print(v, 1)
  long dixiemes = (long)(v * 10 + 0.5);
  ecranEntier(dixiemes / 10);
  ecran.print('.');
  ecranEntier(dixiemes % 10);
}
// ========================= fin du bloc OLED =================================

// ============================================================================
//  FS5 — Écrans
// ============================================================================
// --- Courbe PPG ----------------------------------------------------------------
const uint8_t  LARGEUR_COURBE = 100;           // pixels
const uint8_t  X0_COURBE      = 24;            // abscisse du 1er point
const uint8_t  Y_MILIEU       = 31;            // ordonnée du 0
const uint8_t  DEMI_HAUTEUR   = 20;            // pixels pour une amplitude de 1
const uint8_t  ECHELLES_MS[]  = { 10, 20, 40, 80 };    // ms par pixel
const uint8_t  NB_ECHELLES    = sizeof(ECHELLES_MS);
const uint8_t  ECHELLE_DEFAUT = 1;

int8_t  courbe[LARGEUR_COURBE];                // signal normalisé x 100
uint8_t idxCourbe = 0, nbPoints = 0;
uint8_t idxEchelle = ECHELLE_DEFAUT;
float   sommeDecim = 0;
uint8_t nbDecim = 0;

Bouton   boutonEncodeur;
uint32_t tDernierBattementAff = 0;

void courbe_vider() {
  nbPoints = 0; idxCourbe = 0; sommeDecim = 0; nbDecim = 0;
}

// Appelée pour chaque échantillon (100 Hz) : on regroupe k échantillons par
// pixel (k = ms par pixel / 10 ms) en faisant leur moyenne.
void courbe_ajouter(float v) {
  sommeDecim += v;
  if (++nbDecim < ECHELLES_MS[idxEchelle] / PERIODE_ECH_MS) return;
  int16_t p = (int16_t)(sommeDecim / nbDecim * 100);
  courbe[idxCourbe] = constrain(p, -100, 100);
  idxCourbe = (idxCourbe + 1) % LARGEUR_COURBE;
  if (nbPoints < LARGEUR_COURBE) nbPoints++;
  sommeDecim = 0; nbDecim = 0;
}

void dessinerCoeur(int16_t x, int16_t y, uint8_t r) {   // r = rayon des lobes
  ecran.fillCircle(x - r, y, r, SSD1306_WHITE);
  ecran.fillCircle(x + r, y, r, SSD1306_WHITE);
  ecran.fillTriangle(x - 2 * r, y + 1, x + 2 * r, y + 1, x, y + 3 * r, SSD1306_WHITE);
}

// --- Écran 1 : heure + BPM ---------------------------------------------------------
void afficherEcran1() {
  DateHeure d;
  rtc_lire(d);
  char txt[12];

  ecran.clearDisplay();
  ecran.setTextColor(SSD1306_WHITE);
  ecran.setTextSize(2);
  snprintf_P(txt, sizeof(txt), PSTR("%02u:%02u:%02u"), d.heure, d.min, d.sec);
  ecran.setCursor(16, 4);
  ecran.print(txt);
  ecran.drawFastHLine(0, 25, 128, SSD1306_WHITE);

  bool battementRecent = millis() - tDernierBattementAff < 150;
  dessinerCoeur(18, 40, battementRecent ? 5 : 4);       // le coeur "bat"

  ecran.setTextSize(3);
  ecran.setCursor(44, 34);
  if (bpmValide) ecranEntier((int)(bpm + 0.5));
  else           ecran.print('-');
  ecran.setTextSize(1);
  ecran.setCursor(102, 48);
  ecran.print(F("bpm"));

  ecran.choisirEcran(ADR_ECRAN_1);
  ecran.display();
}

// --- Écran 2 : courbe PPG graduée ----------------------------------------------
void afficherEcran2() {
  uint8_t msParPixel = ECHELLES_MS[idxEchelle];
  const uint8_t xFin = X0_COURBE + LARGEUR_COURBE - 1;
  const uint8_t yAxe = Y_MILIEU + DEMI_HAUTEUR + 2;

  ecran.clearDisplay();
  ecran.setTextSize(1);
  ecran.setTextColor(SSD1306_WHITE);
  ecran.setCursor(0, 0);
  ecran.print(F("PPG"));
  ecran.setCursor(70, 0);
  ecranEntier(msParPixel);
  ecran.print(F("ms/px"));

  // Axe vertical gradué : +1, 0, -1 (signal normalisé)
  ecran.drawFastVLine(X0_COURBE - 2, Y_MILIEU - DEMI_HAUTEUR, 2 * DEMI_HAUTEUR + 3, SSD1306_WHITE);
  for (int8_t k = -1; k <= 1; k++) {
    uint8_t y = Y_MILIEU - k * DEMI_HAUTEUR;
    ecran.drawFastHLine(X0_COURBE - 4, y, 3, SSD1306_WHITE);
    ecran.setCursor(k < 0 ? 6 : 12, y - 3);
    ecranEntier(k);
  }

  // Axe horizontal gradué : un trait tous les 25 px, une étiquette tous les 50 px
  ecran.drawFastHLine(X0_COURBE - 2, yAxe, LARGEUR_COURBE + 2, SSD1306_WHITE);
  for (uint8_t k = 0; k <= 4; k++) {
    uint8_t x = X0_COURBE + k * 25;
    if (x > xFin) x = xFin;
    ecran.drawFastVLine(x, yAxe, 3, SSD1306_WHITE);
    if (k % 2 == 0) {
      float s = k * 25.0 * msParPixel / 1000.0;   // secondes
      ecran.setCursor(x - (k == 4 ? 12 : 3), 57);
      if (s == (int)s) ecranEntier((int)s);
      else             ecranDecimal(s);
    }
  }
  ecran.setCursor(xFin - 2, 57);
  ecran.print('s');

  // Courbe (le point le plus récent est à droite)
  if (!doigtPresent) {
    ecran.setCursor(X0_COURBE + 8, Y_MILIEU - 3);
    ecran.print(F("Posez le doigt"));
  } else {
    int16_t xPrec = -1, yPrec = 0;
    for (uint8_t i = 0; i < nbPoints; i++) {
      uint8_t idx = (idxCourbe + LARGEUR_COURBE - nbPoints + i) % LARGEUR_COURBE;
      int16_t x = X0_COURBE + (LARGEUR_COURBE - nbPoints) + i;
      int16_t y = Y_MILIEU - (int16_t)courbe[idx] * DEMI_HAUTEUR / 100;
      if (xPrec >= 0) ecran.drawLine(xPrec, yPrec, x, y, SSD1306_WHITE);
      else            ecran.drawPixel(x, y, SSD1306_WHITE);
      xPrec = x; yPrec = y;
    }
  }

  ecran.choisirEcran(ADR_ECRAN_2);
  ecran.display();
}


// ============================================================================
//  Programme principal
// ============================================================================
void setup() {
  Serial.begin(115200);
  if (!oled_initEcran(ADR_ECRAN_1)) oled_erreur();   // FS5
  if (!oled_initEcran(ADR_ECRAN_2)) oled_erreur();
  fs2_init();                                        // FS2
  fs3_init();                                        // FS3
  bouton_init(boutonBeep, PIN_BOUTON);               // FS4
  pinMode(PIN_BUZZER, OUTPUT);
  encodeur_init();                                   // FS5
  bouton_init(boutonEncodeur, PIN_ENC_SW);
  fs1_init();                                        // FS1 en dernier : l'acquisition démarre
  Serial.println(F("=== CARDIO ECE : FS1 a FS5. Bouton D4 = beep marche/arret. Test : S <bpm> ==="));
}

void loop() {
  // ---- FS1 : traiter tous les échantillons en attente --------------------------
  while (fs1_update()) {
    courbe_ajouter(doigtPresent ? signalNorm : 0);         // FS5 : courbe PPG
#if SORTIE_SERIE == 1
    courbeAff += LISSAGE_AFFICHAGE * (signalNorm - courbeAff);
    sommeAff += courbeAff;
    nbAff++;
#endif
    if (nouveauBattement) {
      tDernierBattementAff = millis();                     // FS5 : le coeur "bat"
      if (bpmSimule == 0) fs4_beep(classer(bpm, bpmValide));  // FS4 : ET4.1
#if SORTIE_SERIE == 1
      battementAff = true;
#endif
      nouveauBattement = false;
    }
#if SORTIE_SERIE == 1
    if (nbAff >= PTS_PAR_AFFICHAGE) {
      afficherPoint();
      sommeAff = 0;
      nbAff = 0;
      battementAff = false;
    }
#endif
  }

  // ---- FS3 : voyants -------------------------------------------------------------
  float f; bool valide;
  if (bpmSimule > 0) { f = bpmSimule; valide = (f >= BPM_MIN && f <= BPM_MAX); }
  else               { f = bpm;       valide = bpmValide; }
  EtatCardiaque e = classer(f, valide);
  fs3_afficher(e);

  // ---- FS4 : bouton marche / arrêt et beeps simulés ------------------------------
  if (bouton_appui(boutonBeep)) {
    beepActif = !beepActif;
    if (!beepActif) noTone(PIN_BUZZER);
    Serial.println(beepActif ? F("Beep : MARCHE") : F("Beep : ARRET"));
  }
  if (bpmSimule > 0 && millis() - tBeepSimule >= 60000UL / bpmSimule) {
    tBeepSimule = millis();
    fs4_beep(classer(bpmSimule, bpmSimule >= BPM_MIN && bpmSimule <= BPM_MAX));
  }

  // ---- FS5 : encodeur et écrans --------------------------------------------------
  int16_t pas = encodeur_lire();
  if (pas != 0) {
    int8_t n = constrain((int8_t)idxEchelle + pas, 0, NB_ECHELLES - 1);
    if (n != idxEchelle) { idxEchelle = n; courbe_vider(); }
  }
  if (bouton_appui(boutonEncodeur) && idxEchelle != ECHELLE_DEFAUT) {
    idxEchelle = ECHELLE_DEFAUT;
    courbe_vider();
  }
  // Écran 2 toutes les 60 ms, écran 1 toutes les 200 ms (~25 ms par image :
  // l'échantillonnage continue pendant ce temps grâce au Timer1 et à la FIFO).
  static uint32_t t1 = 0, t2 = 0;
  if (millis() - t2 >= 60)       { t2 = millis(); afficherEcran2(); }
  else if (millis() - t1 >= 200) { t1 = millis(); afficherEcran1(); }

  // ---- FS2 + résumé : une fois par seconde ---------------------------------------
#if SORTIE_SERIE == 0
  unsigned long temp_actuel = millis();
  if (temp_actuel - temps_precedent >= 1000) {
    temps_precedent = temp_actuel;
    calculTime();
    Serial.print(bpmSimule > 0 ? F("[simu] ") : F("[capteur] "));
    Serial.print(f, 0);
    Serial.print(F(" bpm -> "));
    if (e == ETAT_FAIBLE)      Serial.print(F("JAUNE (faible)"));
    else if (e == ETAT_NORMAL) Serial.print(F("VERTE (normal)"));
    else if (e == ETAT_ELEVE)  Serial.print(F("ROUGE (eleve)"));
    else                       Serial.print(F("aucune LED"));
    if (bpmSimule == 0) {
      if (capteurSature)      Serial.print(F(" | capteur sature"));
      else if (perturbation)  Serial.print(F(" | recalage lumiere"));
      else if (!doigtPresent) Serial.print(F(" | pas de doigt"));
    }
    Serial.println(beepActif ? F(" | beep ON") : F(" | beep OFF"));
  }
#endif

  // ---- Commande de test : S <bpm> ------------------------------------------------
  if (lireLigneSerie() && (ligne[0] == 'S' || ligne[0] == 's')) {
    bpmSimule = atoi(ligne + 1);
    if (bpmSimule < 0) bpmSimule = 0;
    Serial.print(F("Simulation : "));
    Serial.println(bpmSimule);
  }
}
