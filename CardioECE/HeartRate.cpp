#include "HeartRate.h"

HrClass classifyBpm(uint16_t bpm) {
  if (bpm == 0) return HR_NONE;
  if (bpm < BPM_LOW_BELOW) return HR_LOW;
  if (bpm > BPM_HIGH_ABOVE) return HR_HIGH;
  return HR_NORMAL;
}

void HeartRate::reset() {
  clearHistory();
  valid_ = false;
  haveLastBeat_ = false;
  lastBeatMs_ = 0;
  haveAccepted_ = false;
  lastAcceptedMs_ = 0;
  consecRejects_ = 0;
  badSignal_ = false;
  badSinceMs_ = 0;
  accepted_ = 0;
  rejected_ = 0;
}

void HeartRate::clearHistory() {
  for (uint8_t i = 0; i < IBI_HISTORY; i++) ibi_[i] = 0;
  head_ = 0;
  count_ = 0;
  lastIbi_ = 0;
  bpmX10_ = 0;
}

void HeartRate::pushIbi(uint16_t ibi) {
  ibi_[head_] = ibi;
  head_ = (uint8_t)((head_ + 1) % IBI_HISTORY);
  if (count_ < IBI_HISTORY) count_++;
  lastIbi_ = ibi;
}

uint16_t HeartRate::medianIbi() const {
  if (count_ == 0) return 0;
  // Tri par insertion d'une copie (au plus 8 valeurs : quelques µs sur AVR).
  uint16_t tmp[IBI_HISTORY];
  for (uint8_t i = 0; i < count_; i++) {
    uint16_t v = ibi_[(uint8_t)((head_ + IBI_HISTORY - 1 - i) % IBI_HISTORY)];
    int8_t j = (int8_t)i - 1;
    while (j >= 0 && tmp[j] > v) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = v;
  }
  if (count_ & 1) return tmp[count_ / 2];
  return (uint16_t)(((uint32_t)tmp[count_ / 2 - 1] + tmp[count_ / 2]) / 2);
}

void HeartRate::recompute() {
  // BPM moyen sur les n derniers IBI : on moyenne les INTERVALLES puis on
  // inverse (60000 x n / somme) ; c'est la fréquence réelle sur la fenêtre.
  uint8_t n = count_ < BPM_AVG_COUNT ? count_ : BPM_AVG_COUNT;
  uint32_t sum = 0;
  for (uint8_t k = 0; k < n; k++) {
    sum += ibi_[(uint8_t)((head_ + IBI_HISTORY - 1 - k) % IBI_HISTORY)];
  }
  // sum >= n x IBI_MIN_MS > 0 dès que n > 0 : pas de division par zéro.
  bpmX10_ = (n > 0 && sum > 0) ? (uint16_t)((600000UL * n + sum / 2) / sum) : 0;
  valid_ = (count_ >= MIN_VALID_INTERVALS) && (bpmX10_ > 0);
}

void HeartRate::invalidate(uint8_t &ev) {
  if (valid_) ev |= HR_EV_BECAME_INVALID;
  valid_ = false;
  clearHistory();
  consecRejects_ = 0;
}

uint16_t HeartRate::refractoryMs() const {
  if (count_ < 3) return REFRACTORY_MIN_MS;
  uint16_t r = medianIbi() / 2;
  return r > REFRACTORY_MIN_MS ? r : REFRACTORY_MIN_MS;
}

uint16_t HeartRate::lastInstantBpmX10() const {
  if (lastIbi_ == 0) return 0;
  return (uint16_t)((600000UL + lastIbi_ / 2) / lastIbi_);
}

uint8_t HeartRate::update(uint32_t nowMs, bool signalOk, bool beat, uint32_t beatTimeMs) {
  uint8_t ev = 0;
  const bool wasValid = valid_;

  // --- 1. Perte de qualité du signal prolongée -> mesure invalidée -------
  if (!signalOk) {
    if (!badSignal_) { badSignal_ = true; badSinceMs_ = nowMs; }
    else if ((uint32_t)(nowMs - badSinceMs_) >= SIGNAL_LOSS_MS) {
      invalidate(ev);
      haveLastBeat_ = false;
      haveAccepted_ = false;
    }
  } else {
    badSignal_ = false;
  }

  // --- 2. Plus aucun battement accepté depuis BEAT_TIMEOUT_MS ------------
  if (haveAccepted_ && (uint32_t)(nowMs - lastAcceptedMs_) >= BEAT_TIMEOUT_MS) {
    invalidate(ev);
    haveAccepted_ = false;
  }
  if (haveLastBeat_ && (uint32_t)(nowMs - lastBeatMs_) >= BEAT_TIMEOUT_MS) {
    haveLastBeat_ = false;   // référence trop ancienne pour former un IBI
  }

  // --- 3. Nouveau battement ----------------------------------------------
  if (beat) {
    if (!haveLastBeat_) {
      haveLastBeat_ = true;            // premier battement : pas encore d'IBI
      lastBeatMs_ = beatTimeMs;
    } else {
      const uint32_t d = (uint32_t)(beatTimeMs - lastBeatMs_);
      lastBeatMs_ = beatTimeMs;
      const bool plausible = (d >= IBI_MIN_MS) && (d <= IBI_MAX_MS);
      bool ok = plausible;
      if (ok && count_ > 0) {
        // Référence : médiane si l'historique est suffisant, sinon le
        // dernier intervalle (phase d'accrochage).
        const uint16_t ref = (count_ >= 3) ? medianIbi() : lastIbi_;
        const uint32_t tol = (uint32_t)ref * IBI_TOLERANCE_PCT / 100;
        const uint32_t diff = d > ref ? d - ref : ref - d;
        ok = diff <= tol;
      }

      if (ok) {
        pushIbi((uint16_t)d);
        consecRejects_ = 0;
        accepted_++;
        haveAccepted_ = true;
        lastAcceptedMs_ = beatTimeMs;
        ev |= HR_EV_BEAT_ACCEPTED;
      } else {
        rejected_++;
        ev |= HR_EV_BEAT_REJECTED;
        if (plausible && count_ < 3) {
          // Accrochage : deux intervalles incohérents -> on repart de
          // l'intervalle le plus récent (le premier était peut-être faux).
          clearHistory();
          pushIbi((uint16_t)d);
          haveAccepted_ = true;
          lastAcceptedMs_ = beatTimeMs;
        } else if (++consecRejects_ >= MAX_CONSEC_REJECTS) {
          // Rejets répétés : soit le rythme a vraiment changé, soit le
          // signal est mauvais. Dans les deux cas l'ancien BPM n'est plus
          // fiable : on invalide et on recommence l'accrochage.
          clearHistory();
          consecRejects_ = 0;
          if (plausible) {
            pushIbi((uint16_t)d);
            haveAccepted_ = true;
            lastAcceptedMs_ = beatTimeMs;
          }
        }
      }
      recompute();
    }
  }

  if (!wasValid && valid_) ev |= HR_EV_BECAME_VALID;
  if (wasValid && !valid_) ev |= HR_EV_BECAME_INVALID;
  return ev;
}
