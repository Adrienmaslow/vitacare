#include "PPGSimulator.h"
#include "config.h"
#include "pgmcompat.h"

// Une période de pouls PPG normalisée 0..255 (64 points, en Flash) :
// front systolique raide, pic, encoche dicrote (~indice 20), onde dicrote
// (~indice 29), puis retour à la ligne de base en diastole.
static const uint8_t PPG_WAVE[64] PROGMEM = {
  0, 1, 3, 7, 15, 31, 57, 93, 139, 188, 230, 254, 255, 231, 190, 141,
  95, 58, 33, 18, 12, 13, 18, 28, 41, 57, 73, 87, 96, 98, 93, 81,
  66, 50, 35, 23, 14, 8, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
};

void PPGSimulator::reset() {
  phase_ = 0;
  amplitude_ = 120;   // ordre de grandeur d'un module type PulseSensor
  baseline_ = 512;
  noise_ = 0;
  driftAmp_ = 0;
  driftPeriodS_ = 20;
  driftPhase_ = 0;
  spikePeriodMs_ = 0;
  spikeHeight_ = 0;
  spikeCounterMs_ = 0;
  lfsr_ = 0x2545F491UL;
  finger_ = true;
  connected_ = true;
  setBpmX10(750);
}

void PPGSimulator::setBpmX10(uint16_t bpmX10) {
  bpmX10_ = bpmX10;
  // Incrément de phase par échantillon = (BPM/60) / fs x 2^32
  //   = bpmX10 x 2^32 / (600 x fs) = bpmX10 x 71582,79 (fs = 100 Hz).
  // Arrondi à 71583 : erreur relative 3e-6, et aucun calcul 64 bits
  // (la division 64 bits coûterait ~1 Ko de Flash sur AVR).
  phaseInc_ = (uint32_t)bpmX10 * (uint32_t)((4294967296.0 / (600.0 * SAMPLE_RATE_HZ)) + 0.5);
}

int16_t PPGSimulator::randomNoise() {
  // xorshift 32 bits (Marsaglia) : bruit blanc pseudo-aléatoire
  // reproductible, sans rand() ni flottant.
  lfsr_ ^= lfsr_ << 13;
  lfsr_ ^= lfsr_ >> 17;
  lfsr_ ^= lfsr_ << 5;
  if (noise_ == 0) return 0;
  return (int16_t)((int32_t)((lfsr_ >> 8) % (2u * noise_ + 1u)) - noise_);
}

uint16_t PPGSimulator::next() {
  const int16_t n = randomNoise();
  if (!connected_) return 0;                  // fil débranché : ADC à 0

  int32_t v = baseline_;

  // Dérive lente triangulaire (évite sin() flottant sur AVR).
  if (driftAmp_ > 0 && driftPeriodS_ > 0) {
    const uint32_t period = (uint32_t)driftPeriodS_ * SAMPLE_RATE_HZ;
    driftPhase_ = (driftPhase_ + 1) % period;
    const int32_t half = (int32_t)(period / 2);
    int32_t p = (int32_t)driftPhase_;
    int32_t tri = (p < half) ? p : (int32_t)period - p;     // 0..half..0
    v += (int32_t)driftAmp_ * (2 * tri - half) / half;      // -A..+A
  }

  if (finger_) {
    // Lecture du tableau avec interpolation linéaire (6 bits d'indice,
    // 10 bits de fraction pris dans la phase).
    const uint8_t idx = (uint8_t)(phase_ >> 26);
    const uint16_t frac = (uint16_t)((phase_ >> 16) & 0x3FF);
    const int16_t a = pgm_read_byte(&PPG_WAVE[idx]);
    const int16_t b = pgm_read_byte(&PPG_WAVE[(idx + 1) & 63]);
    const int32_t w = a + (((int32_t)(b - a) * frac) >> 10);   // 0..255
    v += ((int32_t)w * amplitude_) / 255 - amplitude_ / 2;
    phase_ += phaseInc_;

    if (spikePeriodMs_ > 0) {
      spikeCounterMs_ += SAMPLE_PERIOD_MS;
      if (spikeCounterMs_ >= spikePeriodMs_) spikeCounterMs_ = 0;
      if (spikeCounterMs_ < 2 * SAMPLE_PERIOD_MS) v += spikeHeight_;  // 20 ms
    }
  } else {
    v += 40;   // sans doigt : niveau lumineux différent, aucune pulsation
  }
  v += n;
  if (v < 0) v = 0;
  if (v > 1023) v = 1023;
  return (uint16_t)v;
}
