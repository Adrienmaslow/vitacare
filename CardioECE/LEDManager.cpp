#include <Arduino.h>
#include "LEDManager.h"
#include "config.h"

static HrClass s_current = HR_NONE;
static bool    s_forceWrite = true;

static inline void ledWrite(uint8_t pin, bool on) {
  digitalWrite(pin, (on ^ (LED_ACTIVE_LOW != 0)) ? HIGH : LOW);
}

static void apply(HrClass c) {
  // On ÉTEINT d'abord toutes les LED, puis on allume la seule concernée :
  // même pendant la transition, deux LED ne sont jamais allumées ensemble.
  ledWrite(PIN_LED_YELLOW, false);
  ledWrite(PIN_LED_GREEN, false);
  ledWrite(PIN_LED_RED, false);
  switch (c) {
    case HR_LOW:    ledWrite(PIN_LED_YELLOW, true); break;
    case HR_NORMAL: ledWrite(PIN_LED_GREEN, true);  break;
    case HR_HIGH:   ledWrite(PIN_LED_RED, true);    break;
    default: break;                                  // HR_NONE : tout éteint
  }
}

void LEDManager::begin() {
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  s_forceWrite = true;
  updateHeartRateIndicators(HR_NONE);
}

void LEDManager::updateHeartRateIndicators(HrClass c) {
  if (c == s_current && !s_forceWrite) return;
  s_current = c;
  s_forceWrite = false;
  apply(c);
}

HrClass LEDManager::current() { return s_current; }

void LEDManager::selfTest(uint8_t step) {
  apply(step == 1 ? HR_LOW : step == 2 ? HR_NORMAL : step == 3 ? HR_HIGH : HR_NONE);
  s_forceWrite = true;   // la prochaine mise à jour normale réécrit l'état réel
}
