#include "PPGProcessor.h"

// Médiane de 5 valeurs : réseau de comparaisons fixe (7 échanges), pas de tri
// complet. Coût constant et faible sur AVR.
static uint16_t median5(const uint16_t *in) {
  uint16_t a = in[0], b = in[1], c = in[2], d = in[3], e = in[4], t;
#define CARDIO_SORT2(x, y) if (x > y) { t = x; x = y; y = t; }
  CARDIO_SORT2(a, b); CARDIO_SORT2(d, e); CARDIO_SORT2(a, c); CARDIO_SORT2(b, c);
  CARDIO_SORT2(a, d); CARDIO_SORT2(c, d); CARDIO_SORT2(b, e); CARDIO_SORT2(b, c);
#undef CARDIO_SORT2
  // Après ce réseau, c contient la 3e plus petite valeur, c.-à-d. la
  // médiane (vérifié exhaustivement sur les 7776 combinaisons de 6 niveaux).
  (void)e; (void)d;
  return c;
}

void PPGProcessor::reset() {
  for (uint8_t i = 0; i < 5; i++) medBuf_[i] = 0;
  medIdx_ = 0;
  for (uint16_t i = 0; i < DC_WINDOW; i++) dcSet(i, 0);
  dcSum_ = 0;
  dcIdx_ = 0;
  dcPrimed_ = false;
  for (uint8_t i = 0; i < LP_WINDOW; i++) lpBuf_[i] = 0;
  lpSum_ = 0;
  lpIdx_ = 0;
  envMax256_ = 0;
  envMin256_ = 0;
  armed_ = false;
  havePrev_ = false;
  prevFiltered_ = 0;
  prevT_ = 0;
  haveBeat_ = false;
  lastBeatMs_ = 0;
  refractoryMs_ = REFRACTORY_MIN_MS;
  saturationHold_ = 0;
}

void PPGProcessor::process(uint16_t raw, uint32_t tMs, PPGSample &out) {
  if (raw > 1023) raw = 1023;

  // -------------------------------------------------------------------------
  // 0. Filtre médian 5 points : une impulsion de 1 ou 2 échantillons ne peut
  //    jamais être la médiane de 5 valeurs -> elle disparaît totalement.
  //    Les fronts monotones et les pics larges (> 2 éch.) sont conservés.
  //    Retard fixe : 2 échantillons (20 ms), reporté sur l'horodatage.
  // -------------------------------------------------------------------------
#if MEDIAN_ENABLED
  if (!dcPrimed_) for (uint8_t i = 0; i < 5; i++) medBuf_[i] = raw;
  medBuf_[medIdx_] = raw;
  medIdx_ = (uint8_t)(medIdx_ == 4 ? 0 : medIdx_ + 1);
  const uint16_t rawIn = raw;          // valeur brute conservée pour l'export
  raw = median5(medBuf_);
  tMs -= 2u * SAMPLE_PERIOD_MS;
#else
  const uint16_t rawIn = raw;
#endif

  // -------------------------------------------------------------------------
  // 1. Suppression de la composante continue : x_c[n] = x[n] - moyenne(N)
  //    Somme glissante : on retire l'échantillon le plus ancien et on ajoute
  //    le nouveau -> O(1) par échantillon, et somme EXACTE (entiers), donc
  //    aucune dérive numérique même après des heures.
  //    Au premier échantillon, le buffer est rempli avec cette valeur : la
  //    moyenne est immédiatement juste (pas de transitoire de démarrage).
  // -------------------------------------------------------------------------
  if (!dcPrimed_) {
    for (uint16_t i = 0; i < DC_WINDOW; i++) dcSet(i, raw);
    dcSum_ = (uint32_t)raw * DC_WINDOW;
    dcPrimed_ = true;
  }
  dcSum_ -= dcGet(dcIdx_);
  dcSet(dcIdx_, raw);
  dcSum_ += raw;
  dcIdx_ = (uint16_t)((dcIdx_ + 1) & (DC_WINDOW - 1));

  // moyenne x8 = somme * 8 / N = somme >> (log2(N) - 3)
  const int32_t mean8 = (int32_t)(dcSum_ >> (DC_WINDOW_LOG2 - SIGNAL_SHIFT));
#if DC_CENTERED
  // Moyenne CENTRÉE : on retranche la moyenne à l'échantillon situé au
  // milieu de la fenêtre (x[n - N/2], déjà présent dans le buffer). Filtre à
  // phase linéaire : forme d'onde intacte et dérive LINÉAIRE annulée
  // exactement. Contrepartie : retard fixe de N/2 échantillons (0,64 s),
  // reporté sur l'horodatage pour que les instants restent exacts.
  const uint16_t mid = dcGet((uint16_t)((dcIdx_ + DC_WINDOW / 2) & (DC_WINDOW - 1)));
  const int16_t centred = (int16_t)(((int32_t)mid << SIGNAL_SHIFT) - mean8);
  tMs -= (uint32_t)(DC_WINDOW / 2 - 1) * SAMPLE_PERIOD_MS;   // x[n-63]
#else
  // Moyenne CAUSALE : aucun retard, mais une dérive de pente p laisse un
  // décalage résiduel p x (N-1)/2.
  const int16_t centred = (int16_t)(((int32_t)raw << SIGNAL_SHIFT) - mean8);
#endif

  // -------------------------------------------------------------------------
  // 2. Passe-bas : moyenne glissante sur 4 échantillons (40 ms).
  //    Retard de groupe constant (15 ms) : forme du pic conservée.
  // -------------------------------------------------------------------------
  lpSum_ -= lpBuf_[lpIdx_];
  lpBuf_[lpIdx_] = centred;
  lpSum_ += centred;
  lpIdx_ = (uint8_t)((lpIdx_ + 1) & (LP_WINDOW - 1));
  const int16_t filtered = (int16_t)(lpSum_ >> LP_WINDOW_LOG2);

  // -------------------------------------------------------------------------
  // 3. Enveloppes : attaque instantanée, décroissance exponentielle vers 0
  //    (tau = 2^ENV_DECAY_SHIFT échantillons = 2,56 s). Elles suivent
  //    l'amplitude utile : le seuil s'adapte à chaque personne, à la
  //    pression du doigt et à la luminosité ambiante.
  // -------------------------------------------------------------------------
  const int32_t f256 = (int32_t)filtered << 8;
  if (f256 > envMax256_) envMax256_ = f256;
  else envMax256_ -= envMax256_ >> ENV_DECAY_SHIFT;
  if (f256 < envMin256_) envMin256_ = f256;
  else envMin256_ -= envMin256_ >> ENV_DECAY_SHIFT;

  const int16_t envMax = (int16_t)(envMax256_ >> 8);
  const int16_t envMin = (int16_t)(envMin256_ >> 8);
  const int16_t amp = (int16_t)(envMax - envMin);          // >= 0
  const int16_t centre = (int16_t)((envMax + envMin) / 2);
  const int16_t thrHigh = (int16_t)(centre + ((int32_t)amp * THR_HIGH_NUM16) / 16);
  const int16_t thrLow  = (int16_t)(centre - ((int32_t)amp * THR_LOW_NUM16) / 16);

  // -------------------------------------------------------------------------
  // 4. Qualité du signal
  //    - ADC saturé de façon durable : marqué pendant 500 ms après la
  //      dernière saturation ;
  //    - amplitude trop faible : pas de doigt ou capteur débranché ;
  //    - amplitude trop forte : mouvement.
  // -------------------------------------------------------------------------
  // Testé APRÈS le médian : une saturation de 1-2 échantillons (impulsion)
  // n'invalide pas la mesure ; une saturation durable (doigt trop appuyé,
  // lumière intense, capteur débranché) oui.
  if (raw <= ADC_SATURATION_LOW || raw >= ADC_SATURATION_HIGH) {
    saturationHold_ = (uint8_t)(SAMPLE_RATE_HZ / 2);
  } else if (saturationHold_ > 0) {
    saturationHold_--;
  }
  const uint16_t ampAdc = (uint16_t)(amp >> SIGNAL_SHIFT);
  const bool signalOk = (saturationHold_ == 0) &&
                        (ampAdc >= MIN_AMPLITUDE_ADC) &&
                        (ampAdc <= MAX_AMPLITUDE_ADC);

  // -------------------------------------------------------------------------
  // 5. Détection : machine à 2 états avec hystérésis
  //    ARMÉ  : le signal est passé sous thrLow (fin du battement précédent)
  //    DÉCLENCHEMENT : franchissement MONTANT de thrHigh, c.-à-d. le front
  //    systolique, partie la plus raide (donc la mieux datée) de l'onde.
  //    L'instant est interpolé linéairement entre les deux échantillons
  //    encadrant le seuil -> résolution ~1 ms au lieu de 10 ms.
  // -------------------------------------------------------------------------
  bool beat = false;
  uint32_t beatT = 0;
  if (!signalOk) {
    armed_ = false;                  // pas de détection sur un signal douteux
  } else if (havePrev_) {
    if (!armed_) {
      if (filtered < thrLow) armed_ = true;
    } else if (filtered > thrHigh) {
      armed_ = false;                // il faudra repasser sous thrLow
      int32_t num = (int32_t)thrHigh - prevFiltered_;
      int32_t den = (int32_t)filtered - prevFiltered_;
      if (num < 0) num = 0;
      if (den <= 0) { den = 1; num = 1; }      // pas de division par zéro
      if (num > den) num = den;
      const uint32_t dt = tMs - prevT_;
      const uint32_t tCross = prevT_ + (uint32_t)((num * (int32_t)dt + den / 2) / den);
      // Période réfractaire : un 2e franchissement trop proche (onde
      // dicrote, rebond) est ignoré. Différence non signée : correcte même
      // au débordement du compteur 32 bits.
      if (!haveBeat_ || (uint32_t)(tCross - lastBeatMs_) >= refractoryMs_) {
        beat = true;
        beatT = tCross;
        lastBeatMs_ = tCross;
        haveBeat_ = true;
      }
    }
  }
  prevFiltered_ = filtered;
  prevT_ = tMs;
  havePrev_ = true;

  out.tMs = tMs;
  out.raw = rawIn;
  out.centred = centred;
  out.filtered = filtered;
  out.envMax = envMax;
  out.envMin = envMin;
  out.thrHigh = thrHigh;
  out.thrLow = thrLow;
  out.amplitudeAdc = ampAdc;
  out.signalOk = signalOk;
  out.beat = beat;
  out.beatTimeMs = beatT;
}
