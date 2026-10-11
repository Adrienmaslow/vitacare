/*
 * CARDIO ECE - FS1 à FS6 (version 8) - Arduino Uno
 * Bibliothèque : Adafruit SSD1306 (+ GFX et BusIO)
 *
 * Câblage :
 *   Broche   Signal      Type                              Composant
 *   A0        PPG         entrée analogique                 WPSE340 (fil S)
 *   D5        BUZZER      sortie (signal carré, tone())     buzzer passif
 *   A4 / A5   SDA / SCL   bus I2C                           OLED 0x3C et 0x3D
 *   D2        ENC_CLK     entrée, interruption INT0         encodeur
 *   D8        ENC_DT      entrée, interruption PCINT0       encodeur
 *   D7        ENC_SW      entrée, pull-up interne           bouton encodeur
 *   D4        BTN_SON     entrée, pull-up interne           bouton son (FS4)
 *   D3        BTN_SAVE    entrée, pull-up interne           bouton enregistrer (FS6)
 *   D13       RTC_CE      sortie                            DS1302 (RST/CE)
 *   A3        RTC_IO      entrée/sortie                     DS1302 (DAT)
 *   A2        RTC_SCLK    sortie                            DS1302 (CLK)
 *   D10/11/12 LED_J/V/R   sorties, via 220 ohm              LED jaune / verte / rouge
 *   Boutons entre la broche et GND (appuyé = LOW).
 *
 * Timers : Timer0 = millis(), Timer1 = FS1 (1 kHz), Timer2 = tone().
 *
 * Moniteur série 115200, fin de ligne "Nouvelle ligne" :
 *     S 45                     -> simule 45 bpm (LED, beeps, écran 1)
 *     S 0                      -> retour au capteur
 *     H 11/10/2026 15:30:00    -> règle l'horloge (jj/mm/aaaa hh:mm:ss)
 *     M                        -> liste les mesures enregistrées (FS6)
 * MODE_SERIE 0 = résumé texte chaque seconde, 1 = traceur série
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define MODE_SERIE 0

// noinline : sinon LTO fusionne tout dans loop() et la pile mange la RAM
// dont les OLED ont besoin
#define NOINLINE __attribute__((noinline))

// Types déclarés ici à cause des prototypes générés par l'IDE
enum EtatCardiaque { ETAT_INCONNU, ETAT_FAIBLE, ETAT_NORMAL, ETAT_ELEVE };

struct Bouton {
  uint8_t  pin;
  bool     etatStable;
  bool     dernierLu;
  uint16_t tChange;
};

struct DateHeure {
  uint8_t  sec, min, heure, jour, mois;
  uint16_t annee;
};

// ===================== FS1 : capter le rythme cardiaque =====================
// CAN lu à 1 kHz, moyenne sur 20 ms (enlève le 50/100 Hz des lampes), puis :
// lissage, recentrage, normalisation [-1;1], seuil, BPM = médiane des 5
// derniers intervalles. Pas de bibliothèque de détection.
const uint8_t  PIN_CAPTEUR      = A0;
const uint8_t  PERIODE_ECH_MS   = 10;
const uint8_t  MESURES_PAR_ECH  = 10;
const uint8_t  FENETRE_ANTI_SCINT = 20;    // 20 ms
const uint16_t SATURATION_BAS   = 5;
const uint16_t SATURATION_HAUT  = 1018;
const uint8_t  SATURATION_MAINTIEN = 50;   // 0,5 s
const float    SEUIL_PERTURB    = 1.0;
const uint16_t GEL_MS           = 400;
const uint16_t REPRISE_MS       = 1500;
const uint8_t  N_MOYENNE        = 25;      // 25 x 40 ms = 1 s
const uint8_t  ECH_PAR_POINT    = 4;
const float    ALPHA_LISSAGE    = 0.2;
const float    OUBLI_ENV        = 0.003;
const float    AMPLITUDE_MIN    = 4.0;     // doigt détecté
const float    AMPLITUDE_PERTE  = 2.5;     // doigt parti
const float    SEUIL_HAUT       = 0.4;
const float    SEUIL_BAS        = -0.4;
const uint16_t REFRACTAIRE_MS   = 300;
const uint8_t  REFRACTAIRE_PCT  = 40;      // à 50 % le BPM restait bloqué à la moitié
const uint8_t  BPM_MIN          = 40;
const uint8_t  BPM_MAX          = 200;
const uint16_t TIMEOUT_MS       = 2500;
const uint8_t  N_IBI            = 5;
const uint8_t  ECART_MIN_PCT    = 70;      // trop court = faux battement
const uint8_t  ECART_MAX_PCT    = 160;     // trop long = battement raté
const uint8_t  MAX_REJETS       = 3;

// FIFO remplie par l'ISR, vidée par loop(). Somme sur 20 ms, bit 15 = saturé
const uint8_t     TAILLE_FIFO = 8;         // 80 ms, un rafraîchissement OLED prend ~25 ms
const uint16_t    BIT_SATURE  = 0x8000;
volatile uint16_t fifoEch[TAILLE_FIFO];
volatile uint8_t  fifoEcriture = 0;
volatile uint8_t  fifoLecture  = 0;

uint16_t sommeBloc = 0, sommeBlocPrec = 0;
uint8_t  nbBloc = 0;
bool     satBloc = false, satBlocPrec = false;
bool     premierBloc = true;

void fs1_acquerir(uint16_t adc) {
  sommeBloc += adc;
  if (adc <= SATURATION_BAS || adc >= SATURATION_HAUT) satBloc = true;
  if (++nbBloc < MESURES_PAR_ECH) return;

  // somme sur 20 ms = ce bloc + le précédent
  if (!premierBloc) {
    uint16_t mot = sommeBloc + sommeBlocPrec;
    if (satBloc || satBlocPrec) mot |= BIT_SATURE;
    uint8_t suivant = (fifoEcriture + 1) % TAILLE_FIFO;
    if (suivant != fifoLecture) {          // FIFO pleine : échantillon perdu
      fifoEch[fifoEcriture] = mot;
      fifoEcriture = suivant;
    }
  }
  premierBloc = false;
  sommeBlocPrec = sommeBloc; satBlocPrec = satBloc;
  sommeBloc = 0; nbBloc = 0; satBloc = false;
}

ISR(TIMER1_COMPA_vect) {                   // 1 kHz
  uint16_t adc = ADC;                      // conversion lancée au tour d'avant
  ADCSRA |= (1 << ADSC);
  fs1_acquerir(adc);
}

uint32_t numeroEch = 0;                    // t = numeroEch x 10 ms
int16_t  bufferMoy[N_MOYENNE];             // signal lissé x16
uint8_t  idxMoy = 0, nbEchMoy = 0;
int32_t  sommeMoy = 0;
int32_t  sommePoint = 0;
uint8_t  nbPoint = 0;
float    signalLisse = -1;                 // -1 = pas encore initialisé
float    lissage1 = 0;
float    envHaut = 0, envBas = 0;          // min/max récents
float    envBrutHaut = 0, envBrutBas = 0;  // pareil sur le brut (sauts de lumière)
float    ecartAvantPerturb = 0;
bool     arme = true;
bool     battementVu = false;
uint32_t tDernierBattement = 0;
uint16_t ibi[N_IBI];                       // intervalles en ms
uint8_t  idxIbi = 0, nbIbi = 0;
uint8_t  nbRejets = 0;
uint16_t intervalleTot = 0;                // dernière bosse rejetée "trop tôt"
uint8_t  nbDoubles = 0;
uint32_t tFinGel = 0, tFinReprise = 0;
uint8_t  compteurSat = 0;

// Sorties de FS1
float    signalRecentre   = 0;
float    signalNorm       = 0;
float    bpm              = 0;
bool     bpmValide        = false;
bool     doigtPresent     = false;
bool     nouveauBattement = false;         // remis à false par celui qui le lit
bool     capteurSature    = false;
bool     perturbation     = false;

uint32_t fs1_tempsMs() { return numeroEch * PERIODE_ECH_MS; }

void fs1_init() {
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1  = 0;
  OCR1A  = 249;                                        // 16 MHz / 64 / 250 = 1 kHz
  TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10);   // mode CTC, prédiviseur 64
  TIMSK1 = (1 << OCIE1A);
  // CAN : réf. 5 V, entrée A0, horloge 125 kHz
  ADMUX  = (1 << REFS0) | ((PIN_CAPTEUR - A0) & 0x07);
  ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);
  ADCSRA |= (1 << ADSC);
  interrupts();
}

NOINLINE void fs1_reinitialiserBpm() {
  nbIbi = 0;
  idxIbi = 0;
  nbRejets = 0;
  intervalleTot = 0;
  nbDoubles = 0;
  bpm = 0;
  bpmValide = false;
  battementVu = false;
}

NOINLINE uint16_t fs1_medianeIbi() {
  uint16_t tri[N_IBI];
  for (uint8_t i = 0; i < nbIbi; i++) tri[i] = ibi[i];
  for (uint8_t i = 1; i < nbIbi; i++) {          // tri insertion
    uint16_t v = tri[i];
    int8_t k = i - 1;
    while (k >= 0 && tri[k] > v) { tri[k + 1] = tri[k]; k--; }
    tri[k + 1] = v;
  }
  if (nbIbi % 2) return tri[nbIbi / 2];
  return (tri[nbIbi / 2 - 1] + tri[nbIbi / 2]) / 2;
}

// fiable si au moins 3 intervalles à ±20 % de la médiane
NOINLINE bool fs1_coherent(uint16_t mediane) {
  uint8_t proches = 0;
  for (uint8_t i = 0; i < nbIbi; i++) {
    int32_t d = (int32_t)ibi[i] - mediane;
    if (d < 0) d = -d;
    if (d * 5 <= mediane) proches++;
  }
  return proches >= 3;
}

NOINLINE void fs1_calculerBpm() {
  if (nbIbi < 3) { bpmValide = false; return; }
  uint16_t m = fs1_medianeIbi();
  bpm = 60000.0 / m;
  bpmValide = fs1_coherent(m) && bpm >= BPM_MIN && bpm <= BPM_MAX;
}

NOINLINE void fs1_recalerBase() {
  int16_t v16 = (int16_t)(signalLisse * 16);
  for (uint8_t i = 0; i < N_MOYENNE; i++) bufferMoy[i] = v16;
  sommeMoy = (int32_t)v16 * N_MOYENNE;
  nbEchMoy = N_MOYENNE;
  sommePoint = (int32_t)v16 * nbPoint;
}

NOINLINE void fs1_traiter(uint16_t mot) {
  numeroEch++;
  uint32_t t = fs1_tempsMs();
  float brut = (mot & ~BIT_SATURE) / (float)FENETRE_ANTI_SCINT;

  if (mot & BIT_SATURE) compteurSat = SATURATION_MAINTIEN;
  else if (compteurSat > 0) compteurSat--;
  capteurSature = compteurSat > 0;

  // lissage : 2 passe-bas en cascade
  if (signalLisse < 0) { signalLisse = brut; lissage1 = brut; }
  lissage1    += ALPHA_LISSAGE * (brut - lissage1);
  signalLisse += ALPHA_LISSAGE * (lissage1 - signalLisse);

  // moyenne glissante sur 1 s, un point toutes les 40 ms pour garder de la RAM
  int16_t v16 = (int16_t)(signalLisse * 16);
  sommePoint += v16;
  if (++nbPoint >= ECH_PAR_POINT) {
    int16_t point = sommePoint / ECH_PAR_POINT;
    sommePoint = 0;
    nbPoint = 0;
    if (nbEchMoy == N_MOYENNE) sommeMoy -= bufferMoy[idxMoy];
    else                       nbEchMoy++;
    bufferMoy[idxMoy] = point;
    sommeMoy += point;
    idxMoy = (idxMoy + 1) % N_MOYENNE;
  }
  float moyenne = nbEchMoy ? (float)sommeMoy / (16.0 * nbEchMoy) : signalLisse;

  // recentrage (enlève la dérive)
  signalRecentre = signalLisse - moyenne;

  if (capteurSature) {
    doigtPresent = false;
    perturbation = false;
    signalNorm = 0;
    envHaut = envBas = 0;
    fs1_reinitialiserBpm();
    return;
  }

  // changement brusque de lumière -> on gèle un moment
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

  // normalisation entre min et max récents
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
    if (t >= tFinReprise) fs1_reinitialiserBpm();
    return;
  }
  signalNorm = 2.0 * (signalRecentre - envBas) / ecart - 1.0;

  // détection : seuil + hystérésis + période réfractaire
  uint32_t refractaire = REFRACTAIRE_MS;
  if (bpmValide) {
    uint32_t r = 60000.0 / bpm * REFRACTAIRE_PCT / 100;
    if (r > refractaire) refractaire = r;
  }
  if (arme && signalNorm > SEUIL_HAUT &&
      (!battementVu || t - tDernierBattement > refractaire)) {
    arme = false;

    if (!battementVu) {
      battementVu = true;
      tDernierBattement = t;
      nouveauBattement = true;
      return;
    }
    uint32_t intervalle = t - tDernierBattement;
    uint16_t ref = bpmValide ? fs1_medianeIbi() : 0;

    if (ref && intervalle * 100 < (uint32_t)ref * ECART_MIN_PCT && nbRejets < MAX_REJETS) {
      nbRejets++;                          // 2e bosse du pouls ou mouvement
      intervalleTot = intervalle;
      return;
    }
    nouveauBattement = true;
    tDernierBattement = t;

    bool horsPlage = intervalle < 60000UL / BPM_MAX || intervalle > 60000UL / BPM_MIN;
    bool rate = ref && intervalle * 100 > (uint32_t)ref * ECART_MAX_PCT;
    if (horsPlage || (rate && nbRejets < MAX_REJETS)) {
      nbRejets++;
      return;
    }
    // rythme doublé : la bosse "trop tôt" était un vrai battement. Sans ça le
    // BPM restait bloqué à la moitié.
    int32_t ecartDouble = (int32_t)intervalle - 2 * (int32_t)intervalleTot;
    if (ecartDouble < 0) ecartDouble = -ecartDouble;
    bool rythmeDouble = intervalleTot && ecartDouble * 5 <= (int32_t)intervalle;
    intervalleTot = 0;
    if (rythmeDouble) nbDoubles++;
    else              nbDoubles = 0;
    if (nbDoubles >= MAX_REJETS) {         // on repart sur le nouveau rythme
      nbDoubles = 0;
      nbRejets = 0;
      nbIbi = 0;
      idxIbi = 0;
      bpmValide = false;
      return;
    }
    if (nbRejets >= MAX_REJETS) {          // le rythme a vraiment changé
      nbIbi = 0;
      idxIbi = 0;
    }
    nbRejets = 0;
    ibi[idxIbi] = intervalle;
    idxIbi = (idxIbi + 1) % N_IBI;
    if (nbIbi < N_IBI) nbIbi++;
    fs1_calculerBpm();
  }
  if (!arme && signalNorm < SEUIL_BAS) arme = true;
}

bool fs1_update() {
  if (fifoLecture == fifoEcriture) return false;
  uint16_t v = fifoEch[fifoLecture];
  fifoLecture = (fifoLecture + 1) % TAILLE_FIFO;
  fs1_traiter(v);
  return true;
}

// Classement : < 60 faible, 60-100 normal, > 100 élevé
const uint8_t BPM_BAS  = 60;
const uint8_t BPM_HAUT = 100;

EtatCardiaque classer(float f, bool valide) {
  if (!valide)       return ETAT_INCONNU;
  if (f < BPM_BAS)   return ETAT_FAIBLE;
  if (f > BPM_HAUT)  return ETAT_ELEVE;
  return ETAT_NORMAL;
}

// Boutons avec anti-rebond (appuyé = LOW)
const uint8_t ANTI_REBOND_MS = 20;

void bouton_init(Bouton &b, uint8_t pin) {
  b.pin = pin;
  pinMode(pin, INPUT_PULLUP);
  b.etatStable = b.dernierLu = digitalRead(pin);
  b.tChange = millis();
}

bool bouton_appui(Bouton &b) {
  bool lu = digitalRead(b.pin);
  if (lu != b.dernierLu) { b.dernierLu = lu; b.tChange = millis(); }
  if ((uint16_t)((uint16_t)millis() - b.tChange) >= ANTI_REBOND_MS && lu != b.etatStable) {
    b.etatStable = lu;
    return lu == LOW;
  }
  return false;
}

// Série "légère" à 115200 : Serial prend trop de RAM avec le buffer des OLED,
// donc on pilote l'USART à la main. Ne pas utiliser Serial en plus.
class SerieLegere : public Print {
public:
  void begin() {
    UBRR0  = 16;                                     // 115200 bauds avec U2X0
    UCSR0A = (1 << U2X0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);          // 8N1
    UCSR0B = (1 << RXEN0) | (1 << TXEN0) | (1 << RXCIE0);
  }
  size_t write(uint8_t c) override {
    while (!(UCSR0A & (1 << UDRE0))) {}
    UDR0 = c;
    return 1;
  }
};
SerieLegere Serie;

const uint8_t     TAILLE_LIGNE = 22;      // "H 11/10/2026 15:30:00" = 21 caractères
char              ligne[TAILLE_LIGNE];
volatile uint8_t  lgLigne = 0;
volatile bool     ligneRecue = false;

ISR(USART_RX_vect) {
  char c = UDR0;
  if (ligneRecue) return;                // précédente pas encore traitée
  if (c == '\n' || c == '\r') {
    if (lgLigne > 0) { ligne[lgLigne] = 0; lgLigne = 0; ligneRecue = true; }
  } else if (lgLigne < TAILLE_LIGNE - 1) {
    ligne[lgLigne++] = c;
  }
}

// true si une ligne complète est dans "ligne"
bool lireLigneSerie() {
  if (!ligneRecue) return false;
  ligneRecue = false;
  return true;
}

// ===================== FS2 : compter le temps (DS1302) ======================
// Pilote fait main, protocole 3 fils, bit de poids faible en premier.
const uint8_t PIN_RTC_CLK = A2;
const uint8_t PIN_RTC_DAT = A3;
const uint8_t PIN_RTC_RST = 13;
bool rtcPresente = false;          // sinon on utilise l'horloge interne

uint8_t bcdVersDec(uint8_t b) { return (b >> 4) * 10 + (b & 0x0F); }
uint8_t decVersBcd(uint8_t d) { return ((d / 10) << 4) | (d % 10); }

// Même timing que virtuabotixRTC : en lecture, IO est relâché après le
// dernier bit de la commande et chaque bit se lit après le front descendant
void ds_ecrireOctet(uint8_t v, bool lectureEnsuite) {
  pinMode(PIN_RTC_DAT, OUTPUT);
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(PIN_RTC_DAT, v & 1);
    v >>= 1;
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_CLK, HIGH);
    delayMicroseconds(1);
    if (lectureEnsuite && i == 7) {
      pinMode(PIN_RTC_DAT, INPUT);
    } else {
      digitalWrite(PIN_RTC_CLK, LOW);
      delayMicroseconds(1);
    }
  }
}

uint8_t ds_lireOctet() {
  uint8_t v = 0;
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(PIN_RTC_CLK, HIGH);
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_CLK, LOW);
    delayMicroseconds(1);
    if (digitalRead(PIN_RTC_DAT)) v |= (1 << i);
  }
  return v;
}

void ds_debut() {
  digitalWrite(PIN_RTC_RST, LOW);  pinMode(PIN_RTC_RST, OUTPUT);
  digitalWrite(PIN_RTC_CLK, LOW);  pinMode(PIN_RTC_CLK, OUTPUT);
  pinMode(PIN_RTC_DAT, OUTPUT);
  digitalWrite(PIN_RTC_RST, HIGH);
  delayMicroseconds(4);
}
void ds_fin() { digitalWrite(PIN_RTC_RST, LOW); delayMicroseconds(4); }

void ds_ecrireRegistre(uint8_t cmd, uint8_t v) {
  ds_debut(); ds_ecrireOctet(cmd, false); ds_ecrireOctet(v, false); ds_fin();
}
uint8_t ds_lireRegistre(uint8_t cmd) {
  ds_debut(); ds_ecrireOctet(cmd | 1, true); uint8_t v = ds_lireOctet(); ds_fin(); return v;
}

// Test de présence : on écrit/relit la RAM du DS1302. Mal câblé, on lit
// 0xFF partout (d'où le "45:85:85")
NOINLINE bool rtc_repond() {
  ds_ecrireRegistre(0x8E, 0x00);                // WP = 0
  ds_ecrireRegistre(0xC0, 0xA5);
  bool ok = ds_lireRegistre(0xC1) == 0xA5;
  ds_ecrireRegistre(0xC0, 0x5A);
  ok = ok && ds_lireRegistre(0xC1) == 0x5A;
  ds_ecrireRegistre(0x8E, 0x80);                // WP = 1
  return ok;
}

// bit CH = 1 : horloge arrêtée (jamais réglée ou pile vide)
bool rtc_estArretee() { return ds_lireRegistre(0x81) & 0x80; }

bool dateValide(const DateHeure &d) {
  return d.sec < 60 && d.min < 60 && d.heure < 24 &&
         d.jour >= 1 && d.jour <= 31 && d.mois >= 1 && d.mois <= 12;
}

// Horloge de secours avec millis() si pas de DS1302 (perdue à la coupure)
DateHeure hlBase;
uint32_t  hlMillis = 0;

const uint8_t JOURS_MOIS[12] PROGMEM = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };

void horlogeInterne_regler(const DateHeure &d) { hlBase = d; hlMillis = millis(); }

NOINLINE void horlogeInterne_lire(DateHeure &d) {
  d = hlBase;
  uint32_t s = (millis() - hlMillis) / 1000 + d.sec + 60UL * (d.min + 60UL * d.heure);
  uint16_t jours = s / 86400UL;
  s %= 86400UL;
  d.heure = s / 3600; d.min = (s / 60) % 60; d.sec = s % 60;
  while (jours--) {
    uint8_t n = pgm_read_byte(&JOURS_MOIS[d.mois - 1]);
    if (d.mois == 2 && d.annee % 4 == 0) n = 29;
    if (++d.jour > n) { d.jour = 1; if (++d.mois > 12) { d.mois = 1; d.annee++; } }
  }
}

// Lecture en rafale. Si le DS1302 ne répond pas, on prend l'horloge interne.
NOINLINE bool rtc_lire(DateHeure &d) {
  if (rtcPresente) {
    uint8_t r[7];
    ds_debut();
    ds_ecrireOctet(0xBF, true);
    for (uint8_t i = 0; i < 7; i++) r[i] = ds_lireOctet();
    ds_fin();
    d.sec   = bcdVersDec(r[0] & 0x7F);
    d.min   = bcdVersDec(r[1] & 0x7F);
    d.heure = bcdVersDec(r[2] & 0x3F);
    d.jour  = bcdVersDec(r[3] & 0x3F);
    d.mois  = bcdVersDec(r[4] & 0x1F);
    d.annee = 2000 + bcdVersDec(r[6]);
    if (dateValide(d)) return true;
  }
  horlogeInterne_lire(d);
  return true;
}

NOINLINE void rtc_regler(const DateHeure &d) {
  horlogeInterne_regler(d);
  if (!rtcPresente) return;
  ds_ecrireRegistre(0x8E, 0x00);          // WP = 0
  ds_debut();
  ds_ecrireOctet(0xBE, false);            // écriture en rafale
  ds_ecrireOctet(decVersBcd(d.sec) & 0x7F, false);   // CH = 0 : l'horloge démarre
  ds_ecrireOctet(decVersBcd(d.min), false);
  ds_ecrireOctet(decVersBcd(d.heure), false);
  ds_ecrireOctet(decVersBcd(d.jour), false);
  ds_ecrireOctet(decVersBcd(d.mois), false);
  ds_ecrireOctet(1, false);                          // jour de semaine, pas utilisé
  ds_ecrireOctet(decVersBcd(d.annee - 2000), false);
  ds_ecrireOctet(0x80, false);                       // WP = 1
  ds_fin();
}

// __DATE__ = "Oct  8 2026", __TIME__ = "10:32:05"
NOINLINE DateHeure dateCompilation() {
  static const char MOIS[] PROGMEM = "JanFebMarAprMayJunJulAugSepOctNovDec";
  DateHeure d;
  d.mois = 1;
  for (uint8_t i = 0; i < 12; i++)
    if (strncmp_P(__DATE__, MOIS + 3 * i, 3) == 0) d.mois = i + 1;
  d.jour  = atoi(__DATE__ + 4);
  d.annee = atoi(__DATE__ + 7);
  d.heure = atoi(__TIME__);
  d.min   = atoi(__TIME__ + 3);
  d.sec   = atoi(__TIME__ + 6);
  return d;
}

// ET2.3 : on ne règle le DS1302 que s'il est arrêté ou incohérent, sinon on
// garde l'heure maintenue par la pile
NOINLINE void rtc_demarrer() {
  horlogeInterne_regler(dateCompilation());
  rtcPresente = rtc_repond();
  if (!rtcPresente) {
    Serie.println(F("! DS1302 introuvable (SCLK->A2, IO->A3, CE->D13) : horloge interne"));
    return;
  }
  Serie.println(F("DS1302 detecte (SCLK->A2, IO->A3, CE->D13)"));
  DateHeure d;
  bool ok = !rtc_estArretee();
  if (ok) {
    rtc_lire(d);
    ok = dateValide(d) && d.annee >= 2024;
  }
  if (!ok) {
    rtc_regler(dateCompilation());
    Serie.println(F("Horloge reglee a l'heure de compilation"));
  } else {
    horlogeInterne_regler(d);
  }
}

// Commande "H jj/mm/aaaa hh:mm:ss" (pas de sscanf, trop gros en flash)
NOINLINE bool rtc_reglerDepuisTexte(const char *s) {
  int v[6];
  for (uint8_t i = 0; i < 6; i++) {
    while (*s && (*s < '0' || *s > '9')) s++;
    if (!*s) return false;
    v[i] = 0;
    while (*s >= '0' && *s <= '9') v[i] = v[i] * 10 + (*s++ - '0');
  }
  if (v[0] < 1 || v[0] > 31 || v[1] < 1 || v[1] > 12 || v[2] < 2000 || v[2] > 2099 ||
      v[3] > 23 || v[4] > 59 || v[5] > 59) return false;
  DateHeure d;
  d.jour = v[0]; d.mois = v[1]; d.annee = v[2]; d.heure = v[3]; d.min = v[4]; d.sec = v[5];
  rtc_regler(d);
  return true;
}

// print(int) prend 33 octets de pile, trop pour nous
NOINLINE void printEntier(Print &p, uint16_t n) {
  char c[5];
  uint8_t i = 0;
  do { c[i++] = '0' + n % 10; n /= 10; } while (n && i < 5);
  while (i) p.print(c[--i]);
}

// nombre sur 2 chiffres : 07, 15...
void print2(Print &p, uint8_t n) {
  p.print((char)('0' + n / 10));
  p.print((char)('0' + n % 10));
}

void printHeure(Print &p, const DateHeure &d) {
  print2(p, d.heure); p.print(':');
  print2(p, d.min);   p.print(':');
  print2(p, d.sec);
}

// ===================== FS3 : LED d'état =====================================
// Une seule LED à la fois, aucune si la mesure est aberrante
const uint8_t PIN_LED_JAUNE = 10;   // faible
const uint8_t PIN_LED_VERTE = 11;   // normal
const uint8_t PIN_LED_ROUGE = 12;   // élevé

void fs3_init() {
  pinMode(PIN_LED_ROUGE, OUTPUT);
  pinMode(PIN_LED_JAUNE, OUTPUT);
  pinMode(PIN_LED_VERTE, OUTPUT);
}

NOINLINE void fs3_afficher(EtatCardiaque e) {
  digitalWrite(PIN_LED_ROUGE, e == ETAT_ELEVE);
  digitalWrite(PIN_LED_JAUNE, e == ETAT_FAIBLE);
  digitalWrite(PIN_LED_VERTE, e == ETAT_NORMAL);
}

// ===================== FS4 : beep =========================================
// Un beep par battement, 440/880/1760 Hz, bouton D4 = on/off.
// tone() est sur le Timer2 car le Timer1 sert à FS1.
const uint8_t  PIN_BUZZER  = 5;
const uint8_t  PIN_BOUTON  = 4;
const uint8_t  PIN_BTN_SAVE = 3;    // FS6
const uint16_t FREQ_GRAVE  = 440;
const uint16_t FREQ_MODERE = 880;
const uint16_t FREQ_AIGU   = 1760;
const uint8_t  DUREE_BEEP  = 60;      // ms

Bouton boutonBeep;
bool   beepActif = true;

void fs4_init() {
  bouton_init(boutonBeep, PIN_BOUTON);
  pinMode(PIN_BUZZER, OUTPUT);
}

void fs4_beep(EtatCardiaque e) {
  if (!beepActif || e == ETAT_INCONNU) return;
  uint16_t f = (e == ETAT_FAIBLE) ? FREQ_GRAVE : (e == ETAT_ELEVE) ? FREQ_AIGU : FREQ_MODERE;
  tone(PIN_BUZZER, f, DUREE_BEEP);
}

NOINLINE void fs4_gererBouton() {
  if (bouton_appui(boutonBeep)) {
    beepActif = !beepActif;
    if (!beepActif) noTone(PIN_BUZZER);
#if MODE_SERIE == 0
    Serie.println(beepActif ? F("Beep : MARCHE") : F("Beep : ARRET"));
#endif
  }
}

// Encodeur KY-040 : CLK sur INT0, DT sur PCINT0, même décodage pour les deux
const uint8_t PIN_ENC_CLK = 2;
const uint8_t PIN_ENC_DT  = 8;
const uint8_t PIN_ENC_SW  = 7;
const int8_t  SENS_ENCODEUR = 1;           // -1 pour inverser
const int8_t  TRANSITIONS_PAR_CRAN = 4;    // 2 si un cran compte double

volatile int16_t encPas = 0;
volatile int8_t  encAccu = 0;
volatile uint8_t encEtat = 0;

void encodeur_isr() {
  static const int8_t TABLE[16] PROGMEM = { 0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0 };
  uint8_t ab = (digitalRead(PIN_ENC_CLK) << 1) | digitalRead(PIN_ENC_DT);
  encEtat = ((encEtat << 2) | ab) & 0x0F;
  encAccu += (int8_t)pgm_read_byte(&TABLE[encEtat]);
  if (encAccu >= TRANSITIONS_PAR_CRAN)       { encPas++; encAccu = 0; }
  else if (encAccu <= -TRANSITIONS_PAR_CRAN) { encPas--; encAccu = 0; }
}

ISR(PCINT0_vect) { encodeur_isr(); }

void encodeur_init() {
  pinMode(PIN_ENC_CLK, INPUT_PULLUP);
  pinMode(PIN_ENC_DT,  INPUT_PULLUP);
  encEtat = (digitalRead(PIN_ENC_CLK) << 1) | digitalRead(PIN_ENC_DT);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_CLK), encodeur_isr, CHANGE);
  *digitalPinToPCMSK(PIN_ENC_DT) |= bit(digitalPinToPCMSKbit(PIN_ENC_DT));
  PCICR |= bit(digitalPinToPCICRbit(PIN_ENC_DT));
}

int16_t encodeur_lire() {
  noInterrupts();
  int16_t p = encPas;
  encPas = 0;
  interrupts();
  return SENS_ENCODEUR * p;
}

// ===================== FS5 : écrans OLED ===================================
// Un seul objet (un seul buffer de 1 Ko), on change juste l'adresse I2C
const uint8_t ADR_ECRAN_1 = 0x3C;
const uint8_t ADR_ECRAN_2 = 0x3D;

class EcransOLED : public Adafruit_SSD1306 {
public:
  EcransOLED() : Adafruit_SSD1306(128, 64, &Wire, -1) {}
  void choisirEcran(uint8_t adresse) { i2caddr = adresse; }

  // begin() sans le logo Adafruit (~1,2 Ko de flash, sinon ça ne rentre pas
  // sur un Nano old bootloader)
  bool commencer(uint8_t adresse) {
    if (!buffer && !(buffer = (uint8_t *)malloc(128 * 64 / 8))) return false;
    i2caddr  = adresse;
    vccstate = SSD1306_SWITCHCAPVCC;
    static const uint8_t PROGMEM INIT[] = {
      0xAE,             // éteint
      0xD5, 0x80,
      0xA8, 0x3F,       // 64 lignes
      0xD3, 0x00,
      0x40,
      0x8D, 0x14,       // pompe de charge
      0x20, 0x00,
      0xA1, 0xC8,       // orientation
      0xDA, 0x12,
      0x81, 0xCF,       // contraste
      0xD9, 0xF1,
      0xDB, 0x40,
      0xA4, 0xA6,
      0x2E,
      0xAF              // allumé
    };
    ssd1306_commandList(INIT, sizeof(INIT));
    return true;
  }
};
EcransOLED ecran;
bool ecran1Ok = false, ecran2Ok = false;

bool i2c_present(uint8_t adresse) {
  Wire.beginTransmission(adresse);
  return Wire.endTransmission() == 0;
}

// begin() d'Adafruit ne vérifie pas si l'écran est là, d'où le test I2C
NOINLINE bool oled_initEcran(uint8_t adresse) {
  Wire.begin();
#ifdef WIRE_HAS_TIMEOUT
  Wire.setWireTimeout(25000, true);           // évite de bloquer si l'I2C plante
#endif
  if (!i2c_present(adresse)) {
    Serie.print(F("! Ecran 0x")); Serie.print(adresse, HEX); Serie.println(F(" absent (cablage / adresse)"));
    return false;
  }
  if (!ecran.commencer(adresse)) {
    Serie.println(F("! RAM insuffisante pour le buffer des ecrans"));
    return false;
  }
  ecran.clearDisplay();
  ecran.display();
  return true;
}

// Courbe PPG
const uint8_t  LARGEUR_COURBE = 100;
const uint8_t  X0_COURBE      = 24;
const uint8_t  Y_MILIEU       = 31;
const uint8_t  DEMI_HAUTEUR   = 20;
const uint8_t  ECHELLES_MS[] PROGMEM = { 10, 20, 40, 80 };    // ms par pixel
const uint8_t  NB_ECHELLES    = sizeof(ECHELLES_MS);
const uint8_t  ECHELLE_DEFAUT = 1;

int8_t  courbe[LARGEUR_COURBE];                // x 100
uint8_t idxCourbe = 0, nbPoints = 0;
uint8_t idxEchelle = ECHELLE_DEFAUT;
float   sommeDecim = 0;
uint8_t nbDecim = 0;

Bouton   boutonEncodeur;

void courbe_vider() {
  nbPoints = 0; idxCourbe = 0; sommeDecim = 0; nbDecim = 0;
}

NOINLINE void courbe_ajouter(float v) {
  sommeDecim += v;
  if (++nbDecim < pgm_read_byte(&ECHELLES_MS[idxEchelle]) / PERIODE_ECH_MS) return;
  int16_t p = (int16_t)(sommeDecim / nbDecim * 100);
  courbe[idxCourbe] = constrain(p, -100, 100);
  idxCourbe = (idxCourbe + 1) % LARGEUR_COURBE;
  if (nbPoints < LARGEUR_COURBE) nbPoints++;
  sommeDecim = 0; nbDecim = 0;
}

void dessinerCoeur(int16_t x, int16_t y, uint8_t r) {
  ecran.fillCircle(x - r, y, r, SSD1306_WHITE);
  ecran.fillCircle(x + r, y, r, SSD1306_WHITE);
  ecran.fillTriangle(x - 2 * r, y + 1, x + 2 * r, y + 1, x, y + 3 * r, SSD1306_WHITE);
}

// État partagé FS3/FS4/FS5 (capteur ou simulation)
int      bpmSimule = 0;            // 0 = capteur
uint32_t tBeepSimule = 0;
uint32_t tFlash = 0;               // dernier battement, pour le coeur

void frequenceCourante(float &f, bool &valide) {
  if (bpmSimule > 0) { f = bpmSimule; valide = (bpmSimule >= BPM_MIN && bpmSimule <= BPM_MAX); }
  else               { f = bpm;       valide = bpmValide; }
}

EtatCardiaque etatCourant() {
  float f; bool v;
  frequenceCourante(f, v);
  return classer(f, v);
}

// ===================== FS6 : enregistrer les mesures =======================
// Bouton D3 : moyenne des 10 BPM suivants + date/heure, gardée en EEPROM.
// Menu sur l'écran 2 avec l'encodeur, en FR ou EN.
// EEPROM : 0 signature, 1 langue, 2 nb, 3 prochain, puis 8 octets par mesure
// à partir de 8 (bpm, j, m, a-2000, h, min, s, 0). 100 max, on écrase le plus vieux.
#include <avr/eeprom.h>

const uint8_t  EE_SIGNATURE   = 0xCE;
const uint8_t  ADR_SIGNATURE  = 0;
const uint8_t  ADR_LANGUE     = 1;
const uint8_t  ADR_NB         = 2;
const uint8_t  ADR_PROCHAIN   = 3;
const uint8_t  ADR_DEBUT      = 8;
const uint8_t  TAILLE_ENREG   = 8;
const uint8_t  NB_MAX_ENREG   = 100;
const uint8_t  NB_MESURES_MOY = 10;
const uint16_t DELAI_MAX_ACQ  = 30000;   // abandon après 30 s
const uint16_t DELAI_MENU     = 30000;   // retour à la courbe

uint8_t langue = 0;                       // 0 = FR, 1 = EN
#define TXT(fr, en) (langue ? F(en) : F(fr))

uint8_t  nbEnreg = 0, prochainEnreg = 0;
bool     acqEnCours = false;
uint8_t  nbAcq = 0;
uint16_t sommeAcq = 0;
uint32_t tDebutAcq = 0;
uint8_t  msgFs6 = 0;                      // 1 = ok, 2 = échec
Bouton   boutonSave;

#define VUE_PPG     0
#define VUE_MENU    1
#define VUE_LISTE   2
#define VUE_EFFACER 3
const uint8_t NB_ITEMS_MENU = 4;
const uint8_t LIGNES_LISTE  = 5;
uint8_t  vue = VUE_PPG, menuSel = 0, listeHaut = 0, confirmSel = 0;
uint32_t tActiviteMenu = 0;

uint8_t eeLire(uint16_t a)             { return eeprom_read_byte((const uint8_t *)a); }
void    eeEcrire(uint16_t a, uint8_t v) { eeprom_update_byte((uint8_t *)a, v); }   // n'écrit que si ça change

void fs6_init() {
  bouton_init(boutonSave, PIN_BTN_SAVE);
  if (eeLire(ADR_SIGNATURE) != EE_SIGNATURE) {     // premier démarrage
    eeEcrire(ADR_LANGUE, 0);
    eeEcrire(ADR_NB, 0);
    eeEcrire(ADR_PROCHAIN, 0);
    eeEcrire(ADR_SIGNATURE, EE_SIGNATURE);
  }
  langue        = eeLire(ADR_LANGUE) ? 1 : 0;
  nbEnreg       = eeLire(ADR_NB);
  prochainEnreg = eeLire(ADR_PROCHAIN);
  if (nbEnreg > NB_MAX_ENREG || prochainEnreg >= NB_MAX_ENREG) { nbEnreg = 0; prochainEnreg = 0; }
}

// k = 0 : le plus récent
uint16_t fs6_adresse(uint8_t k) {
  uint8_t i = (prochainEnreg + NB_MAX_ENREG - 1 - k) % NB_MAX_ENREG;
  return ADR_DEBUT + (uint16_t)i * TAILLE_ENREG;
}

NOINLINE uint8_t fs6_lire(uint8_t k, DateHeure &d) {
  uint16_t a = fs6_adresse(k);
  d.jour  = eeLire(a + 1);
  d.mois  = eeLire(a + 2);
  d.annee = 2000 + eeLire(a + 3);
  d.heure = eeLire(a + 4);
  d.min   = eeLire(a + 5);
  d.sec   = eeLire(a + 6);
  return eeLire(a);
}

NOINLINE void fs6_enregistrer(uint8_t bpmMoyen) {
  DateHeure d;
  rtc_lire(d);
  uint16_t a = ADR_DEBUT + (uint16_t)prochainEnreg * TAILLE_ENREG;
  eeEcrire(a,     bpmMoyen);
  eeEcrire(a + 1, d.jour);
  eeEcrire(a + 2, d.mois);
  eeEcrire(a + 3, d.annee - 2000);
  eeEcrire(a + 4, d.heure);
  eeEcrire(a + 5, d.min);
  eeEcrire(a + 6, d.sec);
  eeEcrire(a + 7, 0);
  prochainEnreg = (prochainEnreg + 1) % NB_MAX_ENREG;
  if (nbEnreg < NB_MAX_ENREG) nbEnreg++;
  eeEcrire(ADR_PROCHAIN, prochainEnreg);    // index après les données
  eeEcrire(ADR_NB, nbEnreg);
}

void fs6_effacerTout() {
  nbEnreg = 0;
  prochainEnreg = 0;
  eeEcrire(ADR_NB, 0);
  eeEcrire(ADR_PROCHAIN, 0);
}

void fs6_message(uint8_t m) { msgFs6 = m; tDebutAcq = millis(); }   // tDebutAcq réutilisé

// appelée à chaque battement
NOINLINE void fs6_ajouterMesure() {
  if (!acqEnCours) return;
  float f; bool valide;
  frequenceCourante(f, valide);
  if (!valide) return;
  sommeAcq += (uint16_t)(f + 0.5);
  if (++nbAcq < NB_MESURES_MOY) return;
  acqEnCours = false;
  uint8_t moyenne = (sommeAcq + NB_MESURES_MOY / 2) / NB_MESURES_MOY;
  fs6_enregistrer(moyenne);
  fs6_message(1);
  if (beepActif) tone(PIN_BUZZER, 2000, 150);
  Serie.print(F("FS6 : enregistre "));
  Serie.print(moyenne);
  Serie.print(F(" bpm ("));
  Serie.print(nbEnreg);
  Serie.println(F(" en memoire)"));
}

NOINLINE void fs6_gererBouton() {
  if (bouton_appui(boutonSave) && !acqEnCours) {
    acqEnCours = true;
    nbAcq = 0;
    sommeAcq = 0;
    tDebutAcq = millis();
    msgFs6 = 0;
    Serie.println(F("FS6 : enregistrement en cours (10 mesures)"));
  }
  if (acqEnCours && millis() - tDebutAcq > DELAI_MAX_ACQ) {
    acqEnCours = false;
    fs6_message(2);
    Serie.println(F("FS6 : echec (pas assez de mesures valides)"));
  }
  if (vue != VUE_PPG && millis() - tActiviteMenu > DELAI_MENU) vue = VUE_PPG;
}

NOINLINE void fs6_naviguer(int16_t pas, bool clic) {
  if (pas || clic) tActiviteMenu = millis();
  if (vue == VUE_MENU) {
    menuSel = constrain((int16_t)menuSel + pas, 0, NB_ITEMS_MENU - 1);
    if (!clic) return;
    if (menuSel == 0)      { vue = VUE_LISTE; listeHaut = 0; }
    else if (menuSel == 1) { vue = VUE_EFFACER; confirmSel = 0; }
    else if (menuSel == 2) { langue = !langue; eeEcrire(ADR_LANGUE, langue); }
    else                   vue = VUE_PPG;
  } else if (vue == VUE_LISTE) {
    if (nbEnreg > LIGNES_LISTE)
      listeHaut = constrain((int16_t)listeHaut + pas, 0, nbEnreg - LIGNES_LISTE);
    if (clic) vue = VUE_MENU;
  } else if (vue == VUE_EFFACER) {
    confirmSel = constrain((int16_t)confirmSel + pas, 0, 1);
    if (clic) {
      if (confirmSel == 1) fs6_effacerTout();
      vue = VUE_MENU;
    }
  }
}

NOINLINE void fs6_afficherMenu() {
  ecran.clearDisplay();
  ecran.setTextSize(1);
  ecran.setTextColor(SSD1306_WHITE);
  ecran.setCursor(0, 0);
  if (vue == VUE_MENU) {
    ecran.print(F("MENU"));
    ecran.drawFastHLine(0, 10, 128, SSD1306_WHITE);
    for (uint8_t i = 0; i < NB_ITEMS_MENU; i++) {
      ecran.setCursor(0, 15 + i * 12);
      ecran.print(i == menuSel ? '>' : ' ');
      ecran.print(' ');
      if (i == 0)      { ecran.print(TXT("Consulter (", "View (")); printEntier(ecran, nbEnreg); ecran.print(')'); }
      else if (i == 1) ecran.print(TXT("Effacer tout", "Erase all"));
      else if (i == 2) ecran.print(TXT("Langue : FR", "Language : EN"));
      else             ecran.print(TXT("Retour", "Back"));
    }
  } else if (vue == VUE_LISTE) {
    ecran.print(TXT("Mesures : ", "Records: "));
    printEntier(ecran, nbEnreg);
    ecran.setCursor(106, 0);
    ecran.print(F("bpm"));
    ecran.drawFastHLine(0, 9, 128, SSD1306_WHITE);
    if (nbEnreg == 0) {
      ecran.setCursor(0, 30);
      ecran.print(TXT("Aucune mesure", "No record"));
    }
    for (uint8_t j = 0; j < LIGNES_LISTE && listeHaut + j < nbEnreg; j++) {
      DateHeure d;
      uint8_t k = listeHaut + j;
      uint8_t b = fs6_lire(k, d);
      uint8_t y = 13 + j * 10;
      ecran.setCursor(0, y);   printEntier(ecran, k + 1);
      ecran.setCursor(20, y);  print2(ecran, d.jour); ecran.print('/');
      print2(ecran, d.mois);   ecran.print('/'); print2(ecran, d.annee % 100);
      ecran.setCursor(72, y);  print2(ecran, d.heure); ecran.print(':'); print2(ecran, d.min);
      ecran.setCursor(106, y); printEntier(ecran, b);
    }
  } else {                                  // VUE_EFFACER
    ecran.print(TXT("Effacer ", "Erase "));
    printEntier(ecran, nbEnreg);
    ecran.print(TXT(" mesures ?", " records?"));
    ecran.drawFastHLine(0, 10, 128, SSD1306_WHITE);
    ecran.setCursor(0, 24);
    ecran.print(confirmSel == 0 ? F("> ") : F("  "));
    ecran.print(TXT("Non", "No"));
    ecran.setCursor(0, 38);
    ecran.print(confirmSel == 1 ? F("> ") : F("  "));
    ecran.print(TXT("Oui", "Yes"));
  }
  ecran.choisirEcran(ADR_ECRAN_2);
  ecran.display();
}

// commande "M"
NOINLINE void fs6_listerSerie() {
  Serie.print(F("FS6 : "));
  Serie.print(nbEnreg);
  Serie.println(F(" enregistrement(s), du plus recent au plus ancien"));
  for (uint8_t k = 0; k < nbEnreg; k++) {
    DateHeure d;
    uint8_t b = fs6_lire(k, d);
    Serie.print(k + 1); Serie.print(F(" : "));
    print2(Serie, d.jour); Serie.print('/'); print2(Serie, d.mois); Serie.print('/');
    printEntier(Serie, d.annee); Serie.print(' ');
    printHeure(Serie, d); Serie.print(F("  "));
    Serie.print(b); Serie.println(F(" bpm"));
  }
}

NOINLINE void signalerBattement() {
  tFlash = millis();
  fs4_beep(etatCourant());
  fs6_ajouterMesure();
}

// Écran 1 : heure + BPM
NOINLINE void afficherEcran1() {
  DateHeure d;
  rtc_lire(d);
  ecran.clearDisplay();
  ecran.setTextColor(SSD1306_WHITE);
  ecran.setTextSize(2);
  ecran.setCursor(16, 4);
  printHeure(ecran, d);
  if (!rtcPresente) {                         // * = horloge interne
    ecran.setTextSize(1);
    ecran.setCursor(120, 4);
    ecran.print('*');
  }
  ecran.drawFastHLine(0, 25, 128, SSD1306_WHITE);

  bool battementRecent = millis() - tFlash < 150;
  dessinerCoeur(18, 40, battementRecent ? 5 : 4);

  float f; bool valide;
  frequenceCourante(f, valide);
  ecran.setTextSize(3);
  ecran.setCursor(44, 34);
  if (valide) printEntier(ecran, (uint16_t)(f + 0.5));
  else        ecran.print('-');
  ecran.setTextSize(1);
  ecran.setCursor(102, 48);
  ecran.print(F("bpm"));
  if (!beepActif) { ecran.setCursor(100, 30); ecran.print(F("mute")); }
  if (bpmSimule > 0) { ecran.setCursor(100, 56); ecran.print(F("simu")); }
  ecran.setCursor(0, 57);                     // état FS6
  if (acqEnCours) {
    ecran.print(F("REC "));
    printEntier(ecran, nbAcq);
    ecran.print(F("/10"));
  } else if (msgFs6 && millis() - tDebutAcq < 2000) {
    ecran.print(msgFs6 == 1 ? TXT("Enregistre", "Saved") : TXT("Echec", "Failed"));
  }

  ecran.choisirEcran(ADR_ECRAN_1);
  ecran.display();
}

// Écran 2 : courbe PPG
NOINLINE void afficherEcran2() {
  if (vue != VUE_PPG) { fs6_afficherMenu(); return; }
  uint8_t msParPixel = pgm_read_byte(&ECHELLES_MS[idxEchelle]);
  const uint8_t xFin = X0_COURBE + LARGEUR_COURBE - 1;
  const uint8_t yAxe = Y_MILIEU + DEMI_HAUTEUR + 2;

  ecran.clearDisplay();
  ecran.setTextSize(1);
  ecran.setTextColor(SSD1306_WHITE);
  ecran.setCursor(0, 0);
  ecran.print(F("PPG"));
  ecran.setCursor(70, 0);
  printEntier(ecran, msParPixel);
  ecran.print(F("ms/px"));

  // axe vertical : +1, 0, -1
  ecran.drawFastVLine(X0_COURBE - 2, Y_MILIEU - DEMI_HAUTEUR, 2 * DEMI_HAUTEUR + 3, SSD1306_WHITE);
  for (int8_t k = -1; k <= 1; k++) {
    uint8_t y = Y_MILIEU - k * DEMI_HAUTEUR;
    ecran.drawFastHLine(X0_COURBE - 4, y, 3, SSD1306_WHITE);
    ecran.setCursor(k < 0 ? 6 : 12, y - 3);
    if (k < 0) ecran.print('-');
    ecran.print((char)('0' + (k < 0 ? -k : k)));
  }

  // axe du temps : trait tous les 25 px, texte tous les 50 px
  ecran.drawFastHLine(X0_COURBE - 2, yAxe, LARGEUR_COURBE + 2, SSD1306_WHITE);
  for (uint8_t k = 0; k <= 4; k++) {
    uint8_t x = X0_COURBE + k * 25;
    if (x > xFin) x = xFin;
    ecran.drawFastVLine(x, yAxe, 3, SSD1306_WHITE);
    if (k % 2 == 0) {
      uint8_t dixiemes = k * 25 * msParPixel / 100;
      ecran.setCursor(x - (k == 4 ? 12 : 3), 57);
      printEntier(ecran, dixiemes / 10);
      if (dixiemes % 10) { ecran.print('.'); ecran.print((char)('0' + dixiemes % 10)); }
    }
  }
  ecran.setCursor(xFin - 2, 57);
  ecran.print('s');

  if (capteurSature) {
    ecran.setCursor(X0_COURBE + 2, Y_MILIEU - 3);
    ecran.print(TXT("Trop de lumiere", "Too much light"));
  } else if (!doigtPresent) {
    ecran.setCursor(X0_COURBE + 8, Y_MILIEU - 3);
    ecran.print(TXT("Posez le doigt", "Place finger"));
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

// Sur la courbe : rotation = échelle, clic = menu
NOINLINE void fs5_gererEncodeur() {
  int16_t pas = encodeur_lire();
  bool clic = bouton_appui(boutonEncodeur);
  // debug encodeur
  if (clic) Serie.println(F("Encodeur : clic (D7)"));
  if (pas)  { Serie.print(F("Encodeur : rotation ")); Serie.println(pas); }
  if (vue != VUE_PPG) { fs6_naviguer(pas, clic); return; }
  if (pas != 0) {
    int16_t n = constrain((int16_t)idxEchelle + pas, 0, NB_ECHELLES - 1);
    if (n != idxEchelle) { idxEchelle = n; courbe_vider(); }
  }
  if (clic) {
    vue = VUE_MENU; menuSel = 0; tActiviteMenu = millis();
    Serie.println(F("Menu ouvert (ecran 2)"));
  }
}

// Au repos, CLK/DT/SW doivent être à HAUT. SW à BAS = mal câblé.
NOINLINE void diagnosticEncodeur() {
  static const uint8_t BROCHES[3] PROGMEM = { PIN_ENC_CLK, PIN_ENC_DT, PIN_ENC_SW };
  Serie.print(F("Encodeur au repos : CLK(D2)="));
  for (uint8_t i = 0; i < 3; i++) {
    if (i == 1) Serie.print(F(" DT(D8)="));
    if (i == 2) Serie.print(F(" SW(D7)="));
    Serie.print(digitalRead(pgm_read_byte(&BROCHES[i])) ? F("HAUT") : F("BAS"));
  }
  Serie.println();
  if (!digitalRead(PIN_ENC_SW))
    Serie.println(F("! SW(D7) est a BAS sans appui : verifier SW2->D7 et SW1->GND"));
}

// Sortie série
#if MODE_SERIE == 1
const uint8_t PTS_PAR_AFFICHAGE = 4;     // 40 ms
const float   LISSAGE_AFFICHAGE = 0.35;
float   courbeAff = 0, sommeAff = 0;
uint8_t nbAff = 0;
bool    battementAff = false;

NOINLINE void serie_point() {
  courbeAff += LISSAGE_AFFICHAGE * (signalNorm - courbeAff);
  sommeAff += courbeAff;
  if (++nbAff < PTS_PAR_AFFICHAGE) return;
  Serie.print(F("haut:200,bas:-120,pouls:"));
  Serie.print(sommeAff / nbAff * 100.0, 1);
  Serie.print(F(",seuil:"));
  Serie.print(SEUIL_HAUT * 100.0, 0);
  Serie.print(F(",battement:"));
  Serie.print(battementAff ? 150 : -120);
  Serie.print(F(",bpm:"));
  Serie.println(bpmValide ? bpm : 0, 0);
  sommeAff = 0; nbAff = 0; battementAff = false;
}
#else
NOINLINE void serie_resume() {
  DateHeure d;
  if (rtc_lire(d)) {
    print2(Serie, d.jour); Serie.print('/');
    print2(Serie, d.mois); Serie.print('/');
    printEntier(Serie, d.annee); Serie.print(' ');
    printHeure(Serie, d);  Serie.print(' ');
  } else {
    Serie.print(F("--/--/---- --:--:-- "));
  }

  float f; bool valide;
  frequenceCourante(f, valide);
  if (bpmSimule > 0)       Serie.print(F("[simu] "));
  else if (capteurSature)  Serie.print(F("Capteur sature : trop de lumiere "));
  else if (perturbation)   Serie.print(F("Changement de lumiere : recalage "));
  else if (!doigtPresent)  Serie.print(F("Pas de doigt "));
  else if (!valide)        Serie.print(F("Mesure en cours... "));
  if (valide) { Serie.print((int)(f + 0.5)); Serie.print(F(" bpm ")); }
  Serie.print(F("-> "));
  switch (classer(f, valide)) {
    case ETAT_FAIBLE: Serie.print(F("JAUNE (faible)")); break;
    case ETAT_NORMAL: Serie.print(F("VERTE (normal)")); break;
    case ETAT_ELEVE:  Serie.print(F("ROUGE (eleve)"));  break;
    default:          Serie.print(F("aucune LED"));     break;
  }
  Serie.println(beepActif ? F(" | beep ON") : F(" | beep OFF"));
}
#endif

NOINLINE void serie_commandes() {
  if (!lireLigneSerie()) return;
  char c = ligne[0];
  if (c == 'S' || c == 's') {
    bpmSimule = atoi(ligne + 1);
    if (bpmSimule < 0) bpmSimule = 0;
    tBeepSimule = millis();
    Serie.print(F("Simulation : "));
    Serie.println(bpmSimule);
  } else if (c == 'H' || c == 'h') {
    if (rtc_reglerDepuisTexte(ligne + 1))
      Serie.println(rtcPresente ? F("Horloge reglee") : F("Horloge interne reglee (DS1302 absent)"));
    else Serie.println(F("Format : H jj/mm/aaaa hh:mm:ss"));
  } else if (c == 'M' || c == 'm') {
    fs6_listerSerie();
  } else {
    Serie.println(F("Commandes : S <bpm> | S 0 | H jj/mm/aaaa hh:mm:ss | M"));
  }
}

// RAM libre entre le tas et la pile
int ramLibre() {
  extern int __heap_start, *__brkval;
  int v;
  return (int)&v - (__brkval == 0 ? (int)&__heap_start : (int)__brkval);
}

void setup() {
  Serie.begin();
  Serie.println(F("=== CARDIO ECE : FS1 a FS6 ==="));

  ecran1Ok = oled_initEcran(ADR_ECRAN_1);
  ecran2Ok = oled_initEcran(ADR_ECRAN_2);
  rtc_demarrer();
  fs6_init();
  fs3_init();
  fs4_init();
  encodeur_init();
  bouton_init(boutonEncodeur, PIN_ENC_SW);
  diagnosticEncodeur();
  fs1_init();                               // en dernier

  Serie.print(F("RAM libre : ")); Serie.print(ramLibre()); Serie.println(F(" octets"));
  Serie.println(F("Commandes : S <bpm> | S 0 | H jj/mm/aaaa hh:mm:ss | M"));
}

void loop() {
  while (fs1_update()) {
    courbe_ajouter(doigtPresent ? signalNorm : 0);
    if (nouveauBattement) {
      nouveauBattement = false;
      if (bpmSimule == 0) signalerBattement();
#if MODE_SERIE == 1
      battementAff = true;
#endif
    }
#if MODE_SERIE == 1
    serie_point();
#endif
  }

  // simulation
  if (bpmSimule > 0 && millis() - tBeepSimule >= 60000UL / bpmSimule) {
    tBeepSimule = millis();
    signalerBattement();
  }

  fs4_gererBouton();
  fs6_gererBouton();
  fs3_afficher(etatCourant());
  fs5_gererEncodeur();
  serie_commandes();

  // un seul écran par tour (~25 ms chacun) pour garder les boutons réactifs
  static uint32_t t1 = 0, t2 = 0;
  if (ecran2Ok && millis() - t2 >= 60)       { t2 = millis(); afficherEcran2(); }
  else if (ecran1Ok && millis() - t1 >= 200) { t1 = millis(); afficherEcran1(); }

#if MODE_SERIE == 0
  static uint32_t tResume = 0;
  if (millis() - tResume >= 1000) { tResume = millis(); serie_resume(); }
#endif
}
