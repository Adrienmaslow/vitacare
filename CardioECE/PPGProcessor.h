/*
 * PPGProcessor — traitement numérique du signal PPG (FS1)
 * ---------------------------------------------------------------------------
 * Chaîne appliquée à CHAQUE échantillon (fs = 100 Hz) :
 *
 *   brut ──► médian 5 ──► suppression composante continue ──► passe-bas ──►
 *          (impulsions)   (moyenne glissante 1,28 s)          (MA 4 éch.)
 *   ──► enveloppes (amplitude)
 *                                                      │
 *                                                      ▼
 *                          seuil adaptatif + hystérésis + période réfractaire
 *                                                      │
 *                                                      ▼
 *                         battement horodaté (interpolation sub-échantillon)
 *
 * Code C++ pur (aucune dépendance Arduino) : le MÊME fichier est compilé
 * pour l'ATmega328P et pour les tests sur PC (tests/test_algorithms.cpp).
 * Tout est en arithmétique entière : pas de dérive d'arrondi flottant lors
 * d'acquisitions longues, et calcul rapide sur AVR (pas de FPU).
 */
#ifndef PPG_PROCESSOR_H
#define PPG_PROCESSOR_H

#include <stdint.h>
#include "config.h"

// Résultat du traitement d'un échantillon. Les grandeurs signal sont en
// 1/8 de pas ADC (SIGNAL_SHIFT = 3) pour garder de la résolution après
// soustraction de la moyenne.
struct PPGSample {
  uint32_t tMs;        // instant d'échantillonnage (ms, base de temps ISR)
  uint16_t raw;        // valeur ADC brute 0..1023
  int16_t  centred;    // brut - moyenne glissante
  int16_t  filtered;   // après passe-bas : signal utilisé pour la détection
  int16_t  envMax;     // enveloppe haute
  int16_t  envMin;     // enveloppe basse
  int16_t  thrHigh;    // seuil de déclenchement
  int16_t  thrLow;     // seuil de réarmement
  uint16_t amplitudeAdc; // amplitude crête-à-crête estimée (pas ADC)
  bool     signalOk;   // amplitude plausible et ADC non saturé
  bool     beat;       // un battement vient d'être détecté
  uint32_t beatTimeMs; // instant (interpolé) du battement si beat == true
};

class PPGProcessor {
public:
  PPGProcessor() { reset(); }

  // Remise à zéro complète (démarrage, changement de source).
  void reset();

  // Période réfractaire imposée par HeartRate (fonction du rythme courant).
  void setRefractoryMs(uint16_t ms) { refractoryMs_ = ms; }
  uint16_t refractoryMs() const { return refractoryMs_; }

  // Traite un échantillon brut pris à l'instant tMs. Remplit 'out'.
  void process(uint16_t raw, uint32_t tMs, PPGSample &out);

private:
  // --- Filtre médian 5 points (anti-impulsions) ---
  uint16_t medBuf_[5];
  uint8_t  medIdx_;

  // --- Suppression de la composante continue (buffer circulaire) ---
  // Échantillons 10 bits rangés en 8 + 2 bits : 160 octets au lieu de 256
  // (la SRAM de l'ATmega328P ne fait que 2048 octets).
  uint8_t  dcHi_[DC_WINDOW];          // bits 9..2
  uint8_t  dcLo_[DC_WINDOW / 4];      // bits 1..0, 4 échantillons par octet
  uint16_t dcGet(uint16_t i) const {
    return (uint16_t)(((uint16_t)dcHi_[i] << 2) | ((dcLo_[i >> 2] >> ((i & 3) << 1)) & 3));
  }
  void dcSet(uint16_t i, uint16_t v) {
    const uint8_t sh = (uint8_t)((i & 3) << 1);
    dcHi_[i] = (uint8_t)(v >> 2);
    dcLo_[i >> 2] = (uint8_t)((dcLo_[i >> 2] & ~(3u << sh)) | ((v & 3u) << sh));
  }
  uint32_t dcSum_;         // somme glissante exacte (entière)
  uint16_t dcIdx_;
  bool     dcPrimed_;

  // --- Passe-bas ---
  int16_t  lpBuf_[LP_WINDOW];
  int32_t  lpSum_;
  uint8_t  lpIdx_;

  // --- Enveloppes (virgule fixe x256) ---
  int32_t  envMax256_;
  int32_t  envMin256_;

  // --- Détection ---
  bool     armed_;
  bool     havePrev_;
  int16_t  prevFiltered_;
  uint32_t prevT_;
  bool     haveBeat_;
  uint32_t lastBeatMs_;
  uint16_t refractoryMs_;
  uint8_t  saturationHold_;   // échantillons restants marqués "saturé"
};

#endif
