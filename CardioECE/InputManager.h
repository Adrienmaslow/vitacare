/*
 * InputManager — boutons poussoirs et encodeur rotatif
 * ---------------------------------------------------------------------------
 * Boutons : câblés entre la broche et GND, résistance de tirage interne
 * (INPUT_PULLUP) -> appui = niveau BAS. Anti-rebond NON bloquant : un
 * changement n'est validé que s'il est stable pendant DEBOUNCE_MS.
 * Événements : PRESS (dès l'appui validé : réaction immédiate), SHORT
 * (relâché avant LONG_PRESS_MS) et LONG (maintenu LONG_PRESS_MS).
 *
 * Encodeur : décodage en quadrature par interruption de changement d'état
 * (PCINT) sur A et B -> aucun cran perdu même pendant un rafraîchissement
 * OLED. Table de transitions : les rebonds produisent des transitions
 * invalides (ignorées) ou des allers-retours qui s'annulent.
 */
#ifndef INPUT_MANAGER_H
#define INPUT_MANAGER_H

#include <stdint.h>

enum ButtonId : uint8_t { BTN_RECORD = 0, BTN_BUZZER, BTN_ENCODER, BTN_COUNT };

enum : uint8_t {
  BTN_EV_PRESS = 0x01,
  BTN_EV_SHORT = 0x02,
  BTN_EV_LONG  = 0x04
};

namespace InputManager {
  void    begin();
  void    update(uint32_t nowMs);
  uint8_t events(ButtonId b);       // lit ET efface les événements du bouton
  int8_t  encoderDelta();           // crans depuis le dernier appel (+ = horaire)
  bool    isDown(ButtonId b);
}

#endif
