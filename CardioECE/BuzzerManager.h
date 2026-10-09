/*
 * BuzzerManager — retransmission sonore du rythme cardiaque (FS4)
 * ---------------------------------------------------------------------------
 * Un bip par battement VALIDÉ, de hauteur liée à la classe :
 *   grave (440 Hz) = faible, moyen (880 Hz) = normal, aigu (1760 Hz) = élevé.
 * Le bip est NON bloquant : le Timer2 génère le signal carré par
 * interruption et coupe le son tout seul après la durée (même principe que
 * tone()/noTone(), en version dédiée plus compacte : voir BuzzerManager.cpp).
 * Aucun delay() -> l'acquisition PPG n'est jamais retardée par un bip.
 * Conflits vérifiés : Timer0 = millis(), Timer1 = échantillonnage PPG,
 * Timer2 = buzzer. Le PWM de D3/D11 est perdu — D11 (LED jaune) n'est
 * utilisée qu'en tout-ou-rien : compatible.
 */
#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <stdint.h>
#include "HeartRate.h"

namespace BuzzerManager {
  void begin(bool enabled);
  void setEnabled(bool on);
  bool isEnabled();
  bool toggle();                       // renvoie le nouvel état
  void beatBeep(HrClass c);            // bip de battement (ignoré si HR_NONE)
  void uiBeep();                       // bip court de confirmation
  void update(uint32_t nowMs);         // fin de bip (buzzer actif uniquement)
  uint16_t frequencyFor(HrClass c);
}

#endif
