#include "EEPROMManager.h"

// ----- Accès bas niveau : EEPROM réelle (AVR) ou simulée (PC) --------------
#if defined(ARDUINO)
#include <EEPROM.h>
static inline uint8_t eeRead(uint16_t a) { return EEPROM.read(a); }
static inline void eeUpdate(uint16_t a, uint8_t v) { EEPROM.update(a, v); }
#else
static uint8_t  g_mem[EEPROM_SIZE_BYTES];
static uint32_t g_writes = 0;
static int32_t  g_budget = -1;
static inline uint8_t eeRead(uint16_t a) { return g_mem[a % EEPROM_SIZE_BYTES]; }
static inline void eeUpdate(uint16_t a, uint8_t v) {
  if (g_mem[a % EEPROM_SIZE_BYTES] == v) return;    // comportement de update()
  if (g_budget == 0) return;                         // "coupure" : écriture perdue
  if (g_budget > 0) g_budget--;
  g_mem[a % EEPROM_SIZE_BYTES] = v;
  g_writes++;
}
void eepromFakeFill(uint8_t v) { for (auto &b : g_mem) b = v; }
uint32_t eepromFakeWrites() { return g_writes; }
void eepromFakeCorrupt(uint16_t addr) { g_mem[addr % EEPROM_SIZE_BYTES] ^= 0x5A; }
void eepromFakeSetWriteBudget(int32_t b) { g_budget = b; }
#endif

// Adresses de l'en-tête
enum : uint16_t {
  H_MAGIC0 = 0, H_MAGIC1 = 1, H_VERSION = 2, H_GEN = 3, H_COUNT = 4,
  H_LANG = 5, H_BUZZER = 6, H_CRC = 7
};

uint8_t crc8Update(uint8_t crc, uint8_t data) {
  // CRC-8 Dallas/Maxim (polynôme x^8 + x^5 + x^4 + 1, forme réfléchie 0x8C)
  crc ^= data;
  for (uint8_t i = 0; i < 8; i++) crc = (crc & 1) ? (uint8_t)((crc >> 1) ^ 0x8C) : (uint8_t)(crc >> 1);
  return crc;
}

uint8_t EEPROMManager::headerCrc() const {
  uint8_t c = 0;
  for (uint16_t a = 0; a < H_CRC; a++) c = crc8Update(c, eeRead(a));
  return c;
}

uint8_t EEPROMManager::recordCrc(uint8_t index, const uint8_t *b) const {
  uint8_t c = crc8Update(generation_, index);
  for (uint8_t i = 0; i < 7; i++) c = crc8Update(c, b[i]);
  return c;
}

bool EEPROMManager::plausible(const Record &r) {
  return r.bpm >= 20 && r.bpm <= 250 && r.day >= 1 && r.day <= 31 &&
         r.month >= 1 && r.month <= 12 && r.year <= 99 &&
         r.hour <= 23 && r.minute <= 59 && r.second <= 59;
}

bool EEPROMManager::readRaw(uint8_t index, Record &r) const {
  if (index >= EEPROM_CAPACITY) return false;
  const uint16_t base = EEPROM_HEADER_SIZE + (uint16_t)index * EEPROM_RECORD_SIZE;
  uint8_t b[EEPROM_RECORD_SIZE];
  for (uint8_t i = 0; i < EEPROM_RECORD_SIZE; i++) b[i] = eeRead(base + i);
  if (recordCrc(index, b) != b[7]) return false;
  r.bpm = b[0]; r.day = b[1]; r.month = b[2]; r.year = b[3];
  r.hour = b[4]; r.minute = b[5]; r.second = b[6];
  return plausible(r);
}

void EEPROMManager::writeHeader() {
  // Signature/version d'abord, compteur ensuite, CRC en DERNIER : le CRC ne
  // devient juste que lorsque tout le reste est écrit.
  eeUpdate(H_MAGIC0, EEPROM_MAGIC0);
  eeUpdate(H_MAGIC1, EEPROM_MAGIC1);
  eeUpdate(H_VERSION, EEPROM_FORMAT_VERSION);
  eeUpdate(H_GEN, generation_);
  eeUpdate(H_COUNT, count_);
  eeUpdate(H_LANG, language_);
  eeUpdate(H_BUZZER, buzzer_ ? 1 : 0);
  eeUpdate(H_CRC, headerCrc());
}

void EEPROMManager::begin() {
  formatted_ = false;
  recovered_ = false;
  const bool magicOk = eeRead(H_MAGIC0) == EEPROM_MAGIC0 &&
                       eeRead(H_MAGIC1) == EEPROM_MAGIC1 &&
                       eeRead(H_VERSION) == EEPROM_FORMAT_VERSION;
  if (!magicOk) {
    // Puce vierge (0xFF) ou autre programme / autre format : on initialise
    // UNE fois. Nouvelle génération pour invalider tout contenu antérieur.
    generation_ = (uint8_t)(eeRead(H_GEN) + 1);
    count_ = 0;
    language_ = 0;
    buzzer_ = true;
    writeHeader();
    formatted_ = true;
    return;
  }

  generation_ = eeRead(H_GEN);
  language_ = eeRead(H_LANG);
  buzzer_ = eeRead(H_BUZZER) != 0;
  count_ = eeRead(H_COUNT);
  if (language_ > 1) language_ = 0;

  if (headerCrc() != eeRead(H_CRC) || count_ > EEPROM_CAPACITY) {
    // En-tête incohérent : une coupure est survenue pendant une écriture.
    // On reconstruit le compteur en comptant les enregistrements valides
    // consécutifs de la génération courante.
    uint8_t n = 0;
    Record r;
    while (n < EEPROM_CAPACITY && readRaw(n, r)) n++;
    count_ = n;
    writeHeader();
    recovered_ = true;
  }
}

EEResult EEPROMManager::append(const Record &r) {
  if (!plausible(r)) return EE_INVALID;
  if (count_ >= EEPROM_CAPACITY) return EE_FULL;   // jamais d'écrasement silencieux
  const uint8_t idx = count_;
  uint8_t b[EEPROM_RECORD_SIZE] = { r.bpm, r.day, r.month, r.year, r.hour, r.minute, r.second, 0 };
  b[7] = recordCrc(idx, b);
  const uint16_t base = EEPROM_HEADER_SIZE + (uint16_t)idx * EEPROM_RECORD_SIZE;
  for (uint8_t i = 0; i < EEPROM_RECORD_SIZE; i++) eeUpdate(base + i, b[i]);
  count_ = (uint8_t)(idx + 1);
  eeUpdate(H_COUNT, count_);
  eeUpdate(H_CRC, headerCrc());
  return EE_OK;
}

bool EEPROMManager::read(uint8_t index, Record &r) const {
  if (index >= count_) return false;
  return readRaw(index, r);
}

EEResult EEPROMManager::eraseAll() {
  // Effacement LOGIQUE : 3 octets écrits au lieu de 1008. La nouvelle
  // génération rend les anciens CRC faux -> les anciennes données sont
  // définitivement ignorées, même si la coupure survient ici.
  generation_ = (uint8_t)(generation_ + 1);
  eeUpdate(H_GEN, generation_);
  count_ = 0;
  eeUpdate(H_COUNT, 0);
  eeUpdate(H_CRC, headerCrc());
  return EE_OK;
}

void EEPROMManager::setLanguage(uint8_t lang) {
  if (lang > 1 || lang == language_) return;     // aucune écriture inutile
  language_ = lang;
  eeUpdate(H_LANG, language_);
  eeUpdate(H_CRC, headerCrc());
}

void EEPROMManager::setBuzzerEnabled(bool on) {
  if (on == buzzer_) return;
  buzzer_ = on;
  eeUpdate(H_BUZZER, on ? 1 : 0);
  eeUpdate(H_CRC, headerCrc());
}
