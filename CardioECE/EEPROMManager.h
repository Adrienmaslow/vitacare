/*
 * EEPROMManager — historique BPM persistant dans l'EEPROM interne (FS6)
 * ---------------------------------------------------------------------------
 * Organisation des 1024 octets (détails : SOUTENANCE_TECHNIQUE.md §11)
 *
 *   Adr.  Taille  Contenu
 *   0x000  2      signature 'C','E'
 *   0x002  1      version du format (EEPROM_FORMAT_VERSION)
 *   0x003  1      génération (incrémentée à chaque effacement)
 *   0x004  1      nombre d'enregistrements valides
 *   0x005  1      langue (0 = FR, 1 = EN)
 *   0x006  1      buzzer activé (0/1)
 *   0x007  1      CRC-8 des octets 0x000..0x006
 *   0x008  8      réservé
 *   0x010  8 x 126 enregistrements :
 *                 BPM, jour, mois, année-2000, heure, minute, seconde, CRC-8
 *                 (CRC initialisé avec la génération et l'indice : un
 *                 enregistrement d'avant un effacement ne peut pas "revenir")
 *
 * Écritures : uniquement EEPROM.update() (n'écrit que les octets modifiés,
 * économise l'endurance de 100 000 cycles). Jamais d'effacement au démarrage.
 * Ordre d'écriture d'un ajout : enregistrement complet PUIS compteur PUIS CRC
 * -> une coupure à n'importe quel instant laisse un état cohérent ou
 * récupérable (voir begin()).
 */
#ifndef EEPROM_MANAGER_H
#define EEPROM_MANAGER_H

#include <stdint.h>
#include "config.h"

struct Record {
  uint8_t bpm;
  uint8_t day, month, year;      // year = année - 2000
  uint8_t hour, minute, second;
};

enum EEResult : uint8_t { EE_OK = 0, EE_FULL, EE_INVALID };

uint8_t crc8Update(uint8_t crc, uint8_t data);   // CRC-8 Dallas/Maxim

class EEPROMManager {
public:
  void begin();

  uint8_t  count() const { return count_; }
  uint8_t  capacity() const { return EEPROM_CAPACITY; }
  bool     isFull() const { return count_ >= EEPROM_CAPACITY; }
  EEResult append(const Record &r);
  bool     read(uint8_t index, Record &r) const;   // false si CRC invalide
  EEResult eraseAll();

  uint8_t  language() const { return language_; }
  void     setLanguage(uint8_t lang);
  bool     buzzerEnabled() const { return buzzer_; }
  void     setBuzzerEnabled(bool on);

  bool     wasFormatted() const { return formatted_; }  // signature absente
  bool     wasRecovered() const { return recovered_; }  // en-tête réparé

  static bool plausible(const Record &r);

private:
  void     writeHeader();
  uint8_t  headerCrc() const;
  uint8_t  recordCrc(uint8_t index, const uint8_t *bytes) const;
  bool     readRaw(uint8_t index, Record &r) const;

  uint8_t generation_ = 0;
  uint8_t count_ = 0;
  uint8_t language_ = 0;
  bool    buzzer_ = true;
  bool    formatted_ = false;
  bool    recovered_ = false;
};

#if !defined(ARDUINO)
// EEPROM simulée pour les tests PC (coupure d'alimentation simulable).
void     eepromFakeFill(uint8_t v);
uint32_t eepromFakeWrites();
void     eepromFakeCorrupt(uint16_t addr);
void     eepromFakeSetWriteBudget(int32_t budget);   // -1 = illimité
#endif

#endif
