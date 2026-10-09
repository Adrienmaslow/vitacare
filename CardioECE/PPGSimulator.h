/*
 * PPGSimulator — générateur de signal PPG SYNTHÉTIQUE (SIMULATION_MODE)
 * ---------------------------------------------------------------------------
 * Produit des valeurs "ADC" 0..1023 à fs = 100 Hz, injectées à la place de
 * la lecture analogique. Le traitement en aval est identique au mode réel.
 *
 * Forme d'onde : une période cardiaque tabulée (64 points en Flash :
 * front systolique, pic, encoche dicrote, onde diastolique), lue avec un
 * accumulateur de phase 32 bits -> fréquence réglable au 1/10 de BPM.
 * Options : bruit blanc, dérive lente de la ligne de base, pics parasites,
 * absence de doigt, absence totale de signal.
 *
 * IMPORTANT : tout résultat obtenu avec ce générateur est une SIMULATION et
 * ne doit jamais être présenté comme une mesure du capteur WPSE340.
 * C++ pur, utilisé aussi par les tests PC.
 */
#ifndef PPG_SIMULATOR_H
#define PPG_SIMULATOR_H

#include <stdint.h>

class PPGSimulator {
public:
  PPGSimulator() { reset(); }
  void reset();

  void setBpmX10(uint16_t bpmX10);           // ex. 725 = 72,5 BPM
  uint16_t bpmX10() const { return bpmX10_; }
  void setAmplitude(uint16_t adcPeakToPeak) { amplitude_ = adcPeakToPeak; }
  void setBaseline(uint16_t adc) { baseline_ = adc; }
  void setNoise(uint16_t adcPeak) { noise_ = adcPeak; }   // bruit uniforme ±
  // Dérive sinusoïdale lente (luminosité, pression) : amplitude ± et période.
  void setDrift(uint16_t adcPeak, uint16_t periodS) { driftAmp_ = adcPeak; driftPeriodS_ = periodS; }
  // Pic parasite isolé toutes les 'periodMs' (0 = désactivé).
  void setSpikes(uint16_t periodMs, uint16_t adcHeight) { spikePeriodMs_ = periodMs; spikeHeight_ = adcHeight; }
  void setFinger(bool present) { finger_ = present; }
  void setSignalPresent(bool present) { connected_ = present; }
  bool finger() const { return finger_; }

  uint16_t next();   // échantillon suivant (pas de 10 ms)

private:
  int16_t  randomNoise();
  uint32_t phase_;       // 2^32 = une période cardiaque
  uint32_t phaseInc_;
  uint16_t bpmX10_;
  uint16_t amplitude_;
  uint16_t baseline_;
  uint16_t noise_;
  uint16_t driftAmp_;
  uint16_t driftPeriodS_;
  uint32_t driftPhase_;  // en échantillons
  uint16_t spikePeriodMs_;
  uint16_t spikeHeight_;
  uint32_t spikeCounterMs_;
  uint32_t lfsr_;
  bool     finger_;
  bool     connected_;
};

#endif
