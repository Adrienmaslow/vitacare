/*
 * PPGSensor — acquisition à cadence FIXE du WPSE340 (FS1)
 * ---------------------------------------------------------------------------
 * Le Timer1 (16 bits) génère une interruption toutes les 10 ms exactement
 * (quartz 16 MHz), INDÉPENDAMMENT de la durée de loop() : un rafraîchissement
 * OLED ou une écriture EEPROM ne décale jamais l'échantillonnage.
 *
 * Dans l'interruption (≈ 5 µs) :
 *   1. lecture du résultat de la conversion lancée au tick précédent ;
 *   2. lancement immédiat de la conversion suivante (104 µs, en matériel) ;
 *   3. rangement dans une FIFO circulaire lue par loop().
 * -> instants d'échantillonnage sans gigue, et aucune attente active de
 *    l'ADC (contrairement à analogRead() qui bloque ~112 µs).
 *
 * Timers : Timer0 = millis(), Timer1 = cet échantillonnage,
 *          Timer2 = tone() (buzzer). Aucun conflit.
 */
#ifndef PPG_SENSOR_H
#define PPG_SENSOR_H

#include <stdint.h>

namespace PPGSensor {
  void begin();
  // Retire le plus ancien échantillon de la FIFO. index = numéro
  // d'échantillon (base de temps : t = index x 10 ms). false si FIFO vide.
  bool pop(uint16_t &raw, uint32_t &index);
  uint16_t overruns();     // échantillons perdus (FIFO pleine) — doit rester 0
  uint8_t  fifoLevel();
  uint8_t  maxLevel();     // remplissage maximal observé depuis le démarrage
}

#endif
