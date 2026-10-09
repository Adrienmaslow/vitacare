/*
 * RTCManager — horloge temps réel DS1302 (module "MH-Real-Time Clock") (FS2)
 * ---------------------------------------------------------------------------
 * Pilote écrit à la main (pas de bibliothèque) pour pouvoir expliquer le
 * protocole série 3 fils :
 *   CE (RST)  : à 1 pendant toute la transaction (sélection du circuit) ;
 *   SCLK      : horloge générée par l'Arduino ;
 *   I/O       : UNE seule ligne de données BIDIRECTIONNELLE, LSB en premier.
 * Différence avec SPI : SPI a deux lignes de données séparées (MOSI/MISO),
 * transmet MSB en premier et fonctionne en full-duplex ; le DS1302 est
 * half-duplex sur un seul fil, LSB en premier, et le bit de poids faible
 * de l'octet de commande choisit lecture (1) ou écriture (0). Le module SPI
 * matériel de l'ATmega328P ne peut donc pas être utilisé tel quel.
 *
 * L'heure n'est JAMAIS réécrite au démarrage : seule la commande série
 * "SET AAAA-MM-JJ HH:MM:SS" (procédure de réglage explicite) l'écrit. La pile
 * CR2032 du module maintient l'oscillateur pendant les coupures.
 */
#ifndef RTC_MANAGER_H
#define RTC_MANAGER_H

#include <stdint.h>

struct DateTime {
  uint16_t year;     // 2000..2099
  uint8_t  month;    // 1..12
  uint8_t  day;      // 1..31
  uint8_t  hour;     // 0..23
  uint8_t  minute;   // 0..59
  uint8_t  second;   // 0..59
  uint8_t  dow;      // 1..7 (1 = lundi)
};

enum RtcStatus : uint8_t {
  RTC_OK = 0,
  RTC_HALTED,        // bit CH à 1 : oscillateur arrêté -> heure jamais réglée / pile HS
  RTC_INVALID,       // valeurs incohérentes (module absent, câblage, parasites)
};

namespace RTCManager {
  void      begin();
  void      update(uint32_t nowMs);          // lecture périodique non bloquante
  RtcStatus status();
  bool      isValid();                       // status() == RTC_OK
  const DateTime &now();                     // dernière lecture valide
  bool      setDateTime(const DateTime &dt); // procédure de réglage
  bool      readNow(DateTime &dt);           // lecture immédiate (série)
  bool      isDateValid(const DateTime &dt);
  uint8_t   dayOfWeek(uint16_t y, uint8_t m, uint8_t d);
  uint8_t   errorCount();
}

#endif
