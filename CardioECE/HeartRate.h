/*
 * HeartRate — validation des intervalles et calcul du BPM (FS1)
 * ---------------------------------------------------------------------------
 * Reçoit les battements horodatés par PPGProcessor et produit :
 *   - les intervalles inter-battements (IBI) VALIDÉS ;
 *   - BPM = 60000 x n / somme(n derniers IBI)   (n = BPM_AVG_COUNT)
 *   - un état de validité qui retombe automatiquement en cas de perte du
 *     signal (jamais de "vieux BPM" affiché indéfiniment).
 *
 * Règles de rejet (voir ALGORITHME_PPG.md §10) :
 *   1. plausibilité physiologique : IBI_MIN_MS <= IBI <= IBI_MAX_MS ;
 *   2. cohérence : |IBI - référence| <= IBI_TOLERANCE_PCT % où la référence
 *      est la médiane de l'historique (robuste à une valeur aberrante) ;
 *   3. MAX_CONSEC_REJECTS rejets d'affilée = le rythme a réellement changé :
 *      l'historique est réinitialisé sur le nouveau rythme.
 *
 * C++ pur, testable sur PC.
 */
#ifndef HEART_RATE_H
#define HEART_RATE_H

#include <stdint.h>
#include "config.h"

enum HrClass : uint8_t {
  HR_NONE = 0,   // mesure invalide : aucune LED, aucun bip
  HR_LOW,        // < BPM_LOW_BELOW
  HR_NORMAL,
  HR_HIGH        // > BPM_HIGH_ABOVE
};

// Événements renvoyés par HeartRate::update() (champ de bits)
enum : uint8_t {
  HR_EV_BEAT_ACCEPTED = 0x01, // intervalle validé -> bip, mesure d'enregistrement
  HR_EV_BEAT_REJECTED = 0x02,
  HR_EV_BECAME_VALID  = 0x04,
  HR_EV_BECAME_INVALID = 0x08
};

// Classification indicative (paramètres de config.h, PAS un diagnostic).
HrClass classifyBpm(uint16_t bpm);

class HeartRate {
public:
  HeartRate() { reset(); }
  void reset();

  // Appelée à CHAQUE échantillon (gère les délais de perte de signal).
  // beat/beatTimeMs : sortie de PPGProcessor pour cet échantillon.
  uint8_t update(uint32_t nowMs, bool signalOk, bool beat, uint32_t beatTimeMs);

  bool     isValid() const { return valid_; }
  uint16_t bpm() const { return valid_ ? (uint16_t)((bpmX10_ + 5) / 10) : 0; }
  uint16_t bpmX10() const { return valid_ ? bpmX10_ : 0; }
  HrClass  hrClass() const { return valid_ ? classifyBpm(bpm()) : HR_NONE; }

  // Dernier intervalle accepté (ms) et BPM instantané correspondant (x10).
  uint16_t lastIbiMs() const { return lastIbi_; }
  uint16_t lastInstantBpmX10() const;

  // Période réfractaire conseillée au détecteur : max(min, médiane/2).
  uint16_t refractoryMs() const;

  uint8_t  historyCount() const { return count_; }
  uint32_t acceptedBeats() const { return accepted_; }
  uint32_t rejectedBeats() const { return rejected_; }

private:
  uint16_t medianIbi() const;
  void     clearHistory();
  void     pushIbi(uint16_t ibi);
  void     recompute();
  void     invalidate(uint8_t &ev);

  uint16_t ibi_[IBI_HISTORY];   // buffer circulaire des IBI acceptés
  uint8_t  head_;               // prochain emplacement d'écriture
  uint8_t  count_;
  uint16_t lastIbi_;
  uint16_t bpmX10_;
  bool     valid_;

  bool     haveLastBeat_;
  uint32_t lastBeatMs_;         // dernier battement détecté (accepté ou non)
  bool     haveAccepted_;
  uint32_t lastAcceptedMs_;     // dernier battement accepté (timeout)
  uint8_t  consecRejects_;

  bool     badSignal_;
  uint32_t badSinceMs_;

  uint32_t accepted_;
  uint32_t rejected_;
};

#endif
