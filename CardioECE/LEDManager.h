/*
 * LEDManager — indicateurs de fréquence cardiaque (FS3)
 *   jaune = faible, vert = normal, rouge = élevé, rien = mesure invalide.
 * Garanties : une seule LED allumée à la fois ; les broches ne sont écrites
 * que lors d'un CHANGEMENT d'état (aucun scintillement lié à loop() ou aux
 * rafraîchissements d'écran).
 */
#ifndef LED_MANAGER_H
#define LED_MANAGER_H

#include "HeartRate.h"

namespace LEDManager {
  void    begin();
  void    updateHeartRateIndicators(HrClass c);
  HrClass current();
  void    selfTest(uint8_t step);   // 0 = éteint, 1 = jaune, 2 = vert, 3 = rouge
}

#endif
