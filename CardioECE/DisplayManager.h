/*
 * DisplayManager — deux écrans OLED 128x64 sur le même bus I2C (FS5)
 * ---------------------------------------------------------------------------
 * PROBLÈME DE RAM : un SSD1306 128x64 en mode "full buffer" demande
 * 128 x 64 / 8 = 1024 octets. Deux écrans = 2048 octets = TOUTE la SRAM de
 * l'ATmega328P. Solution retenue (bibliothèque U8g2 utilisée via son API C,
 * sans aucune allocation dynamique) :
 *
 *   Écran 1 (texte, 0x3C) : u8x8 = mode "caractères" SANS tampon (0 octet).
 *     Le texte est écrit directement dans la mémoire de l'écran, ligne par
 *     ligne, et SEULES les lignes modifiées sont renvoyées (empreinte FNV de
 *     chaque ligne) -> aucun effacement global, donc aucun clignotement.
 *   Écran 2 (courbe, 0x3D) : u8g2 en mode PAGE (variante _1) : tampon
 *     de 128 octets (une bande de 8 lignes). L'image est envoyée bande par
 *     bande, UNE bande par passage dans loop() (≈ 3 ms), si bien que le
 *     rafraîchissement ne retarde jamais le traitement PPG. Les textes de
 *     cet écran utilisent la même police 8x8 que l'écran 1, copiée
 *     directement dans la bande (pas de moteur de polices : -2,5 Ko Flash).
 *
 * Les deux objets ont chacun leur adresse I2C (setI2CAddress) et partagent
 * le contrôleur TWI ; chaque transfert est une transaction I2C complète,
 * donc les écrans ne s'effacent pas mutuellement.
 *
 * Courbe : 100 colonnes ; chaque colonne résume T x fs / 100 échantillons
 * (min et max) -> la base de temps affichée est EXACTE (2, 5, 10, 20 s).
 */
#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <stdint.h>
#include "PPGProcessor.h"

// Drapeaux renvoyés par le fournisseur de lignes de texte
enum : uint8_t {
  LINE_NORMAL  = 0x00,
  LINE_INVERSE = 0x01,   // texte blanc sur fond noir inversé (titre)
  LINE_BIG     = 0x02,   // caractères 2x2 (8 caractères, occupe 2 lignes)
};

// Fournit le contenu de la ligne 'row' (0..7) : 16 caractères max.
typedef uint8_t (*TextLineProvider)(uint8_t row, char *buf);

struct GraphInfo {
  uint16_t bpm;          // 0 = invalide
  bool     signalOk;
  bool     simulation;
  uint8_t  lang;
};

namespace DisplayManager {
  void    begin(TextLineProvider provider);
  bool    textPresent();
  bool    graphPresent();

  void    pushSample(const PPGSample &s);   // 1 appel par échantillon (100 Hz)
  void    notifyBeat(uint32_t nowMs);       // cœur clignotant sur la courbe
  void    setScale(uint8_t idx);            // 0..GRAPH_SCALE_COUNT-1
  uint8_t scale();
  uint8_t scaleSeconds();
  void    changeScale(int8_t delta);

  void    invalidateText();                 // force le redessin complet
  // Une étape de rafraîchissement bornée (≤ 2 lignes texte ou 1 bande).
  void    update(uint32_t nowMs, const GraphInfo &info);
}

#endif
