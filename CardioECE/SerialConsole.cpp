#include <Arduino.h>
#include "SerialConsole.h"
#include "App.h"
#include "RTCManager.h"
#include "BuzzerManager.h"
#include "PPGSensor.h"
#include "Strings.h"
#include "DisplayManager.h"
#include "Format.h"

static char     s_line[SERIAL_LINE_MAX];
static uint8_t  s_len = 0;
static uint32_t s_dropped = 0;

// Symboles de l'éditeur de liens avr-libc : début du tas / sommet du tas.
extern char __heap_start;
extern char *__brkval;

static int freeRam() {
  // Distance entre le sommet du tas et la pile : marge de SRAM actuelle.
  char v;
  return (int)(&v - (__brkval == 0 ? &__heap_start : __brkval));
}

// Mesure du pire cas de pile : au démarrage, la zone libre entre le tas et
// la pile est remplie d'un motif ; STATUS compte les octets JAMAIS écrasés
// depuis -> marge minimale réellement observée (et non estimée).
static const uint8_t STACK_PAINT = 0xA5;

void SerialConsole::paintStack() {
  uint8_t *p = (uint8_t *)&__heap_start;
  uint8_t *sp = (uint8_t *)SP;
  while (p < sp - 16) *p++ = STACK_PAINT;   // 16 o de garde sous la pile active
}

static int stackNeverUsed() {
  const uint8_t *p = (const uint8_t *)&__heap_start;
  int n = 0;
  while (*p == STACK_PAINT && p < (const uint8_t *)SP) { p++; n++; }
  return n;
}

// "cle=valeur " : une seule fonction pour tout l'affichage d'état (Flash).
static void kv(const __FlashStringHelper *k, long v) {
  Serial.print(k);
  Serial.print('=');
  Serial.print(v);
  Serial.print(' ');
}

// Nombre décimal "72" ou "72.5" -> valeur x10 ; renvoie -1 si absent.
#if SIMULATION_MODE
static long parseX10(const char *&p) {
  while (*p == ' ') p++;
  if (*p < '0' || *p > '9') return -1;
  long v = 0;
  while (*p >= '0' && *p <= '9') v = v * 10 + (*p++ - '0');
  v *= 10;
  if (*p == '.' && p[1] >= '0' && p[1] <= '9') { v += p[1] - '0'; p += 2; }
  while (*p >= '0' && *p <= '9') p++;
  return v;
}
#endif

static bool parseFixed(const char *&p, uint8_t digits, uint16_t &out, char sep) {
  out = 0;
  for (uint8_t i = 0; i < digits; i++) {
    if (*p < '0' || *p > '9') return false;
    out = (uint16_t)(out * 10 + (*p++ - '0'));
  }
  if (sep) { if (*p != sep) return false; p++; }
  return true;
}

static bool is(const char *s, const char *pgmPrefix) {
  return strncmp_P(s, pgmPrefix, strlen_P(pgmPrefix)) == 0;
}

static void printDateTime(const DateTime &t) {
  char b[12];
  fmtDate(b, t.day, t.month, t.year);
  Serial.print(b);
  Serial.print(' ');
  fmtTime(b, t.hour, t.minute, t.second);
  Serial.print(b);
}

static void cmdGet() {
  DateTime t;
  Serial.print(F("RTC "));
  if (RTCManager::readNow(t)) printDateTime(t);
  else Serial.print(RTCManager::status() == RTC_HALTED ? F("ARRETEE -> SET") : F("INVALIDE"));
  Serial.print(F(" millis="));
  Serial.println(millis());
}

static void cmdSet(const char *p) {
  // Format strict "AAAA-MM-JJ HH:MM:SS" (24 h)
  uint16_t y, mo, d, h, mi, s;
  if (!(parseFixed(p, 4, y, '-') && parseFixed(p, 2, mo, '-') && parseFixed(p, 2, d, ' ') &&
        parseFixed(p, 2, h, ':') && parseFixed(p, 2, mi, ':') && parseFixed(p, 2, s, 0))) {
    Serial.println(F("ERR format"));
    return;
  }
  const DateTime dt = {y, (uint8_t)mo, (uint8_t)d, (uint8_t)h, (uint8_t)mi, (uint8_t)s, 1};
  if (!RTCManager::isDateValid(dt)) { Serial.println(F("ERR date")); return; }
  if (!RTCManager::setDateTime(dt)) { Serial.println(F("ERR RTC")); return; }
  Serial.print(F("RTC OK "));
  printDateTime(RTCManager::now());
  Serial.println();
}

static void cmdStatus() {
  Serial.println(SIMULATION_MODE ? F("SIMULATION") : F("CAPTEUR"));
  kv(F("bpm_x10"), g_hr.bpmX10());
  kv(F("classe"), g_hr.hrClass());
  kv(F("signal_ok"), g_signalOk);
  kv(F("amp_adc"), g_amplitudeAdc);
  kv(F("acc"), (long)g_hr.acceptedBeats());
  kv(F("rej"), (long)g_hr.rejectedBeats());
  kv(F("ibi"), g_hr.lastIbiMs());
  kv(F("refr"), g_proc.refractoryMs());
  Serial.println();
  kv(F("fifo"), PPGSensor::fifoLevel());
  kv(F("fifo_max"), PPGSensor::maxLevel());
  kv(F("perdus"), PPGSensor::overruns());
  kv(F("eeprom"), g_eeprom.count());
  kv(F("lang"), g_eeprom.language());
  kv(F("buz"), BuzzerManager::isEnabled());
  kv(F("oled1"), DisplayManager::textPresent());
  kv(F("oled2"), DisplayManager::graphPresent());
  kv(F("echelle_s"), DisplayManager::scaleSeconds());
  kv(F("ram_libre"), freeRam());
  kv(F("pile_marge_min"), stackNeverUsed());
  kv(F("lignes_perdues"), (long)s_dropped);
  Serial.println();
}

static void cmdDump() {
  Serial.println(F("index,bpm,date,heure"));
  for (uint8_t i = 0; i < g_eeprom.count(); i++) {
    Record r;
    Serial.print(i + 1);
    Serial.print(',');
    if (g_eeprom.read(i, r)) {
      char b[12];
      Serial.print(r.bpm);
      Serial.print(',');
      fmtDate(b, r.day, r.month, (uint16_t)(2000 + r.year));
      Serial.print(b);
      Serial.print(',');
      fmtTime(b, r.hour, r.minute, r.second);
      Serial.println(b);
    } else {
      Serial.println(F("CRC,,"));
    }
  }
}

#if SIMULATION_MODE
// SIM BPM 72.5 | SIM NOISE n | SIM DRIFT a s | SIM SPIKES ms h | SIM FINGER 0|1
// SIM CONNECT 0|1 | SIM AMP n
static void cmdSim(const char *p) {
  const char *q = strchr(p, ' ');
  if (!q) { Serial.println(F("ERR")); return; }
  const long a = parseX10(q);          // 1er nombre (x10)
  const long b = parseX10(q);          // 2e nombre éventuel (x10)
  if (a < 0) { Serial.println(F("ERR")); return; }
  const uint16_t ia = (uint16_t)(a / 10);
  if (is(p, PSTR("BPM")) && a >= 200 && a <= 2500) g_sim.setBpmX10((uint16_t)a);
  else if (is(p, PSTR("NOISE"))) g_sim.setNoise(ia);
  else if (is(p, PSTR("DRIFT"))) g_sim.setDrift(ia, b > 0 ? (uint16_t)(b / 10) : 20);
  else if (is(p, PSTR("SPIKES"))) g_sim.setSpikes(ia, b > 0 ? (uint16_t)(b / 10) : 100);
  else if (is(p, PSTR("FINGER"))) g_sim.setFinger(ia != 0);
  else if (is(p, PSTR("CONNECT"))) g_sim.setSignalPresent(ia != 0);
  else if (is(p, PSTR("AMP"))) g_sim.setAmplitude(ia);
  else { Serial.println(F("ERR")); return; }
  kv(F("SIM bpm_x10"), g_sim.bpmX10());
  Serial.println();
}
#endif

static const char HELP_TEXT[] PROGMEM =
  "STATUS GET DUMP TEST | SET AAAA-MM-JJ HH:MM:SS | PLOT 0-3 | ERASE YES | LANG FR/EN | BUZ ON/OFF"
#if SIMULATION_MODE
  " | SIM BPM/NOISE/DRIFT/SPIKES/FINGER/CONNECT/AMP n"
#endif
  ;

static void execute(char *l) {
  for (char *c = l; *c; c++) if (*c >= 'a' && *c <= 'z') *c = (char)(*c - 32);  // majuscules
  if (is(l, PSTR("STATUS"))) cmdStatus();
  else if (is(l, PSTR("GET"))) cmdGet();
  else if (is(l, PSTR("SET "))) cmdSet(l + 4);
  else if (is(l, PSTR("PLOT "))) {
    const uint8_t m = (uint8_t)(l[5] - '0');
    if (m <= PLOT_CSV) {
      g_plotMode = m;
      if (m == PLOT_CSV) {
        Serial.println(SIMULATION_MODE ? F("# source=SIMULATION") : F("# source=CAPTEUR_WPSE340"));
        Serial.println(F("t_ms,raw,filtered_x8,thr_high_x8,thr_low_x8,signal_ok,beat,bpm_x10"));
      }
    }
  }
  else if (is(l, PSTR("DUMP"))) cmdDump();
  else if (is(l, PSTR("ERASE YES"))) { g_eeprom.eraseAll(); Serial.println(F("OK")); }
  else if (is(l, PSTR("LANG "))) appSetLanguage(l[5] == 'E' ? LANG_EN : LANG_FR);
  else if (is(l, PSTR("BUZ "))) appSetBuzzer(l[5] == 'N');      // "BUZ ON" / "BUZ OFF"
  else if (is(l, PSTR("TEST"))) appStartSelfTest();
#if SIMULATION_MODE
  else if (is(l, PSTR("SIM "))) cmdSim(l + 4);
#endif
  else Serial.println((const __FlashStringHelper *)HELP_TEXT);
}

void SerialConsole::begin() { s_len = 0; }

void SerialConsole::update() {
  // Au plus 16 caractères par appel : la console ne monopolise jamais loop().
  for (uint8_t k = 0; k < 16 && Serial.available(); k++) {
    const char c = (char)Serial.read();
    if (c == '\r' || c == '\n') {
      if (s_len > 0) {
        s_line[s_len] = 0;
        // Le flux temps réel est suspendu pendant l'exécution de la commande
        const uint8_t saved = g_plotMode;
        g_plotMode = PLOT_OFF;
        execute(s_line);
        if (!is(s_line, PSTR("PLOT "))) g_plotMode = saved;
        s_len = 0;
      }
    } else if (s_len < SERIAL_LINE_MAX - 1) {
      s_line[s_len++] = c;
    }
  }
}

uint32_t SerialConsole::droppedLines() { return s_dropped; }

static void plotKV(const __FlashStringHelper *k, long v) {
  Serial.print(k);
  Serial.println(v);
}

void SerialConsole::plotSample(const PPGSample &s, bool beatAccepted) {
  if (g_plotMode == PLOT_OFF) return;
  // Ligne la plus longue ≈ 50 caractères : si le tampon d'émission (64 o)
  // n'a pas la place, on abandonne la ligne au lieu de BLOQUER loop().
  if (Serial.availableForWrite() < 50) { s_dropped++; return; }
  const int16_t f = (int16_t)(s.filtered >> SIGNAL_SHIFT);    // en pas ADC
  const int16_t th = (int16_t)(s.thrHigh >> SIGNAL_SHIFT);
  if (g_plotMode == PLOT_ARDUINO) {          // Serial Plotter : "nom:valeur,..."
    Serial.print(F("filtre:")); Serial.print(f);
    Serial.print(F(",seuil:")); Serial.print(th);
    Serial.print(F(",battement:")); Serial.println(beatAccepted ? 40 : 0);
  } else if (g_plotMode == PLOT_TELEPLOT) {  // Teleplot (VS Code) : ">nom:valeur"
    plotKV(F(">brut:"), s.raw);
    plotKV(F(">filtre:"), f);
    plotKV(F(">seuil:"), th);
    if (beatAccepted) plotKV(F(">bpm:"), g_hr.bpm());
  } else {                                   // CSV (signal en 1/8 de pas ADC)
    const long v[8] = {(long)s.tMs, s.raw, s.filtered, s.thrHigh, s.thrLow,
                       s.signalOk ? 1 : 0, beatAccepted ? 1 : 0, g_hr.bpmX10()};
    for (uint8_t i = 0; i < 8; i++) {
      if (i) Serial.print(',');
      Serial.print(v[i]);
    }
    Serial.println();
  }
}
