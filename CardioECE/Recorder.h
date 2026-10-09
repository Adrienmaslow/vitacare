/*
 * Recorder — création d'un enregistrement BPM moyen horodaté (FS6)
 * ---------------------------------------------------------------------------
 * Définition d'une "mesure" : le BPM INSTANTANÉ 60000 / IBI d'un battement
 * ACCEPTÉ par HeartRate (intervalle plausible et cohérent). Une mesure est
 * donc produite à chaque battement (≈ 1 par seconde à 60 BPM) et deux
 * mesures ne partagent aucun intervalle (pas de recouvrement).
 *
 * Enregistrement = moyenne arithmétique de RECORD_SAMPLES (10) mesures
 * CONSÉCUTIVES :
 *   - un battement rejeté (aberrant) remet la série à zéro ;
 *   - si la mesure devient invalide (doigt retiré, signal perdu) :
 *     ANNULATION, rien n'est écrit ;
 *   - si 10 mesures ne sont pas réunies en RECORD_TIMEOUT_MS : ABANDON.
 * Horodatage : heure RTC au moment de l'appui sur le bouton.
 * Tout est non bloquant : la collecte avance au rythme des battements.
 */
#ifndef RECORDER_H
#define RECORDER_H

#include <stdint.h>

enum RecResult : uint8_t {
  REC_NONE = 0,
  REC_STARTED,
  REC_SAVED,
  REC_CANCELLED,        // annulé (signal perdu ou nouvel appui)
  REC_TIMEOUT,
  REC_REFUSED_INVALID,  // pas de BPM valide au moment de l'appui
  REC_REFUSED_RTC,      // heure non valide
  REC_REFUSED_FULL,     // EEPROM pleine
  REC_ERROR             // écriture EEPROM refusée
};

namespace Recorder {
  RecResult toggle(uint32_t nowMs);                  // bouton "enregistrer"
  RecResult onHeartEvents(uint8_t hrEvents, uint16_t instBpmX10);
  RecResult update(uint32_t nowMs);                  // validité + délai
  bool      active();
  uint8_t   progress();                              // mesures collectées
  uint8_t   lastBpm();                               // dernier BPM enregistré
}

#endif
