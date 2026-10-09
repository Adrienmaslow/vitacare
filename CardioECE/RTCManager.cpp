#include <Arduino.h>
#include "RTCManager.h"
#include "config.h"

// Registres DS1302 (adresse de commande en écriture ; +1 = lecture)
enum : uint8_t {
  DS_SEC = 0x80, DS_MIN = 0x82, DS_HOUR = 0x84, DS_DATE = 0x86,
  DS_MONTH = 0x88, DS_DAY = 0x8A, DS_YEAR = 0x8C, DS_CTRL = 0x8E,
  DS_TRICKLE = 0x90, DS_CLOCK_BURST = 0xBE
};

static DateTime  s_now = {2000, 1, 1, 0, 0, 0, 6};
static RtcStatus s_status = RTC_INVALID;
static uint32_t  s_lastRead = 0;
static uint8_t   s_errors = 0;

static uint8_t bcd2bin(uint8_t v) { return (uint8_t)((v >> 4) * 10 + (v & 0x0F)); }
static uint8_t bin2bcd(uint8_t v) { return (uint8_t)(((v / 10) << 4) | (v % 10)); }
static bool    bcdOk(uint8_t v)   { return (v & 0x0F) <= 9 && (v >> 4) <= 9; }

// ---------------------------------------------------------------------------
// Couche bit : chaque bit est présenté sur I/O puis validé par un FRONT
// MONTANT de SCLK (écriture). En lecture, le DS1302 présente chaque bit
// après un FRONT DESCENDANT de SCLK. digitalWrite() dure ~4 µs : les temps
// minimaux du DS1302 (≈ 1 µs à 5 V) sont respectés ; delayMicroseconds(1)
// garde une marge si l'on remplace par des accès registres directs.
// ---------------------------------------------------------------------------
static void beginTransfer() {
  digitalWrite(PIN_RTC_SCLK, LOW);
  digitalWrite(PIN_RTC_CE, HIGH);
  delayMicroseconds(4);                      // tCC : CE -> premier front
}

static void endTransfer() {
  digitalWrite(PIN_RTC_CE, LOW);
  pinMode(PIN_RTC_IO, INPUT);
  delayMicroseconds(4);                      // tCWH : CE inactif entre trames
}

// Écrit un octet LSB en premier. Si readAfter, I/O est relâchée AVANT le
// dernier front descendant : c'est sur ce front que le DS1302 commence à
// émettre le premier bit de données (évite un conflit électrique sur I/O).
static void writeByte(uint8_t v, bool readAfter) {
  pinMode(PIN_RTC_IO, OUTPUT);
  for (uint8_t i = 0; i < 8; i++) {
    digitalWrite(PIN_RTC_IO, v & 0x01);
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_SCLK, HIGH);
    delayMicroseconds(1);
    if (readAfter && i == 7) pinMode(PIN_RTC_IO, INPUT);
    digitalWrite(PIN_RTC_SCLK, LOW);
    v >>= 1;
  }
}

static uint8_t readByte() {
  uint8_t v = 0;
  for (uint8_t i = 0; i < 8; i++) {
    delayMicroseconds(1);
    if (digitalRead(PIN_RTC_IO)) v |= (uint8_t)(1 << i);
    digitalWrite(PIN_RTC_SCLK, HIGH);
    delayMicroseconds(1);
    digitalWrite(PIN_RTC_SCLK, LOW);
  }
  return v;
}

static void writeRegister(uint8_t cmd, uint8_t value) {
  beginTransfer();
  writeByte(cmd, false);
  writeByte(value, false);
  endTransfer();
}

// Lecture en rafale des 8 registres d'horloge en UNE trame : les valeurs
// sont figées ensemble (pas de seconde qui change entre deux lectures).
static void burstRead(uint8_t r[8]) {
  beginTransfer();
  writeByte(DS_CLOCK_BURST | 0x01, true);
  for (uint8_t i = 0; i < 8; i++) r[i] = readByte();
  endTransfer();
}

uint8_t RTCManager::dayOfWeek(uint16_t y, uint8_t m, uint8_t d) {
  // Algorithme de Sakamoto -> 0 = dimanche ; converti en 1 = lundi .. 7.
  static const uint8_t t[12] PROGMEM = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
  if (m < 3) y--;
  uint8_t w = (uint8_t)((y + y / 4 - y / 100 + y / 400 + pgm_read_byte(&t[m - 1]) + d) % 7);
  return w == 0 ? 7 : w;
}

bool RTCManager::isDateValid(const DateTime &dt) {
  static const uint8_t dim[12] PROGMEM = {31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (dt.year < 2000 || dt.year > 2099) return false;
  if (dt.month < 1 || dt.month > 12) return false;
  if (dt.day < 1 || dt.day > pgm_read_byte(&dim[dt.month - 1])) return false;
  if (dt.month == 2 && dt.day == 29 && (dt.year % 4) != 0) return false;
  return dt.hour <= 23 && dt.minute <= 59 && dt.second <= 59;
}

// Décodage + contrôles de cohérence d'une trame burst.
static RtcStatus decode(const uint8_t r[8], DateTime &dt) {
  if (r[0] & 0x80) return RTC_HALTED;               // bit CH
  // Module absent : la ligne I/O flotte / est tirée -> 0xFF ou 0x00 partout
  bool allFF = true, all00 = true;
  for (uint8_t i = 0; i < 7; i++) { allFF &= (r[i] == 0xFF); all00 &= (r[i] == 0x00); }
  if (allFF || all00) return RTC_INVALID;
  const uint8_t sec = r[0] & 0x7F, min = r[1] & 0x7F, date = r[3] & 0x3F,
                mon = r[4] & 0x1F, dow = r[5] & 0x07, yr = r[6];
  if (!bcdOk(sec) || !bcdOk(min) || !bcdOk(date) || !bcdOk(mon) || !bcdOk(yr)) return RTC_INVALID;
  uint8_t hour;
  if (r[2] & 0x80) {                                 // mode 12 h (non réglé par nous)
    const uint8_t h12 = r[2] & 0x1F;
    if (!bcdOk(h12)) return RTC_INVALID;
    hour = (uint8_t)(bcd2bin(h12) % 12 + ((r[2] & 0x20) ? 12 : 0));
  } else {
    const uint8_t h24 = r[2] & 0x3F;
    if (!bcdOk(h24)) return RTC_INVALID;
    hour = bcd2bin(h24);
  }
  dt.second = bcd2bin(sec);
  dt.minute = bcd2bin(min);
  dt.hour = hour;
  dt.day = bcd2bin(date);
  dt.month = bcd2bin(mon);
  dt.year = (uint16_t)(2000 + bcd2bin(yr));
  dt.dow = dow;
  return RTCManager::isDateValid(dt) ? RTC_OK : RTC_INVALID;
}

void RTCManager::begin() {
  digitalWrite(PIN_RTC_CE, LOW);
  pinMode(PIN_RTC_CE, OUTPUT);
  digitalWrite(PIN_RTC_SCLK, LOW);
  pinMode(PIN_RTC_SCLK, OUTPUT);
  pinMode(PIN_RTC_IO, INPUT);
  s_lastRead = millis() - RTC_READ_PERIOD_MS;
  update(millis());                 // lecture seule : l'heure n'est PAS modifiée
}

bool RTCManager::readNow(DateTime &dt) {
  uint8_t r[8];
  burstRead(r);
  return decode(r, dt) == RTC_OK;
}

void RTCManager::update(uint32_t nowMs) {
  if ((uint32_t)(nowMs - s_lastRead) < RTC_READ_PERIOD_MS) return;
  s_lastRead = nowMs;
  uint8_t r[8];
  burstRead(r);                     // ≈ 0,7 ms
  DateTime dt;
  const RtcStatus st = decode(r, dt);
  if (st == RTC_OK) {
    s_now = dt;
    s_status = RTC_OK;
    s_errors = 0;
  } else if (st == RTC_HALTED) {
    s_status = RTC_HALTED;
  } else {
    // Une lecture isolée incohérente (parasite) ne suffit pas à invalider
    // l'heure : il faut 3 erreurs consécutives.
    if (s_errors < 255) s_errors++;
    if (s_errors >= 3) s_status = RTC_INVALID;
  }
}

bool RTCManager::setDateTime(const DateTime &in) {
  DateTime dt = in;
  if (!isDateValid(dt)) return false;
  dt.dow = dayOfWeek(dt.year, dt.month, dt.day);
  writeRegister(DS_CTRL, 0x00);         // WP = 0 : autorise l'écriture
  writeRegister(DS_TRICKLE, 0x00);      // chargeur désactivé (pile CR2032 non rechargeable)
  writeRegister(DS_SEC, 0x80);          // CH = 1 : arrêt pendant le réglage
  writeRegister(DS_YEAR, bin2bcd((uint8_t)(dt.year - 2000)));
  writeRegister(DS_MONTH, bin2bcd(dt.month));
  writeRegister(DS_DATE, bin2bcd(dt.day));
  writeRegister(DS_DAY, dt.dow);
  writeRegister(DS_HOUR, bin2bcd(dt.hour));      // bit 7 = 0 : mode 24 h
  writeRegister(DS_MIN, bin2bcd(dt.minute));
  writeRegister(DS_SEC, bin2bcd(dt.second));     // CH = 0 : redémarre
  writeRegister(DS_CTRL, 0x80);         // WP = 1 : protège contre les écritures parasites
  DateTime check;
  const bool ok = readNow(check) && check.year == dt.year && check.month == dt.month &&
                  check.day == dt.day && check.hour == dt.hour && check.minute == dt.minute;
  if (ok) { s_now = check; s_status = RTC_OK; s_errors = 0; }
  return ok;
}

RtcStatus RTCManager::status() { return s_status; }
bool RTCManager::isValid() { return s_status == RTC_OK; }
const DateTime &RTCManager::now() { return s_now; }
uint8_t RTCManager::errorCount() { return s_errors; }
