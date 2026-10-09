/*
 * MenuManager — navigation et contenu de l'écran texte (FS5 / FS6)
 * ---------------------------------------------------------------------------
 * Machine à états :
 *
 *   ACCUEIL ──clic──► MENU PRINCIPAL ──► Mesure          (retour accueil)
 *     ▲  rotation =        │            Historique      ──► HISTORIQUE
 *     │  base de temps     │            Effacer donnees ──► CONFIRMATION
 *     │                    │            Langue          (FR <-> EN)
 *     │                    │            Buzzer          (ON <-> OFF)
 *     └──── Retour / appui long / 30 s d'inactivité ◄───┘
 *
 * Encodeur : rotation = déplacement, clic = valider, appui long = accueil.
 * Le contenu affiché est produit à la demande par composeLine() : aucun
 * tampon d'écran en RAM (voir DisplayManager).
 */
#ifndef MENU_MANAGER_H
#define MENU_MANAGER_H

#include <stdint.h>
#include "Strings.h"

enum UiMode : uint8_t { UI_HOME = 0, UI_MENU, UI_HISTORY, UI_ERASE_CONFIRM };

namespace MenuManager {
  void    begin(uint8_t lang);
  void    handleInput(uint32_t nowMs, int8_t encDelta, uint8_t encEvents);
  void    showMessage(uint32_t nowMs, StrId id, int16_t number = -1);
  uint8_t composeLine(uint8_t row, char *buf);   // TextLineProvider
  void    tick(uint32_t nowMs);                  // délais (message, inactivité)
  uint8_t language();
  void    setLanguage(uint8_t lang);
  UiMode  mode();
}

#endif
