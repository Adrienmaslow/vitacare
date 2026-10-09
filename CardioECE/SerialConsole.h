/*
 * SerialConsole — commandes texte sur le port série (115200 bauds)
 * ---------------------------------------------------------------------------
 *   HELP                     liste des commandes
 *   STATUS                   état complet (BPM, qualité, RAM libre, FIFO...)
 *   GET                      lecture de l'heure RTC
 *   SET AAAA-MM-JJ HH:MM:SS  RÉGLAGE de l'heure (procédure explicite FS2)
 *   PLOT 0|1|2|3             flux temps réel : 0 arrêt, 1 Serial Plotter,
 *                            2 Teleplot, 3 CSV (validation Excel/Python)
 *   DUMP                     export CSV de l'historique EEPROM
 *   ERASE YES                effacement de l'historique (comme le menu)
 *   LANG FR|EN, BUZ ON|OFF   réglages
 *   TEST                     auto-test non bloquant LED + buzzer
 *   SIM ...                  (SIMULATION_MODE uniquement) BPM 72.5,
 *                            NOISE n, DRIFT a p, SPIKES ms h, FINGER 0|1,
 *                            CONNECT 0|1, AMP n
 * Lecture caractère par caractère, sans blocage ni classe String.
 */
#ifndef SERIAL_CONSOLE_H
#define SERIAL_CONSOLE_H

#include <stdint.h>
#include "PPGProcessor.h"

namespace SerialConsole {
  void paintStack();      // à appeler en tout début de setup()
  void begin();
  void update();
  // Sortie temps réel d'un échantillon selon g_plotMode (non bloquante :
  // une ligne est abandonnée plutôt que d'attendre si le tampon est plein).
  void plotSample(const PPGSample &s, bool beatAccepted);
  uint32_t droppedLines();
}

#endif
