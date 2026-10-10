/*
 * ===========================================================================
 *  CARDIO ECE — version UN SEUL FICHIER (Arduino Uno / Nano, ATmega328P)
 * ===========================================================================
 *  FS1 acquisition WPSE340 + calcul BPM (algorithme maison, sans bibliothèque BPM)
 *  FS2 horloge DS1302        FS3 LED jaune / verte / rouge
 *  FS4 buzzer 3 tonalités    FS5 deux OLED I2C (texte 0x3C + courbe 0x3D)
 *  FS6 historique EEPROM + menu FR/EN
 *
 *  Bibliothèque à installer : U8g2 (olikraus). Wire et EEPROM sont fournies.
 *  Console série 115200 bauds : STATUS, GET, SET AAAA-MM-JJ HH:MM:SS,
 *  PLOT 0|1|2 (arrêt / Serial Plotter / CSV), DUMP, ERASE YES.
 *  Premier démarrage : régler l'heure UNE fois avec SET.
 * ===========================================================================
 */
#include <Arduino.h>
#include <Wire.h>
#include <EEPROM.h>
#include <U8g2lib.h>
#include <avr/pgmspace.h>

// ===========================================================================
// CONFIGURATION (broches marquées PROVISOIRE : à vérifier sur le montage)
// ===========================================================================
#define PIN_BUZZER        5    // buzzer PASSIF
#define PIN_LED_RED       10
#define PIN_LED_YELLOW    11
#define PIN_LED_GREEN     12
#define PIN_ENC_A         9    // encodeur CLK
#define PIN_ENC_B         8    // encodeur DT
#define PIN_ENC_SW        7    // encodeur bouton
#define PIN_BTN_RECORD    4    // bouton enregistrer (vers GND)
#define HAS_BUZZER_BUTTON 1    // 0 si un seul bouton : appui long D4 = buzzer
#define PIN_BTN_BUZZER    6    // PROVISOIRE
#define PIN_RTC_SCLK      15   // A1  PROVISOIRE
#define PIN_RTC_IO        16   // A2  PROVISOIRE
#define PIN_RTC_CE        17   // A3  PROVISOIRE (RST du module)
#define PPG_ADC_CHANNEL   0    // A0  PROVISOIRE (sortie S du WPSE340)

#define OLED_TEXT_ADDR    0x3C
#define OLED_GRAPH_ADDR   0x3D
#define OLED_SH1106       0    // 1 pour des écrans 1,3" SH1106
#define I2C_CLOCK_HZ      400000UL

// Acquisition
#define SAMPLE_RATE_HZ    100  // le pouls utile est < 5 Hz
#define SAMPLE_PERIOD_MS  10
#define FIFO_SIZE         16   // puissance de 2 ; 160 ms de marge

// Traitement du signal
#define DC_WINDOW_LOG2    7    // moyenne glissante 128 éch. = 1,28 s
#define DC_WINDOW         (1 << DC_WINDOW_LOG2)
#define SIGNAL_SHIFT      3    // signal en 1/8 de pas ADC
#define LP_WINDOW_LOG2    2    // passe-bas : moyenne de 4 éch. (zéros 25/50 Hz)
#define LP_WINDOW         (1 << LP_WINDOW_LOG2)
#define ENV_DECAY_SHIFT   8    // enveloppes : tau = 256 éch. = 2,56 s
#define THR_NUM16         2    // seuils = centre ± 2/16 de l'amplitude
#define MIN_AMPLITUDE_ADC 10   // en dessous : pas de doigt
#define MAX_AMPLITUDE_ADC 700  // au dessus : mouvement
#define ADC_SAT_LOW       5
#define ADC_SAT_HIGH      1018
#define REFRACTORY_MIN_MS 250  // 240 BPM max

// Calcul BPM
#define IBI_MIN_MS        300  // 200 BPM
#define IBI_MAX_MS        1500 // 40 BPM
#define IBI_HISTORY       8
#define BPM_AVG_COUNT     5
#define MIN_VALID_INTERVALS 4
#define IBI_TOLERANCE_PCT 30
#define MAX_CONSEC_REJECTS 4
#define BEAT_TIMEOUT_MS   3000
#define SIGNAL_LOSS_MS    1000

// Classification indicative adulte au repos (pas un diagnostic)
#define BPM_LOW_BELOW     60
#define BPM_HIGH_ABOVE    100

// Buzzer
#define TONE_LOW_HZ       440
#define TONE_NORMAL_HZ    880
#define TONE_HIGH_HZ      1760
#define BEEP_MS           60
#define TONE_UI_HZ        2500
#define BEEP_UI_MS        25

// Interface
#define DEBOUNCE_MS       25
#define LONG_PRESS_MS     800
#define ENC_STEPS_PER_DETENT 4
#define ENCODER_REVERSE   0
#define RTC_READ_MS       200
#define TEXT_REFRESH_MS   100
#define GRAPH_REFRESH_MS  100
#define MENU_TIMEOUT_MS   30000
#define MESSAGE_MS        2500
#define PLOT_W            100  // 100 colonnes : T x 100 Hz / 100 = T éch./colonne
#define SCALE_COUNT       4

// Enregistrement / EEPROM
#define RECORD_SAMPLES    10
#define RECORD_TIMEOUT_MS 30000
#define EE_HEADER_SIZE    16
#define EE_RECORD_SIZE    8
#define EE_CAPACITY       ((1024 - EE_HEADER_SIZE) / EE_RECORD_SIZE)   // 126
#define EE_MAGIC0         0x43
#define EE_MAGIC1         0x45
#define EE_VERSION        1

// ===========================================================================
// TYPES
// ===========================================================================
struct PPGSample {
  uint32_t tMs;
  uint16_t raw;
  int16_t  filtered, envMax, envMin, thrHigh, thrLow;
  uint16_t amplitudeAdc;
  bool     signalOk, beat;
  uint32_t beatTimeMs;
};

enum HrClass : uint8_t { HR_NONE = 0, HR_LOW, HR_NORMAL, HR_HIGH };
enum : uint8_t { EV_ACCEPTED = 1, EV_REJECTED = 2 };

struct DateTime { uint16_t year; uint8_t month, day, hour, minute, second; };
enum RtcStatus : uint8_t { RTC_OK = 0, RTC_HALTED, RTC_INVALID };

struct Record { uint8_t bpm, day, month, year, hour, minute, second; };

enum ButtonId : uint8_t { BTN_RECORD = 0, BTN_BUZZER, BTN_ENCODER, BTN_COUNT };
enum : uint8_t { BTN_PRESS = 1, BTN_SHORT = 2, BTN_LONG = 4 };
struct Button {
  uint8_t pin; bool present, stable, lastRaw, longFired;
  uint32_t changeMs, pressMs; uint8_t events;
};

enum : uint8_t { LINE_NORMAL = 0, LINE_INVERSE = 1, LINE_BIG = 2 };
enum UiMode : uint8_t { UI_HOME = 0, UI_MENU, UI_HISTORY, UI_ERASE };
enum MenuItem : uint8_t { MI_MEASURE = 0, MI_HISTORY, MI_ERASE, MI_LANGUAGE, MI_BUZZER, MI_BACK, MI_COUNT };
enum RecResult : uint8_t { REC_NONE = 0, REC_STARTED, REC_SAVED, REC_CANCELLED, REC_TIMEOUT,
                           REC_REFUSED_INVALID, REC_REFUSED_RTC, REC_REFUSED_FULL };
enum PlotMode : uint8_t { PLOT_OFF = 0, PLOT_ARDUINO, PLOT_CSV };

// ===========================================================================
// TEXTES FR / EN (en Flash : 0 octet de SRAM)
// ===========================================================================
#define STRING_LIST(X) \
  X(STR_TITLE,          "CARDIO ECE",       "CARDIO ECE")       \
  X(STR_STATE_LOW,      "ETAT : FAIBLE",    "STATE : LOW")      \
  X(STR_STATE_NORMAL,   "ETAT : NORMAL",    "STATE : NORMAL")   \
  X(STR_STATE_HIGH,     "ETAT : ELEVE",     "STATE : HIGH")     \
  X(STR_SIGNAL_INVALID, "SIGNAL INVALIDE",  "INVALID SIGNAL")   \
  X(STR_SEARCHING,      "RECHERCHE POULS",  "SEARCHING PULSE")  \
  X(STR_NO_SIGNAL,      "PAS DE SIGNAL",    "NO SIGNAL")        \
  X(STR_SOUND,          "SON",              "SND")              \
  X(STR_REC_PREFIX,     "ENR",              "REC")              \
  X(STR_RTC_NOT_SET,    "HEURE NON REGLEE", "TIME NOT SET")     \
  X(STR_MSG_SAVED,      "ENREGISTRE #",     "SAVED #")          \
  X(STR_MSG_CANCELLED,  "ENREG. ANNULE",    "REC. CANCELLED")   \
  X(STR_MSG_INVALID,    "MESURE INVALIDE",  "INVALID READING")  \
  X(STR_MSG_FULL,       "MEMOIRE PLEINE",   "MEMORY FULL")      \
  X(STR_MSG_RTC,        "HEURE INVALIDE",   "INVALID TIME")     \
  X(STR_MSG_ERASED,     "HISTO. EFFACE",    "HISTORY ERASED")   \
  X(STR_MSG_TIMEOUT,    "DELAI DEPASSE",    "TIMED OUT")        \
  X(STR_MENU_TITLE,     "MENU PRINCIPAL",   "MAIN MENU")        \
  X(STR_MENU_MEASURE,   "Mesure",           "Measurement")      \
  X(STR_MENU_HISTORY,   "Historique",       "History")          \
  X(STR_MENU_ERASE,     "Effacer donnees",  "Erase data")       \
  X(STR_MENU_LANGUAGE,  "Langue: FR",       "Language: EN")     \
  X(STR_MENU_BUZZER,    "Buzzer:",          "Buzzer:")          \
  X(STR_MENU_BACK,      "Retour",           "Back")             \
  X(STR_ON,             "ON",               "ON")               \
  X(STR_OFF,            "OFF",              "OFF")              \
  X(STR_HIST_TITLE,     "HISTORIQUE",       "HISTORY")          \
  X(STR_HIST_EMPTY,     "Aucune donnee",    "No data")          \
  X(STR_HIST_CORRUPT,   "Donnee corrompue", "Corrupted record") \
  X(STR_ERASE_TITLE,    "EFFACER TOUT ?",   "ERASE ALL ?")      \
  X(STR_ERASE_WARN,     "Irreversible",     "Cannot be undone") \
  X(STR_NO,             "NON",              "NO")               \
  X(STR_YES,            "OUI",              "YES")              \
  X(STR_HINT_SELECT,    "Clic: valider",    "Click: select")    \
  X(STR_HINT_BACK,      "Long: retour",     "Hold: back")

#define STR_ENUM(id, fr, en) id,
enum StrId : uint8_t { STRING_LIST(STR_ENUM) STR_COUNT };
#define STR_DEF(id, fr, en) const char id##_fr[] PROGMEM = fr; const char id##_en[] PROGMEM = en;
STRING_LIST(STR_DEF)
#define STR_ROW(id, fr, en) { id##_fr, id##_en },
const char *const STR_TABLE[STR_COUNT][2] PROGMEM = { STRING_LIST(STR_ROW) };

const uint8_t MENU_LABEL[MI_COUNT] PROGMEM = {
  STR_MENU_MEASURE, STR_MENU_HISTORY, STR_MENU_ERASE, STR_MENU_LANGUAGE, STR_MENU_BUZZER, STR_MENU_BACK };

// Bases de temps de la courbe et graduations (px par division)
const uint8_t SCALE_S[SCALE_COUNT] PROGMEM = {2, 5, 10, 20};
const uint8_t DIV_PX[SCALE_COUNT] PROGMEM = {25, 20, 20, 25};
const char LBL_DIV0[] PROGMEM = ".5s/div";
const char LBL_DIV1[] PROGMEM = "1s/div";
const char LBL_DIV2[] PROGMEM = "2s/div";
const char LBL_DIV3[] PROGMEM = "5s/div";
const char *const LBL_DIV[SCALE_COUNT] PROGMEM = {LBL_DIV0, LBL_DIV1, LBL_DIV2, LBL_DIV3};

// Décodage quadrature : index (ancien<<2 | nouveau) -> +1, -1 ou 0
const int8_t QDEC[16] PROGMEM = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};

// ===========================================================================
// VARIABLES GLOBALES (aucune allocation dynamique)
// ===========================================================================
// --- FS1 acquisition (partagées avec l'interruption) ---
volatile uint16_t g_fifo[FIFO_SIZE];
volatile uint8_t  g_fifoHead = 0, g_fifoTail = 0, g_fifoMax = 0;
volatile uint32_t g_sampleIndex = 0;
volatile uint16_t g_overruns = 0;
volatile bool     g_adcPrimed = false;

// --- FS1 traitement ---
uint16_t p_med[5];          uint8_t p_medIdx;
uint8_t  p_dcHi[DC_WINDOW]; uint8_t p_dcLo[DC_WINDOW / 4];   // 10 bits = 8 + 2
uint32_t p_dcSum;           uint16_t p_dcIdx;     bool p_primed;
int16_t  p_lp[LP_WINDOW];   int32_t p_lpSum;      uint8_t p_lpIdx;
int32_t  p_envMax256, p_envMin256;
bool     p_armed, p_havePrev, p_haveBeat;
int16_t  p_prevF;           uint32_t p_prevT, p_lastBeat;
uint16_t p_refractory = REFRACTORY_MIN_MS;
uint8_t  p_satHold;

// --- FS1 BPM ---
uint16_t hr_ibi[IBI_HISTORY]; uint8_t hr_head, hr_count;
uint16_t hr_lastIbi, hr_bpmX10;  bool hr_valid;
bool     hr_haveLast, hr_haveAccepted, hr_bad;
uint32_t hr_lastBeat, hr_lastAccepted, hr_badSince, hr_acc, hr_rej;
uint8_t  hr_rejects;
bool     g_signalOk = false;
uint16_t g_amplitude = 0;

// --- FS2 RTC ---
DateTime  rtc_now = {2000, 1, 1, 0, 0, 0};
RtcStatus rtc_status = RTC_INVALID;
uint32_t  rtc_lastRead = 0;
uint8_t   rtc_errors = 0;

// --- FS3 / FS4 ---
HrClass  led_current = HR_NONE;
bool     led_force = true;
bool     buz_enabled = true;
volatile uint8_t *buz_pinReg;
uint8_t  buz_mask;
volatile uint32_t buz_toggles = 0;

// --- Entrées ---
Button btn[BTN_COUNT] = {
  {PIN_BTN_RECORD, true, false, false, false, 0, 0, 0},
  {PIN_BTN_BUZZER, HAS_BUZZER_BUTTON != 0, false, false, false, 0, 0, 0},
  {PIN_ENC_SW, true, false, false, false, 0, 0, 0},
};
volatile uint16_t enc_steps = 0;
volatile uint8_t  enc_state = 0;
volatile uint8_t *enc_aReg, *enc_bReg;
uint8_t  enc_aMask, enc_bMask;
uint16_t enc_consumed = 0;

// --- FS5 écrans ---
u8x8_t  oledText;            // écran texte : AUCUN tampon en RAM
u8g2_t  oledGraph;           // écran courbe : tampon d'UNE page (128 o)
bool    textOk = false, graphOk = false;
uint16_t rowHash[8];          uint8_t textRow = 0;  uint32_t lastTextPass = 0;
uint8_t col_min[PLOT_W], col_max[PLOT_W];
uint8_t col_head = 0, col_count = 0, acc_min, acc_max, acc_n = 0, last_y = 32;
uint8_t g_scale = 1;          uint16_t g_spc = 5;     // 5 s par défaut
bool    inFrame = false;      uint32_t frameStart = 0;
uint8_t snapHead = 0, snapCount = 0;
uint32_t beatFlashMs = 0;     bool beatSeen = false;
bool    displayTurn = false;

// --- FS6 EEPROM / menu / enregistrement ---
uint8_t ee_gen = 0, ee_count = 0, ee_lang = 0;
bool    ee_buzzer = true, ee_formatted = false, ee_recovered = false;
UiMode  ui_mode = UI_HOME;
uint8_t ui_cursor = 0, ui_histPos = 0;
bool    ui_eraseYes = false;
uint32_t ui_lastActivity = 0;
StrId   ui_msg = STR_COUNT;   int16_t ui_msgNum = -1;   uint32_t ui_msgStart = 0;
bool     rec_active = false;  uint8_t rec_n = 0;  uint32_t rec_sum = 0, rec_start = 0;
Record   rec_data;            uint8_t rec_lastBpm = 0;

// --- Console ---
char    con_line[32];         uint8_t con_len = 0;
uint8_t plotMode = PLOT_OFF;
extern char __heap_start;
extern char *__brkval;

// Prototypes des fonctions utilisées avant leur définition
uint8_t composeLine(uint8_t row, char *buf);
void appSetBuzzer(bool on);
void appSetLanguage(uint8_t lang);

// ===========================================================================
// OUTILS : textes et mise en forme (sans printf : -1,3 Ko de Flash)
// ===========================================================================
void copyStr(StrId id, uint8_t lang, char *buf, size_t size) {
  if (id >= STR_COUNT) id = STR_TITLE;
  if (lang > 1) lang = 0;
  strncpy_P(buf, (const char *)pgm_read_ptr(&STR_TABLE[id][lang]), size - 1);
  buf[size - 1] = 0;
}

char *fmtU(char *p, uint32_t v, uint8_t width, char pad) {
  char tmp[10];
  uint8_t n = 0;
  do { tmp[n++] = (char)('0' + v % 10); v /= 10; } while (v && n < 10);
  while (width > n) { *p++ = pad; width--; }
  while (n) *p++ = tmp[--n];
  *p = 0;
  return p;
}

char *fmtTime(char *p, uint8_t h, uint8_t m, uint8_t s) {
  p = fmtU(p, h, 2, '0'); *p++ = ':';
  p = fmtU(p, m, 2, '0'); *p++ = ':';
  return fmtU(p, s, 2, '0');
}

char *fmtDate(char *p, uint8_t d, uint8_t m, uint16_t y) {
  p = fmtU(p, d, 2, '0'); *p++ = '/';
  p = fmtU(p, m, 2, '0'); *p++ = '/';
  return fmtU(p, y, 4, '0');
}

// ===========================================================================
// FS1 — ACQUISITION : Timer1 100 Hz déclenche l'ADC, FIFO vers loop()
// ===========================================================================
void ppgBegin() {
  ADMUX = _BV(REFS0) | (PPG_ADC_CHANNEL & 7);              // référence AVcc 5 V
  ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0); // 125 kHz
  DIDR0 |= _BV(PPG_ADC_CHANNEL);                            // moins de bruit
  ADCSRA |= _BV(ADSC);
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = _BV(WGM12) | _BV(CS11);                          // CTC, /8 -> 2 MHz
  OCR1A = (uint16_t)(F_CPU / 8UL / SAMPLE_RATE_HZ - 1);     // 19999 -> 100 Hz
  TCNT1 = 0;
  TIFR1 = _BV(OCF1A);
  TIMSK1 = _BV(OCIE1A);
  interrupts();
}

// Cadence fixe, indépendante de loop() : on lit la conversion lancée il y a
// 10 ms et on lance la suivante (aucune attente active).
ISR(TIMER1_COMPA_vect) {
  const uint16_t v = ADC;
  ADCSRA |= _BV(ADSC);
  if (!g_adcPrimed) { g_adcPrimed = true; return; }
  const uint8_t next = (g_fifoHead + 1) & (FIFO_SIZE - 1);
  if (next == g_fifoTail) {
    g_overruns++;
  } else {
    g_fifo[g_fifoHead] = v;
    g_fifoHead = next;
    const uint8_t level = (next - g_fifoTail) & (FIFO_SIZE - 1);
    if (level > g_fifoMax) g_fifoMax = level;
  }
  g_sampleIndex++;
}

bool ppgPop(uint16_t &raw, uint32_t &index) {
  bool ok = false;
  noInterrupts();
  const uint8_t tail = g_fifoTail;
  if (tail != g_fifoHead) {
    raw = g_fifo[tail];
    index = g_sampleIndex - ((g_fifoHead - tail) & (FIFO_SIZE - 1));
    g_fifoTail = (tail + 1) & (FIFO_SIZE - 1);
    ok = true;
  }
  interrupts();
  return ok;
}

// ===========================================================================
// FS1 — TRAITEMENT : médian 5 -> moyenne glissante centrée -> passe-bas ->
//        enveloppes -> seuil adaptatif + hystérésis -> battement horodaté
// ===========================================================================
uint16_t dcGet(uint16_t i) {
  return ((uint16_t)p_dcHi[i] << 2) | ((p_dcLo[i >> 2] >> ((i & 3) << 1)) & 3);
}

void dcSet(uint16_t i, uint16_t v) {
  const uint8_t sh = (i & 3) << 1;
  p_dcHi[i] = v >> 2;
  p_dcLo[i >> 2] = (p_dcLo[i >> 2] & ~(3 << sh)) | ((v & 3) << sh);
}

// Médiane de 5 valeurs par réseau de comparaisons (supprime une impulsion
// parasite de 1 ou 2 échantillons sans déformer le pouls).
uint16_t median5(const uint16_t *in) {
  uint16_t a = in[0], b = in[1], c = in[2], d = in[3], e = in[4], t;
#define SORT2(x, y) if (x > y) { t = x; x = y; y = t; }
  SORT2(a, b); SORT2(d, e); SORT2(a, c); SORT2(b, c);
  SORT2(a, d); SORT2(c, d); SORT2(b, e); SORT2(b, c);
#undef SORT2
  return c;
}

void procProcess(uint16_t raw, uint32_t tMs, PPGSample &out) {
  if (raw > 1023) raw = 1023;
  const uint16_t rawIn = raw;

  // 0. Médian 5 points (retard 20 ms, reporté sur l'horodatage)
  if (!p_primed) for (uint8_t i = 0; i < 5; i++) p_med[i] = raw;
  p_med[p_medIdx] = raw;
  p_medIdx = (p_medIdx == 4) ? 0 : p_medIdx + 1;
  raw = median5(p_med);
  tMs -= 2 * SAMPLE_PERIOD_MS;

  // 1. Composante continue : somme glissante exacte sur 128 éch. (O(1))
  if (!p_primed) {
    for (uint16_t i = 0; i < DC_WINDOW; i++) dcSet(i, raw);
    p_dcSum = (uint32_t)raw * DC_WINDOW;
    p_primed = true;
  }
  p_dcSum -= dcGet(p_dcIdx);
  dcSet(p_dcIdx, raw);
  p_dcSum += raw;
  p_dcIdx = (p_dcIdx + 1) & (DC_WINDOW - 1);
  const int32_t mean8 = p_dcSum >> (DC_WINDOW_LOG2 - SIGNAL_SHIFT);
  // Moyenne CENTRÉE : on la retranche à l'échantillon du milieu de la
  // fenêtre -> dérive linéaire annulée, forme d'onde intacte (retard 0,63 s)
  const uint16_t mid = dcGet((p_dcIdx + DC_WINDOW / 2) & (DC_WINDOW - 1));
  const int16_t centred = ((int32_t)mid << SIGNAL_SHIFT) - mean8;
  tMs -= (uint32_t)(DC_WINDOW / 2 - 1) * SAMPLE_PERIOD_MS;

  // 2. Passe-bas : moyenne de 4 échantillons
  p_lpSum -= p_lp[p_lpIdx];
  p_lp[p_lpIdx] = centred;
  p_lpSum += centred;
  p_lpIdx = (p_lpIdx + 1) & (LP_WINDOW - 1);
  const int16_t f = p_lpSum >> LP_WINDOW_LOG2;

  // 3. Enveloppes : attaque instantanée, décroissance vers 0 (tau 2,56 s)
  const int32_t f256 = (int32_t)f << 8;
  if (f256 > p_envMax256) p_envMax256 = f256; else p_envMax256 -= p_envMax256 >> ENV_DECAY_SHIFT;
  if (f256 < p_envMin256) p_envMin256 = f256; else p_envMin256 -= p_envMin256 >> ENV_DECAY_SHIFT;
  const int16_t envMax = p_envMax256 >> 8, envMin = p_envMin256 >> 8;
  const int16_t amp = envMax - envMin;
  const int16_t centre = (envMax + envMin) / 2;
  const int16_t thrHigh = centre + ((int32_t)amp * THR_NUM16) / 16;
  const int16_t thrLow  = centre - ((int32_t)amp * THR_NUM16) / 16;

  // 4. Qualité : saturation durable ou amplitude hors plage = invalide
  if (raw <= ADC_SAT_LOW || raw >= ADC_SAT_HIGH) p_satHold = SAMPLE_RATE_HZ / 2;
  else if (p_satHold) p_satHold--;
  const uint16_t ampAdc = amp >> SIGNAL_SHIFT;
  const bool ok = !p_satHold && ampAdc >= MIN_AMPLITUDE_ADC && ampAdc <= MAX_AMPLITUDE_ADC;

  // 5. Détection : armé sous thrLow, battement au franchissement MONTANT de
  //    thrHigh (front systolique), instant interpolé, période réfractaire
  bool beat = false;
  uint32_t beatT = 0;
  if (!ok) {
    p_armed = false;
  } else if (p_havePrev) {
    if (!p_armed) {
      if (f < thrLow) p_armed = true;
    } else if (f > thrHigh) {
      p_armed = false;
      int32_t num = (int32_t)thrHigh - p_prevF, den = (int32_t)f - p_prevF;
      if (num < 0) num = 0;
      if (den <= 0) { den = 1; num = 1; }
      if (num > den) num = den;
      const uint32_t tc = p_prevT + (uint32_t)((num * (int32_t)(tMs - p_prevT) + den / 2) / den);
      if (!p_haveBeat || (uint32_t)(tc - p_lastBeat) >= p_refractory) {
        beat = true; beatT = tc; p_lastBeat = tc; p_haveBeat = true;
      }
    }
  }
  p_prevF = f; p_prevT = tMs; p_havePrev = true;

  out.tMs = tMs; out.raw = rawIn; out.filtered = f;
  out.envMax = envMax; out.envMin = envMin; out.thrHigh = thrHigh; out.thrLow = thrLow;
  out.amplitudeAdc = ampAdc; out.signalOk = ok; out.beat = beat; out.beatTimeMs = beatT;
}

// ===========================================================================
// FS1 — CALCUL DU BPM : BPM = 60000 x n / somme des n derniers IBI validés
// ===========================================================================
HrClass classifyBpm(uint16_t bpm) {
  if (bpm == 0) return HR_NONE;
  if (bpm < BPM_LOW_BELOW) return HR_LOW;
  if (bpm > BPM_HIGH_ABOVE) return HR_HIGH;
  return HR_NORMAL;
}

uint16_t hrBpm() { return hr_valid ? (hr_bpmX10 + 5) / 10 : 0; }
HrClass hrClass() { return hr_valid ? classifyBpm(hrBpm()) : HR_NONE; }

void hrClear() {
  hr_head = 0; hr_count = 0; hr_lastIbi = 0; hr_bpmX10 = 0;
}

void hrPush(uint16_t ibi) {
  hr_ibi[hr_head] = ibi;
  hr_head = (hr_head + 1) % IBI_HISTORY;
  if (hr_count < IBI_HISTORY) hr_count++;
  hr_lastIbi = ibi;
}

uint16_t hrMedian() {
  uint16_t tmp[IBI_HISTORY];
  for (uint8_t i = 0; i < hr_count; i++) {          // tri par insertion
    uint16_t v = hr_ibi[(hr_head + IBI_HISTORY - 1 - i) % IBI_HISTORY];
    int8_t j = i - 1;
    while (j >= 0 && tmp[j] > v) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = v;
  }
  if (hr_count == 0) return 0;
  if (hr_count & 1) return tmp[hr_count / 2];
  return ((uint32_t)tmp[hr_count / 2 - 1] + tmp[hr_count / 2]) / 2;
}

void hrRecompute() {
  uint8_t n = hr_count < BPM_AVG_COUNT ? hr_count : BPM_AVG_COUNT;
  uint32_t sum = 0;
  for (uint8_t k = 0; k < n; k++) sum += hr_ibi[(hr_head + IBI_HISTORY - 1 - k) % IBI_HISTORY];
  hr_bpmX10 = (n && sum) ? (600000UL * n + sum / 2) / sum : 0;
  hr_valid = hr_count >= MIN_VALID_INTERVALS && hr_bpmX10 > 0;
}

void hrInvalidate() {
  hr_valid = false; hrClear(); hr_rejects = 0;
}

uint16_t hrRefractory() {
  if (hr_count < 3) return REFRACTORY_MIN_MS;
  uint16_t r = hrMedian() / 2;
  return r > REFRACTORY_MIN_MS ? r : REFRACTORY_MIN_MS;
}

// Appelée à chaque échantillon. Renvoie EV_ACCEPTED / EV_REJECTED.
uint8_t hrUpdate(uint32_t now, bool signalOk, bool beat, uint32_t beatT) {
  uint8_t ev = 0;
  // Perte de signal > 1 s ou aucun battement accepté depuis 3 s : invalide
  if (!signalOk) {
    if (!hr_bad) { hr_bad = true; hr_badSince = now; }
    else if ((uint32_t)(now - hr_badSince) >= SIGNAL_LOSS_MS) {
      hrInvalidate(); hr_haveLast = false; hr_haveAccepted = false;
    }
  } else {
    hr_bad = false;
  }
  if (hr_haveAccepted && (uint32_t)(now - hr_lastAccepted) >= BEAT_TIMEOUT_MS) {
    hrInvalidate(); hr_haveAccepted = false;
  }
  if (hr_haveLast && (uint32_t)(now - hr_lastBeat) >= BEAT_TIMEOUT_MS) hr_haveLast = false;

  if (beat) {
    if (!hr_haveLast) {
      hr_haveLast = true; hr_lastBeat = beatT;
    } else {
      const uint32_t d = beatT - hr_lastBeat;      // différence non signée
      hr_lastBeat = beatT;
      const bool plausible = d >= IBI_MIN_MS && d <= IBI_MAX_MS;
      bool ok = plausible;
      if (ok && hr_count > 0) {                    // cohérence avec la médiane
        const uint16_t ref = hr_count >= 3 ? hrMedian() : hr_lastIbi;
        const uint32_t diff = d > ref ? d - ref : ref - d;
        ok = diff <= (uint32_t)ref * IBI_TOLERANCE_PCT / 100;
      }
      if (ok) {
        hrPush(d); hr_rejects = 0; hr_acc++;
        hr_haveAccepted = true; hr_lastAccepted = beatT;
        ev |= EV_ACCEPTED;
      } else {
        hr_rej++; ev |= EV_REJECTED;
        if (plausible && hr_count < 3) {           // accrochage : on repart du récent
          hrClear(); hrPush(d); hr_haveAccepted = true; hr_lastAccepted = beatT;
        } else if (++hr_rejects >= MAX_CONSEC_REJECTS) {   // rythme réellement changé
          hrClear(); hr_rejects = 0;
          if (plausible) { hrPush(d); hr_haveAccepted = true; hr_lastAccepted = beatT; }
        }
      }
      hrRecompute();
    }
  }
  return ev;
}

// ===========================================================================
// FS2 — RTC DS1302 : bus 3 fils (CE, SCLK, I/O bidirectionnelle, LSB d'abord)
// ===========================================================================
uint8_t bcd2bin(uint8_t v) { return (v >> 4) * 10 + (v & 15); }
uint8_t bin2bcd(uint8_t v) { return ((v / 10) << 4) | (v % 10); }
bool bcdOk(uint8_t v) { return (v & 15) <= 9 && (v >> 4) <= 9; }

void dsStart() {
  digitalWrite(PIN_RTC_SCLK, LOW);
  digitalWrite(PIN_RTC_CE, HIGH);
  delayMicroseconds(4);
}

void dsStop() {
  digitalWrite(PIN_RTC_CE, LOW);
  pinMode(PIN_RTC_IO, INPUT);
  delayMicroseconds(4);
}

// Écriture LSB d'abord, validée par front montant ; si readAfter, la ligne
// I/O est relâchée avant le dernier front descendant (le DS1302 répond dessus).
void dsWriteByte(uint8_t v, bool readAfter) {
  pinMode(PIN_RTC_IO, OUTPUT);
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(PIN_RTC_IO, v & 1);
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_SCLK, HIGH);
    delayMicroseconds(1);
    if (readAfter && i == 7) pinMode(PIN_RTC_IO, INPUT);
    digitalWrite(PIN_RTC_SCLK, LOW);
    v >>= 1;
  }
}

uint8_t dsReadByte() {
  uint8_t v = 0;
  for (uint8_t i = 0; i < 8; i++) {
    delayMicroseconds(1);
    if (digitalRead(PIN_RTC_IO)) v |= 1 << i;
    digitalWrite(PIN_RTC_SCLK, HIGH);
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_SCLK, LOW);
  }
  return v;
}

void dsWriteReg(uint8_t cmd, uint8_t value) {
  dsStart(); dsWriteByte(cmd, false); dsWriteByte(value, false); dsStop();
}

bool rtcDateValid(const DateTime &dt) {
  static const uint8_t dim[12] PROGMEM = {31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (dt.year < 2000 || dt.year > 2099 || dt.month < 1 || dt.month > 12) return false;
  if (dt.day < 1 || dt.day > pgm_read_byte(&dim[dt.month - 1])) return false;
  if (dt.month == 2 && dt.day == 29 && (dt.year % 4)) return false;
  return dt.hour <= 23 && dt.minute <= 59 && dt.second <= 59;
}

// Lecture en rafale (0xBF) des registres BCD + contrôles de cohérence
RtcStatus rtcRead(DateTime &dt) {
  uint8_t r[8];
  dsStart();
  dsWriteByte(0xBF, true);
  for (uint8_t i = 0; i < 8; i++) r[i] = dsReadByte();
  dsStop();
  if (r[0] & 0x80) return RTC_HALTED;              // bit CH : jamais réglée / pile HS
  bool allFF = true, all00 = true;
  for (uint8_t i = 0; i < 7; i++) { allFF &= r[i] == 0xFF; all00 &= r[i] == 0; }
  if (allFF || all00) return RTC_INVALID;           // module absent
  const uint8_t sec = r[0] & 0x7F, mn = r[1] & 0x7F, date = r[3] & 0x3F, mon = r[4] & 0x1F;
  if (!bcdOk(sec) || !bcdOk(mn) || !bcdOk(date) || !bcdOk(mon) || !bcdOk(r[6])) return RTC_INVALID;
  uint8_t hour;
  if (r[2] & 0x80) {                                // mode 12 h
    if (!bcdOk(r[2] & 0x1F)) return RTC_INVALID;
    hour = bcd2bin(r[2] & 0x1F) % 12 + ((r[2] & 0x20) ? 12 : 0);
  } else {
    if (!bcdOk(r[2] & 0x3F)) return RTC_INVALID;
    hour = bcd2bin(r[2] & 0x3F);
  }
  dt.second = bcd2bin(sec); dt.minute = bcd2bin(mn); dt.hour = hour;
  dt.day = bcd2bin(date); dt.month = bcd2bin(mon); dt.year = 2000 + bcd2bin(r[6]);
  return rtcDateValid(dt) ? RTC_OK : RTC_INVALID;
}

void rtcUpdate(uint32_t now) {
  if ((uint32_t)(now - rtc_lastRead) < RTC_READ_MS) return;
  rtc_lastRead = now;
  DateTime dt;
  const RtcStatus st = rtcRead(dt);
  if (st == RTC_OK) { rtc_now = dt; rtc_status = RTC_OK; rtc_errors = 0; }
  else if (st == RTC_HALTED) rtc_status = RTC_HALTED;
  else if (++rtc_errors >= 3) rtc_status = RTC_INVALID;   // 3 erreurs d'affilée
}

void rtcBegin() {
  digitalWrite(PIN_RTC_CE, LOW);   pinMode(PIN_RTC_CE, OUTPUT);
  digitalWrite(PIN_RTC_SCLK, LOW); pinMode(PIN_RTC_SCLK, OUTPUT);
  pinMode(PIN_RTC_IO, INPUT);
  rtc_lastRead = millis() - RTC_READ_MS;
  rtcUpdate(millis());             // LECTURE seule : l'heure n'est jamais réécrite ici
}

// Réglage explicite (commande SET uniquement)
bool rtcSet(const DateTime &dt) {
  if (!rtcDateValid(dt)) return false;
  static const uint8_t t[12] PROGMEM = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
  uint16_t y = dt.year - (dt.month < 3);
  uint8_t dow = (y + y / 4 - y / 100 + y / 400 + pgm_read_byte(&t[dt.month - 1]) + dt.day) % 7;
  dsWriteReg(0x8E, 0x00);          // WP = 0
  dsWriteReg(0x90, 0x00);          // chargeur désactivé (pile non rechargeable)
  dsWriteReg(0x80, 0x80);          // arrêt pendant le réglage
  dsWriteReg(0x8C, bin2bcd(dt.year - 2000));
  dsWriteReg(0x88, bin2bcd(dt.month));
  dsWriteReg(0x86, bin2bcd(dt.day));
  dsWriteReg(0x8A, dow == 0 ? 7 : dow);
  dsWriteReg(0x84, bin2bcd(dt.hour));   // 24 h
  dsWriteReg(0x82, bin2bcd(dt.minute));
  dsWriteReg(0x80, bin2bcd(dt.second)); // CH = 0 : redémarre
  dsWriteReg(0x8E, 0x80);          // WP = 1
  DateTime chk;
  const bool ok = rtcRead(chk) == RTC_OK && chk.year == dt.year && chk.month == dt.month &&
                  chk.day == dt.day && chk.hour == dt.hour && chk.minute == dt.minute;
  if (ok) { rtc_now = chk; rtc_status = RTC_OK; rtc_errors = 0; }
  return ok;
}

// ===========================================================================
// FS3 — LED : une seule allumée, aucune si mesure invalide, écrites
//        uniquement lors d'un changement (pas de scintillement)
// ===========================================================================
void updateHeartRateIndicators(HrClass c) {
  if (c == led_current && !led_force) return;
  led_current = c;
  led_force = false;
  digitalWrite(PIN_LED_YELLOW, LOW);       // tout éteindre d'abord
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  if (c == HR_LOW) digitalWrite(PIN_LED_YELLOW, HIGH);
  else if (c == HR_NORMAL) digitalWrite(PIN_LED_GREEN, HIGH);
  else if (c == HR_HIGH) digitalWrite(PIN_LED_RED, HIGH);
}

// ===========================================================================
// FS4 — BUZZER : tonalité sur Timer2 par interruption, NON bloquante
//        (même principe que tone(), en version compacte)
// ===========================================================================
ISR(TIMER2_COMPA_vect) {
  if (buz_toggles) {
    *buz_pinReg = buz_mask;                 // écrire 1 dans PINx inverse la broche
    if (--buz_toggles == 0) {
      TIMSK2 = 0;
      *portOutputRegister(digitalPinToPort(PIN_BUZZER)) &= ~buz_mask;
    }
  }
}

void toneStart(uint16_t freq, uint16_t durMs) {
  static const uint16_t PRESC[5] PROGMEM = {32, 64, 128, 256, 1024};
  static const uint8_t CS[5] PROGMEM = {_BV(CS21) | _BV(CS20), _BV(CS22), _BV(CS22) | _BV(CS20),
                                        _BV(CS22) | _BV(CS21), _BV(CS22) | _BV(CS21) | _BV(CS20)};
  uint8_t k = 0;
  uint32_t ocr = 0;
  for (; k < 5; k++) {
    ocr = F_CPU / (2UL * pgm_read_word(&PRESC[k]) * freq) - 1;
    if (ocr <= 255) break;
  }
  if (k == 5) return;
  noInterrupts();
  TCCR2A = _BV(WGM21);
  TCCR2B = pgm_read_byte(&CS[k]);
  OCR2A = ocr;
  TCNT2 = 0;
  buz_toggles = 2UL * freq * durMs / 1000UL;
  TIMSK2 = _BV(OCIE2A);
  interrupts();
}

void toneStop() {
  noInterrupts();
  TIMSK2 = 0;
  buz_toggles = 0;
  interrupts();
  digitalWrite(PIN_BUZZER, LOW);
}

void buzzerBeat(HrClass c) {               // grave / moyen / aigu
  if (!buz_enabled || c == HR_NONE) return;
  toneStart(c == HR_LOW ? TONE_LOW_HZ : c == HR_HIGH ? TONE_HIGH_HZ : TONE_NORMAL_HZ, BEEP_MS);
}

void buzzerUi() {
  if (buz_enabled) toneStart(TONE_UI_HZ, BEEP_UI_MS);
}

// ===========================================================================
// ENTRÉES : boutons (anti-rebond non bloquant) et encodeur (interruption)
// ===========================================================================
void encoderIsr() {
  const uint8_t a = (*enc_aReg & enc_aMask) ? 1 : 0;
  const uint8_t b = (*enc_bReg & enc_bMask) ? 1 : 0;
  const uint8_t st = (a << 1) | b;
  enc_steps += (int8_t)pgm_read_byte(&QDEC[(enc_state << 2) | st]);
  enc_state = st;
}

// Un vecteur par port : D0-D7 = PCINT2, D8-D13 = PCINT0, A0-A5 = PCINT1
#define PCGROUP(p) ((p) <= 7 ? 2 : ((p) <= 13 ? 0 : 1))
#if PCGROUP(PIN_ENC_A) == 0 || PCGROUP(PIN_ENC_B) == 0
ISR(PCINT0_vect) { encoderIsr(); }
#endif
#if PCGROUP(PIN_ENC_A) == 1 || PCGROUP(PIN_ENC_B) == 1
ISR(PCINT1_vect) { encoderIsr(); }
#endif
#if PCGROUP(PIN_ENC_A) == 2 || PCGROUP(PIN_ENC_B) == 2
ISR(PCINT2_vect) { encoderIsr(); }
#endif

void inputsBegin() {
  for (uint8_t i = 0; i < BTN_COUNT; i++) if (btn[i].present) pinMode(btn[i].pin, INPUT_PULLUP);
  pinMode(PIN_ENC_A, INPUT_PULLUP);
  pinMode(PIN_ENC_B, INPUT_PULLUP);
  enc_aReg = portInputRegister(digitalPinToPort(PIN_ENC_A));
  enc_bReg = portInputRegister(digitalPinToPort(PIN_ENC_B));
  enc_aMask = digitalPinToBitMask(PIN_ENC_A);
  enc_bMask = digitalPinToBitMask(PIN_ENC_B);
  noInterrupts();
  enc_state = (((*enc_aReg & enc_aMask) ? 1 : 0) << 1) | ((*enc_bReg & enc_bMask) ? 1 : 0);
  *digitalPinToPCMSK(PIN_ENC_A) |= _BV(digitalPinToPCMSKbit(PIN_ENC_A));
  *digitalPinToPCMSK(PIN_ENC_B) |= _BV(digitalPinToPCMSKbit(PIN_ENC_B));
  PCICR |= _BV(digitalPinToPCICRbit(PIN_ENC_A)) | _BV(digitalPinToPCICRbit(PIN_ENC_B));
  interrupts();
}

void inputsUpdate(uint32_t now) {
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    Button &b = btn[i];
    if (!b.present) continue;
    const bool raw = digitalRead(b.pin) == LOW;          // appuyé = niveau bas
    if (raw != b.lastRaw) { b.lastRaw = raw; b.changeMs = now; }
    if (raw != b.stable && (uint32_t)(now - b.changeMs) >= DEBOUNCE_MS) {
      b.stable = raw;
      if (raw) { b.pressMs = now; b.longFired = false; b.events |= BTN_PRESS; }
      else if (!b.longFired) b.events |= BTN_SHORT;
    }
    if (b.stable && !b.longFired && (uint32_t)(now - b.pressMs) >= LONG_PRESS_MS) {
      b.longFired = true; b.events |= BTN_LONG;
    }
  }
}

uint8_t btnEvents(ButtonId id) {
  const uint8_t e = btn[id].events;
  btn[id].events = 0;
  return e;
}

int8_t encoderDelta() {
  noInterrupts();
  const uint16_t steps = enc_steps;
  interrupts();
  const int16_t detents = (int16_t)(uint16_t)(steps - enc_consumed) / ENC_STEPS_PER_DETENT;
  enc_consumed += detents * ENC_STEPS_PER_DETENT;
  int16_t d = ENCODER_REVERSE ? -detents : detents;
  return constrain(d, -127, 127);
}

// ===========================================================================
// FS6 — EEPROM : en-tête 16 o (signature, version, génération, nombre,
//        langue, buzzer, CRC) + 126 enregistrements de 8 o avec CRC-8
// ===========================================================================
uint8_t crc8(uint8_t crc, uint8_t data) {           // Dallas/Maxim
  crc ^= data;
  for (uint8_t i = 0; i < 8; i++) crc = (crc & 1) ? (crc >> 1) ^ 0x8C : crc >> 1;
  return crc;
}

uint8_t eeHeaderCrc() {
  uint8_t c = 0;
  for (uint8_t a = 0; a < 7; a++) c = crc8(c, EEPROM.read(a));
  return c;
}

// CRC initialisé par la génération : un enregistrement d'avant un effacement
// ne peut jamais redevenir valide.
uint8_t eeRecordCrc(uint8_t index, const uint8_t *b) {
  uint8_t c = crc8(ee_gen, index);
  for (uint8_t i = 0; i < 7; i++) c = crc8(c, b[i]);
  return c;
}

bool eePlausible(const Record &r) {
  return r.bpm >= 20 && r.bpm <= 250 && r.day >= 1 && r.day <= 31 && r.month >= 1 &&
         r.month <= 12 && r.year <= 99 && r.hour <= 23 && r.minute <= 59 && r.second <= 59;
}

bool eeReadRaw(uint8_t index, Record &r) {
  if (index >= EE_CAPACITY) return false;
  uint8_t b[8];
  for (uint8_t i = 0; i < 8; i++) b[i] = EEPROM.read(EE_HEADER_SIZE + index * EE_RECORD_SIZE + i);
  if (eeRecordCrc(index, b) != b[7]) return false;
  r.bpm = b[0]; r.day = b[1]; r.month = b[2]; r.year = b[3];
  r.hour = b[4]; r.minute = b[5]; r.second = b[6];
  return eePlausible(r);
}

bool eeRead(uint8_t index, Record &r) { return index < ee_count && eeReadRaw(index, r); }

void eeWriteHeader() {                 // update() : n'écrit que ce qui change
  EEPROM.update(0, EE_MAGIC0);
  EEPROM.update(1, EE_MAGIC1);
  EEPROM.update(2, EE_VERSION);
  EEPROM.update(3, ee_gen);
  EEPROM.update(4, ee_count);
  EEPROM.update(5, ee_lang);
  EEPROM.update(6, ee_buzzer);
  EEPROM.update(7, eeHeaderCrc());     // CRC en dernier
}

void eeBegin() {                       // n'efface JAMAIS les données valides
  if (EEPROM.read(0) != EE_MAGIC0 || EEPROM.read(1) != EE_MAGIC1 || EEPROM.read(2) != EE_VERSION) {
    ee_gen = EEPROM.read(3) + 1;       // puce vierge : initialisation unique
    ee_count = 0; ee_lang = 0; ee_buzzer = true;
    eeWriteHeader();
    ee_formatted = true;
    return;
  }
  ee_gen = EEPROM.read(3);
  ee_count = EEPROM.read(4);
  ee_lang = EEPROM.read(5) > 1 ? 0 : EEPROM.read(5);
  ee_buzzer = EEPROM.read(6) != 0;
  if (eeHeaderCrc() != EEPROM.read(7) || ee_count > EE_CAPACITY) {
    // Coupure pendant une écriture : on recompte les enregistrements valides
    Record r;
    uint8_t n = 0;
    while (n < EE_CAPACITY && eeReadRaw(n, r)) n++;
    ee_count = n;
    eeWriteHeader();
    ee_recovered = true;
  }
}

bool eeAppend(const Record &r) {
  if (!eePlausible(r) || ee_count >= EE_CAPACITY) return false;
  uint8_t b[8] = {r.bpm, r.day, r.month, r.year, r.hour, r.minute, r.second, 0};
  b[7] = eeRecordCrc(ee_count, b);
  // Ordre : enregistrement, puis compteur, puis CRC -> toujours récupérable
  for (uint8_t i = 0; i < 8; i++) EEPROM.update(EE_HEADER_SIZE + ee_count * EE_RECORD_SIZE + i, b[i]);
  ee_count++;
  EEPROM.update(4, ee_count);
  EEPROM.update(7, eeHeaderCrc());
  return true;
}

void eeErase() {                        // effacement logique : 3 octets écrits
  ee_gen++;
  EEPROM.update(3, ee_gen);
  ee_count = 0;
  EEPROM.update(4, 0);
  EEPROM.update(7, eeHeaderCrc());
}

void eeSetByte(uint8_t addr, uint8_t v) {
  if (EEPROM.read(addr) == v) return;
  EEPROM.update(addr, v);
  EEPROM.update(7, eeHeaderCrc());
}

// ===========================================================================
// FS6 — ENREGISTREMENT : moyenne de 10 BPM instantanés (60000/IBI) de
//        battements acceptés CONSÉCUTIFS, horodatée à l'appui
// ===========================================================================
RecResult recToggle(uint32_t now) {
  if (rec_active) { rec_active = false; return REC_CANCELLED; }
  if (!hr_valid) return REC_REFUSED_INVALID;          // jamais de valeur invalide
  if (ee_count >= EE_CAPACITY) return REC_REFUSED_FULL;
  if (rtc_status != RTC_OK) return REC_REFUSED_RTC;
  rec_data.day = rtc_now.day; rec_data.month = rtc_now.month; rec_data.year = rtc_now.year - 2000;
  rec_data.hour = rtc_now.hour; rec_data.minute = rtc_now.minute; rec_data.second = rtc_now.second;
  rec_active = true; rec_n = 0; rec_sum = 0; rec_start = now;
  return REC_STARTED;
}

RecResult recOnEvents(uint8_t ev) {
  if (!rec_active) return REC_NONE;
  if (ev & EV_REJECTED) { rec_n = 0; rec_sum = 0; }   // série interrompue
  if ((ev & EV_ACCEPTED) && hr_valid && hr_lastIbi) {
    rec_sum += (600000UL + hr_lastIbi / 2) / hr_lastIbi;  // BPM instantané x10
    if (++rec_n >= RECORD_SAMPLES) {
      rec_active = false;
      rec_data.bpm = (rec_sum + 5UL * RECORD_SAMPLES) / (10UL * RECORD_SAMPLES);
      rec_lastBpm = rec_data.bpm;
      return eeAppend(rec_data) ? REC_SAVED : REC_REFUSED_FULL;
    }
  }
  return REC_NONE;
}

RecResult recUpdate(uint32_t now) {
  if (!rec_active) return REC_NONE;
  if (!hr_valid) { rec_active = false; return REC_CANCELLED; }
  if ((uint32_t)(now - rec_start) >= RECORD_TIMEOUT_MS) { rec_active = false; return REC_TIMEOUT; }
  return REC_NONE;
}

// ===========================================================================
// FS5 — ÉCRANS : texte en mode caractères (0 o de RAM, seules les lignes
//        modifiées sont renvoyées) ; courbe en mode page, 1 bande par loop()
// ===========================================================================
bool i2cProbe(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void graphSetScale(uint8_t idx) {
  if (idx >= SCALE_COUNT) idx = SCALE_COUNT - 1;
  g_scale = idx;
  g_spc = pgm_read_byte(&SCALE_S[idx]) * SAMPLE_RATE_HZ / PLOT_W;   // échelle exacte
  col_head = 0; col_count = 0; acc_n = 0;                          // repart à vide
}

void dispBegin() {
  Wire.begin();
  Wire.setWireTimeout(25000, true);       // bus bloqué -> pas de blocage du programme
  textOk = i2cProbe(OLED_TEXT_ADDR);
  graphOk = i2cProbe(OLED_GRAPH_ADDR);
  if (textOk) {
#if OLED_SH1106
    u8x8_Setup(&oledText, u8x8_d_sh1106_128x64_noname, u8x8_cad_ssd13xx_fast_i2c,
               u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#else
    u8x8_Setup(&oledText, u8x8_d_ssd1306_128x64_noname, u8x8_cad_ssd13xx_fast_i2c,
               u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#endif
    u8x8_SetI2CAddress(&oledText, OLED_TEXT_ADDR << 1);
    oledText.bus_clock = I2C_CLOCK_HZ;
    u8x8_InitDisplay(&oledText);
    u8x8_ClearDisplay(&oledText);
    u8x8_SetPowerSave(&oledText, 0);
    u8x8_SetFont(&oledText, u8x8_font_chroma48medium8_r);
  }
  if (graphOk) {
#if OLED_SH1106
    u8g2_Setup_sh1106_i2c_128x64_noname_1(&oledGraph, U8G2_R0, u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#else
    u8g2_Setup_ssd1306_i2c_128x64_noname_1(&oledGraph, U8G2_R0, u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#endif
    u8g2_SetI2CAddress(&oledGraph, OLED_GRAPH_ADDR << 1);
    u8g2_GetU8x8(&oledGraph)->bus_clock = I2C_CLOCK_HZ;
    u8g2_InitDisplay(&oledGraph);
    u8g2_ClearDisplay(&oledGraph);
    u8g2_SetPowerSave(&oledGraph, 0);
  }
  Wire.setWireTimeout(25000, true);
  for (uint8_t i = 0; i < 8; i++) rowHash[i] = 0;
  graphSetScale(1);
}

// Normalisation verticale sur le centre et l'écart des enveloppes ; chaque
// colonne garde le min et le max de ses T échantillons.
void graphPush(const PPGSample &s) {
  const int32_t centre = ((int32_t)s.envMax + s.envMin) / 2;
  int32_t half = ((int32_t)s.envMax - s.envMin) / 2;
  if (half < (MIN_AMPLITUDE_ADC << (SIGNAL_SHIFT - 1))) half = MIN_AMPLITUDE_ADC << (SIGNAL_SHIFT - 1);
  int32_t y = 32 - ((s.filtered - centre) * 19) / half;    // tracé : lignes 10 à 54
  const uint8_t yy = constrain(y, 10, 54);
  if (acc_n == 0) { acc_min = last_y; acc_max = last_y; }   // trait continu
  if (yy < acc_min) acc_min = yy;
  if (yy > acc_max) acc_max = yy;
  last_y = yy;
  if (++acc_n >= g_spc) {
    col_min[col_head] = acc_min;
    col_max[col_head] = acc_max;
    col_head = (col_head + 1) % PLOT_W;
    if (col_count < PLOT_W) col_count++;
    acc_n = 0;
  }
}

// Texte 8x8 copié directement dans la bande courante (format identique)
void pageText(uint8_t page, uint8_t col, const char *str) {
  if (oledGraph.tile_curr_row != page) return;
  uint8_t *buf = oledGraph.tile_buf_ptr;
  const uint8_t *font = u8x8_font_chroma48medium8_r;
  const uint8_t first = pgm_read_byte(font), last = pgm_read_byte(font + 1);
  for (; *str && col < 16; str++, col++) {
    uint8_t c = *str;
    if (c < first || c > last) c = ' ';
    const uint8_t *g = font + 4 + (uint16_t)(c - first) * 8;
    for (uint8_t i = 0; i < 8; i++) buf[col * 8 + i] = pgm_read_byte(g + i);
  }
}

void drawGraphPage(uint32_t now) {
  u8g2_t *g = &oledGraph;
  const uint8_t xR = 1 + PLOT_W;                          // bord droit = maintenant
  u8g2_DrawFrame(g, 0, 9, PLOT_W + 2, 47);
  for (uint8_t x = 1; x < xR; x += 4) u8g2_DrawPixel(g, x, 32);
  const uint8_t div = pgm_read_byte(&DIV_PX[g_scale]);
  for (int16_t x = xR - div; x > 1; x -= div)
    for (uint8_t y = 10; y <= 54; y += 3) u8g2_DrawPixel(g, x, y);
  const uint8_t start = (snapHead + PLOT_W - snapCount) % PLOT_W;
  uint8_t x = xR - snapCount;
  for (uint8_t i = 0; i < snapCount; i++, x++) {
    const uint8_t c = (start + i) % PLOT_W;
    u8g2_DrawVLine(g, x, col_min[c], col_max[c] - col_min[c] + 1);
  }
  if (beatSeen && (uint32_t)(now - beatFlashMs) < 150) u8g2_DrawBox(g, 109, 26, 14, 14);

  char b[17];
  pageText(0, 0, "PPG");
  if (hrBpm()) strcpy_P(fmtU(b, hrBpm(), 3, ' '), PSTR(" BPM"));
  else strcpy_P(b, PSTR(" -- BPM"));
  pageText(0, 9, b);
  b[0] = '-';
  strcpy_P(fmtU(b + 1, pgm_read_byte(&SCALE_S[g_scale]), 0, ' '), PSTR("s"));
  pageText(7, 0, b);
  strcpy_P(b, (const char *)pgm_read_ptr(&LBL_DIV[g_scale]));
  pageText(7, 5, b);
  pageText(7, 12, "0");
  if (!g_signalOk) {
    copyStr(STR_NO_SIGNAL, ee_lang, b, sizeof b);
    pageText(4, (16 - strlen(b)) / 2, b);
  }
}

void updateGraph(uint32_t now) {
  if (!graphOk) return;
  if (!inFrame) {
    if ((uint32_t)(now - frameStart) < GRAPH_REFRESH_MS) return;
    frameStart = now;
    snapHead = col_head;
    snapCount = col_count;
    u8g2_FirstPage(&oledGraph);
    inFrame = true;
  }
  drawGraphPage(now);
  if (!u8g2_NextPage(&oledGraph)) inFrame = false;        // envoie 1 bande (128 o)
}

uint16_t fnv16(const char *s, uint8_t flags) {
  uint32_t h = 2166136261UL;
  h = (h ^ flags) * 16777619UL;
  while (*s) h = (h ^ (uint8_t)*s++) * 16777619UL;
  uint16_t r = h ^ (h >> 16);
  return r ? r : 1;
}

void updateText(uint32_t now) {
  if (!textOk) return;
  if (textRow == 0) {
    if ((uint32_t)(now - lastTextPass) < TEXT_REFRESH_MS) return;
    lastTextPass = now;
  }
  uint8_t drawn = 0;
  while (textRow < 8 && drawn < 2) {                       // au plus 2 lignes
    char buf[17];
    buf[0] = 0;
    const uint8_t flags = composeLine(textRow, buf);
    const uint8_t width = (flags & LINE_BIG) ? 8 : 16;
    uint8_t len = strlen(buf);
    if (len > width) len = width;
    while (len < width) buf[len++] = ' ';
    buf[width] = 0;
    const uint16_t h = fnv16(buf, flags);
    if (h != rowHash[textRow]) {                           // seulement si modifiée
      u8x8_SetInverseFont(&oledText, (flags & LINE_INVERSE) ? 1 : 0);
      if (flags & LINE_BIG) {
        u8x8_Draw2x2String(&oledText, 0, textRow, buf);
        if (textRow < 7) rowHash[textRow + 1] = 0;
      } else {
        u8x8_DrawString(&oledText, 0, textRow, buf);
      }
      rowHash[textRow] = h;
      drawn++;
    }
    textRow += (flags & LINE_BIG) ? 2 : 1;
  }
  if (textRow >= 8) textRow = 0;
}

// ===========================================================================
// FS5 / FS6 — MENU et contenu de l'écran texte
// ===========================================================================
void menuMessage(uint32_t now, StrId id, int16_t number) {
  ui_msg = id; ui_msgNum = number; ui_msgStart = now;
}

void menuTick(uint32_t now) {
  if (ui_msg != STR_COUNT && (uint32_t)(now - ui_msgStart) >= MESSAGE_MS) ui_msg = STR_COUNT;
  if (ui_mode != UI_HOME && (uint32_t)(now - ui_lastActivity) >= MENU_TIMEOUT_MS) ui_mode = UI_HOME;
}

void menuHandle(uint32_t now, int8_t d, uint8_t ev) {
  if (d || ev) ui_lastActivity = now;
  if (ev & BTN_LONG) { ui_mode = UI_HOME; return; }       // appui long : accueil
  switch (ui_mode) {
    case UI_HOME:
      if (d) graphSetScale(constrain((int8_t)g_scale + d, 0, SCALE_COUNT - 1));  // base de temps
      if (ev & BTN_SHORT) { ui_cursor = 0; ui_mode = UI_MENU; }
      break;
    case UI_MENU:
      if (d) ui_cursor = (ui_cursor + MI_COUNT + (d % MI_COUNT)) % MI_COUNT;
      if (ev & BTN_SHORT) {
        switch (ui_cursor) {
          case MI_HISTORY:  ui_histPos = 0; ui_mode = UI_HISTORY; break;
          case MI_ERASE:    ui_eraseYes = false; ui_mode = UI_ERASE; break;   // NON par défaut
          case MI_LANGUAGE: appSetLanguage(ee_lang ? 0 : 1); break;
          case MI_BUZZER:   appSetBuzzer(!buz_enabled); break;
          default:          ui_mode = UI_HOME; break;     // Mesure, Retour
        }
      }
      break;
    case UI_HISTORY:
      if (ee_count && d) ui_histPos = constrain((int16_t)ui_histPos + d, 0, ee_count - 1);
      if (ev & BTN_SHORT) ui_mode = UI_MENU;
      break;
    case UI_ERASE:
      if (d) ui_eraseYes = !ui_eraseYes;
      if (ev & BTN_SHORT) {
        if (ui_eraseYes) { eeErase(); menuMessage(now, STR_MSG_ERASED, -1); buzzerUi(); }
        ui_mode = UI_MENU;
      }
      break;
  }
}

void centre(char *buf) {
  uint8_t len = strlen(buf);
  if (len >= 16) return;
  const uint8_t pad = (16 - len) / 2;
  memmove(buf + pad, buf, len + 1);
  memset(buf, ' ', pad);
}

void fmtBig(char *buf, uint16_t bpm) {
  if (bpm) strcpy_P(fmtU(buf, bpm, 3, ' '), PSTR(" BPM"));
  else strcpy_P(buf, PSTR(" -- BPM"));
}

uint8_t centredStr(StrId id, char *buf, uint8_t flags) {
  copyStr(id, ee_lang, buf, 17);
  centre(buf);
  return flags;
}

uint8_t messageLine(char *buf) {
  if (ui_msg == STR_COUNT) return LINE_NORMAL;
  copyStr(ui_msg, ee_lang, buf, 17);
  if (ui_msgNum >= 0 && strlen(buf) < 12) fmtU(buf + strlen(buf), ui_msgNum, 0, ' ');
  centre(buf);
  return LINE_INVERSE;
}

uint8_t homeLine(uint8_t row, char *buf) {
  switch (row) {
    case 0: return centredStr(STR_TITLE, buf, LINE_INVERSE);
    case 1:
      if (rtc_status == RTC_OK) fmtTime(buf, rtc_now.hour, rtc_now.minute, rtc_now.second);
      else strcpy_P(buf, PSTR("--:--:--"));
      centre(buf);
      return LINE_NORMAL;
    case 2:
      if (rtc_status != RTC_OK) return centredStr(STR_RTC_NOT_SET, buf, LINE_NORMAL);
      fmtDate(buf, rtc_now.day, rtc_now.month, rtc_now.year);
      centre(buf);
      return LINE_NORMAL;
    case 3: fmtBig(buf, hrBpm()); return LINE_BIG;
    case 5: {                                              // "SON:ON   MEM:12"
      char tmp[4], right[11];
      copyStr(STR_SOUND, ee_lang, buf, 17);
      strcat_P(buf, PSTR(":"));
      copyStr(buz_enabled ? STR_ON : STR_OFF, ee_lang, tmp, sizeof tmp);
      strcat(buf, tmp);
      if (rec_active) {
        copyStr(STR_REC_PREFIX, ee_lang, right, 4);
        char *q = right + strlen(right);
        *q++ = ' ';
        q = fmtU(q, rec_n, 0, ' ');
        *q++ = '/';
        fmtU(q, RECORD_SAMPLES, 0, ' ');
      } else {
        strcpy_P(right, PSTR("MEM:"));
        fmtU(right + 4, ee_count, 0, ' ');
      }
      uint8_t l = strlen(buf);
      while (l + strlen(right) < 16) buf[l++] = ' ';
      buf[l] = 0;
      strcat(buf, right);
      return LINE_NORMAL;
    }
    case 6: {
      const HrClass c = hrClass();
      const StrId id = c == HR_LOW ? STR_STATE_LOW : c == HR_NORMAL ? STR_STATE_NORMAL :
                       c == HR_HIGH ? STR_STATE_HIGH : (g_signalOk ? STR_SEARCHING : STR_SIGNAL_INVALID);
      return centredStr(id, buf, LINE_NORMAL);
    }
    case 7: return messageLine(buf);
  }
  return LINE_NORMAL;
}

uint8_t menuLine(uint8_t row, char *buf) {
  if (row == 0) return centredStr(STR_MENU_TITLE, buf, LINE_INVERSE);
  if (row <= MI_COUNT) {
    const uint8_t item = row - 1;
    buf[0] = item == ui_cursor ? '>' : ' ';
    buf[1] = ' ';
    copyStr((StrId)pgm_read_byte(&MENU_LABEL[item]), ee_lang, buf + 2, 15);
    if (item == MI_BUZZER) strcat_P(buf, buz_enabled ? PSTR(" ON") : PSTR(" OFF"));
    return LINE_NORMAL;
  }
  if (ui_msg != STR_COUNT) return messageLine(buf);
  return centredStr(STR_HINT_SELECT, buf, LINE_NORMAL);
}

uint8_t historyLine(uint8_t row, char *buf) {
  if (row == 0) return centredStr(STR_HIST_TITLE, buf, LINE_INVERSE);
  if (row == 7) return centredStr(STR_HINT_BACK, buf, LINE_NORMAL);
  if (ee_count == 0) return row == 3 ? centredStr(STR_HIST_EMPTY, buf, LINE_NORMAL) : (uint8_t)LINE_NORMAL;
  if (ui_histPos >= ee_count) ui_histPos = ee_count - 1;
  const uint8_t index = ee_count - 1 - ui_histPos;        // plus récent d'abord
  if (row == 1) {
    char *q = buf;
    *q++ = '#';
    q = fmtU(q, index + 1, 0, ' ');
    strcpy_P(q, PSTR(" / "));
    fmtU(q + 3, ee_count, 0, ' ');
    centre(buf);
    return LINE_NORMAL;
  }
  Record r;
  if (!eeRead(index, r)) return row == 3 ? centredStr(STR_HIST_CORRUPT, buf, LINE_NORMAL) : (uint8_t)LINE_NORMAL;
  if (row == 3) { fmtBig(buf, r.bpm); return LINE_BIG; }
  if (row == 5) { fmtDate(buf, r.day, r.month, 2000 + r.year); centre(buf); }
  if (row == 6) { fmtTime(buf, r.hour, r.minute, r.second); centre(buf); }
  return LINE_NORMAL;
}

uint8_t eraseLine(uint8_t row, char *buf) {
  if (row == 0) return centredStr(STR_ERASE_TITLE, buf, LINE_INVERSE);
  if (row == 2) return centredStr(STR_ERASE_WARN, buf, LINE_NORMAL);
  if (row == 5) {                                          // "> NON     OUI"
    char no[4], yes[4];
    copyStr(STR_NO, ee_lang, no, 4);
    copyStr(STR_YES, ee_lang, yes, 4);
    memset(buf, ' ', 16);
    buf[16] = 0;
    buf[1] = ui_eraseYes ? ' ' : '>';
    memcpy(buf + 3, no, strlen(no));
    buf[9] = ui_eraseYes ? '>' : ' ';
    memcpy(buf + 11, yes, strlen(yes));
  }
  if (row == 7) return centredStr(STR_HINT_SELECT, buf, LINE_NORMAL);
  return LINE_NORMAL;
}

uint8_t composeLine(uint8_t row, char *buf) {
  buf[0] = 0;
  switch (ui_mode) {
    case UI_MENU:    return menuLine(row, buf);
    case UI_HISTORY: return historyLine(row, buf);
    case UI_ERASE:   return eraseLine(row, buf);
    default:         return homeLine(row, buf);
  }
}

// ===========================================================================
// CONSOLE SÉRIE
// ===========================================================================
void kv(const __FlashStringHelper *k, long v) {
  Serial.print(k); Serial.print('='); Serial.print(v); Serial.print(' ');
}

bool parseFixed(const char *&p, uint8_t digits, uint16_t &out, char sep) {
  out = 0;
  for (uint8_t i = 0; i < digits; i++) {
    if (*p < '0' || *p > '9') return false;
    out = out * 10 + (*p++ - '0');
  }
  if (sep) { if (*p != sep) return false; p++; }
  return true;
}

bool startsWith(const char *s, const char *pgm) { return strncmp_P(s, pgm, strlen_P(pgm)) == 0; }

void printDateTime(const DateTime &t) {
  char b[12];
  fmtDate(b, t.day, t.month, t.year);
  Serial.print(b); Serial.print(' ');
  fmtTime(b, t.hour, t.minute, t.second);
  Serial.print(b);
}

int stackNeverUsed() {                 // octets jamais atteints par la pile
  const uint8_t *p = (const uint8_t *)&__heap_start;
  int n = 0;
  while (*p == 0xA5 && p < (const uint8_t *)SP) { p++; n++; }
  return n;
}

void execute(char *l) {
  for (char *c = l; *c; c++) if (*c >= 'a' && *c <= 'z') *c -= 32;
  if (startsWith(l, PSTR("STATUS"))) {
    char v;
    kv(F("bpm_x10"), hr_valid ? hr_bpmX10 : 0);
    kv(F("signal_ok"), g_signalOk);
    kv(F("amp_adc"), g_amplitude);
    kv(F("acc"), hr_acc);
    kv(F("rej"), hr_rej);
    kv(F("fifo_max"), g_fifoMax);
    kv(F("perdus"), g_overruns);
    kv(F("eeprom"), ee_count);
    kv(F("oled1"), textOk);
    kv(F("oled2"), graphOk);
    kv(F("ram_libre"), (int)(&v - (__brkval ? __brkval : &__heap_start)));
    kv(F("pile_marge_min"), stackNeverUsed());
    Serial.println();
  } else if (startsWith(l, PSTR("GET"))) {
    DateTime t;
    Serial.print(F("RTC "));
    const RtcStatus st = rtcRead(t);
    if (st == RTC_OK) printDateTime(t);
    else Serial.print(st == RTC_HALTED ? F("ARRETEE -> SET") : F("INVALIDE"));
    Serial.println();
  } else if (startsWith(l, PSTR("SET "))) {          // SET AAAA-MM-JJ HH:MM:SS
    const char *p = l + 4;
    uint16_t y, mo, d, h, mi, s;
    if (!(parseFixed(p, 4, y, '-') && parseFixed(p, 2, mo, '-') && parseFixed(p, 2, d, ' ') &&
          parseFixed(p, 2, h, ':') && parseFixed(p, 2, mi, ':') && parseFixed(p, 2, s, 0))) {
      Serial.println(F("ERR format"));
      return;
    }
    const DateTime dt = {y, (uint8_t)mo, (uint8_t)d, (uint8_t)h, (uint8_t)mi, (uint8_t)s};
    if (!rtcSet(dt)) { Serial.println(F("ERR date ou RTC")); return; }
    Serial.print(F("RTC OK "));
    printDateTime(rtc_now);
    Serial.println();
  } else if (startsWith(l, PSTR("PLOT "))) {
    plotMode = l[5] - '0';
    if (plotMode > PLOT_CSV) plotMode = PLOT_OFF;
    if (plotMode == PLOT_CSV) Serial.println(F("t_ms,raw,filtered_x8,thr_high_x8,thr_low_x8,signal_ok,beat,bpm_x10"));
  } else if (startsWith(l, PSTR("DUMP"))) {
    Serial.println(F("index,bpm,date,heure"));
    for (uint8_t i = 0; i < ee_count; i++) {
      Record r;
      Serial.print(i + 1); Serial.print(',');
      if (!eeRead(i, r)) { Serial.println(F("CRC,,")); continue; }
      char b[12];
      Serial.print(r.bpm); Serial.print(',');
      fmtDate(b, r.day, r.month, 2000 + r.year); Serial.print(b); Serial.print(',');
      fmtTime(b, r.hour, r.minute, r.second); Serial.println(b);
    }
  } else if (startsWith(l, PSTR("ERASE YES"))) {
    eeErase();
    Serial.println(F("OK"));
  } else {
    Serial.println(F("STATUS | GET | SET AAAA-MM-JJ HH:MM:SS | PLOT 0/1/2 | DUMP | ERASE YES"));
  }
}

void consoleUpdate() {
  for (uint8_t k = 0; k < 16 && Serial.available(); k++) {
    const char c = Serial.read();
    if (c == '\r' || c == '\n') {
      if (con_len) {
        con_line[con_len] = 0;
        const uint8_t saved = plotMode;
        plotMode = PLOT_OFF;
        execute(con_line);
        if (!startsWith(con_line, PSTR("PLOT "))) plotMode = saved;
        con_len = 0;
      }
    } else if (con_len < sizeof con_line - 1) {
      con_line[con_len++] = c;
    }
  }
}

// Sortie temps réel : ligne abandonnée plutôt que bloquer si tampon plein
void plotSample(const PPGSample &s, bool beat) {
  if (plotMode == PLOT_OFF || Serial.availableForWrite() < 50) return;
  if (plotMode == PLOT_ARDUINO) {
    Serial.print(F("filtre:")); Serial.print(s.filtered >> SIGNAL_SHIFT);
    Serial.print(F(",seuil:")); Serial.print(s.thrHigh >> SIGNAL_SHIFT);
    Serial.print(F(",battement:")); Serial.println(beat ? 40 : 0);
  } else {
    const long v[8] = {(long)s.tMs, s.raw, s.filtered, s.thrHigh, s.thrLow, s.signalOk, beat,
                       hr_valid ? hr_bpmX10 : 0};
    for (uint8_t i = 0; i < 8; i++) { if (i) Serial.print(','); Serial.print(v[i]); }
    Serial.println();
  }
}

// ===========================================================================
// PROGRAMME PRINCIPAL
// ===========================================================================
void appSetBuzzer(bool on) {
  buz_enabled = on;
  if (on) buzzerUi(); else toneStop();
  ee_buzzer = on;
  eeSetByte(6, on);                     // écrit seulement si changé
}

void appSetLanguage(uint8_t lang) {
  ee_lang = lang > 1 ? 0 : lang;
  eeSetByte(5, ee_lang);
}

void showRecordResult(uint32_t now, RecResult r) {
  switch (r) {
    case REC_STARTED: buzzerUi(); break;
    case REC_SAVED:
      menuMessage(now, STR_MSG_SAVED, ee_count);
      buzzerUi();
      Serial.print(F("Enregistrement #")); Serial.print(ee_count);
      Serial.print(F(" : ")); Serial.print(rec_lastBpm); Serial.println(F(" BPM"));
      break;
    case REC_CANCELLED:       menuMessage(now, STR_MSG_CANCELLED, -1); break;
    case REC_TIMEOUT:         menuMessage(now, STR_MSG_TIMEOUT, -1); break;
    case REC_REFUSED_INVALID: menuMessage(now, STR_MSG_INVALID, -1); break;
    case REC_REFUSED_RTC:     menuMessage(now, STR_MSG_RTC, -1); break;
    case REC_REFUSED_FULL:    menuMessage(now, STR_MSG_FULL, -1); break;
    default: break;
  }
}

// FS1 : traitement prioritaire de tous les échantillons en attente
void processSamples(uint8_t maxCount) {
  uint16_t raw;
  uint32_t index;
  while (maxCount-- && ppgPop(raw, index)) {
    const uint32_t tMs = index * SAMPLE_PERIOD_MS;      // base de temps = quartz
    PPGSample s;
    procProcess(raw, tMs, s);
    const uint8_t ev = hrUpdate(tMs, s.signalOk, s.beat, s.beatTimeMs);
    p_refractory = hrRefractory();
    g_signalOk = s.signalOk;
    g_amplitude = s.amplitudeAdc;
    graphPush(s);
    const bool accepted = (ev & EV_ACCEPTED) && hr_valid;
    if (accepted) {
      buzzerBeat(hrClass());                            // FS4 : bip par battement
      beatFlashMs = millis();
      beatSeen = true;
    }
    const RecResult rr = recOnEvents(ev);
    if (rr != REC_NONE) showRecordResult(millis(), rr);
    plotSample(s, accepted);
  }
}

void setup() {
  // Remplit la RAM libre d'un motif pour mesurer la marge de pile (STATUS)
  for (uint8_t *p = (uint8_t *)&__heap_start; p < (uint8_t *)SP - 16; p++) *p = 0xA5;
  Serial.begin(115200);
  eeBegin();
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  updateHeartRateIndicators(HR_NONE);
  pinMode(PIN_BUZZER, OUTPUT);
  buz_pinReg = portInputRegister(digitalPinToPort(PIN_BUZZER));
  buz_mask = digitalPinToBitMask(PIN_BUZZER);
  buz_enabled = ee_buzzer;
  inputsBegin();
  rtcBegin();
  dispBegin();
  Serial.println(F("=== CARDIO ECE ==="));
  if (ee_formatted) Serial.println(F("EEPROM initialisee"));
  if (ee_recovered) Serial.println(F("EEPROM reparee"));
  Serial.print(F("Enreg. ")); Serial.println(ee_count);
  if (rtc_status != RTC_OK) Serial.println(F("RTC non reglee -> SET AAAA-MM-JJ HH:MM:SS"));
  if (!textOk) Serial.println(F("OLED1 absent"));
  if (!graphOk) Serial.println(F("OLED2 absent"));
  ppgBegin();                            // en dernier : l'acquisition démarre
}

void loop() {
  const uint32_t now = millis();
  processSamples(FIFO_SIZE);             // 1. priorité au signal PPG

  inputsUpdate(now);                     // 2. boutons et encodeur
  const uint8_t rec = btnEvents(BTN_RECORD);
#if HAS_BUZZER_BUTTON
  if (rec & BTN_PRESS) showRecordResult(now, recToggle(now));
  if (btnEvents(BTN_BUZZER) & BTN_PRESS) appSetBuzzer(!buz_enabled);
#else
  if (rec & BTN_SHORT) showRecordResult(now, recToggle(now));
  if (rec & BTN_LONG) appSetBuzzer(!buz_enabled);
#endif
  const int8_t d = encoderDelta();
  const uint8_t enc = btnEvents(BTN_ENCODER);
  if (d || enc) menuHandle(now, d, enc);

  rtcUpdate(now);                        // 3. heure (toutes les 200 ms)
  processSamples(4);

  const RecResult rr = recUpdate(now);   // 4. annulation / délai d'enregistrement
  if (rr != REC_NONE) showRecordResult(now, rr);

  updateHeartRateIndicators(hrClass());  // 5. LED (écrites si changement)

  menuTick(now);                         // 6. écrans : 2 lignes OU 1 bande
  displayTurn = !displayTurn;
  if (displayTurn) updateText(now); else updateGraph(now);
  processSamples(4);

  consoleUpdate();                       // 7. console série
}
