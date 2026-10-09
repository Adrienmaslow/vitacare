#include <Arduino.h>
#include "BuzzerManager.h"
#include "config.h"

static bool     s_enabled = true;

#if !BUZZER_IS_ACTIVE
// ---------------------------------------------------------------------------
// Générateur de tonalité dédié sur Timer2 (équivalent de tone()/noTone()).
// Pourquoi pas tone() du cœur Arduino ? Il gère 3 timers et n'importe quelle
// broche : ~1,4 Ko de Flash, qui manquaient pour tenir dans les 32 256 o
// disponibles de l'Uno. Principe identique : le Timer2 en mode CTC
// déclenche une interruption à 2 x f ; l'ISR inverse la broche du buzzer
// (signal carré de fréquence f) et décompte la durée -> NON bloquant.
// Même timer que tone() : mêmes contraintes (PWM D3/D11 indisponible).
// ---------------------------------------------------------------------------
static volatile uint8_t *s_buzPin;        // registre PINx : écrire 1 = inverser
static uint8_t           s_buzMask;
static volatile uint32_t s_toggles = 0;   // demi-périodes restantes

ISR(TIMER2_COMPA_vect) {
  if (s_toggles) {
    *s_buzPin = s_buzMask;                 // inversion matérielle de la broche
    if (--s_toggles == 0) {
      TIMSK2 = 0;                          // fin du bip
      *portOutputRegister(digitalPinToPort(PIN_BUZZER)) &= (uint8_t)~s_buzMask;
    }
  }
}

static void toneStart(uint16_t freq, uint16_t durMs) {
  if (freq == 0) return;
  // Pré-diviseur : le plus petit qui donne OCR2A <= 255.
  static const uint16_t PRESC[] PROGMEM = {32, 64, 128, 256, 1024};
  static const uint8_t  CS[] PROGMEM = {_BV(CS21) | _BV(CS20), _BV(CS22), _BV(CS22) | _BV(CS20),
                                   _BV(CS22) | _BV(CS21), _BV(CS22) | _BV(CS21) | _BV(CS20)};
  uint8_t k = 0;
  uint32_t ocr = 0;
  for (; k < 5; k++) {
    ocr = F_CPU / (2UL * pgm_read_word(&PRESC[k]) * freq) - 1;
    if (ocr <= 255) break;
  }
  if (k == 5) return;                      // fréquence trop basse (< 31 Hz)
  noInterrupts();
  TCCR2A = _BV(WGM21);                     // CTC
  TCCR2B = pgm_read_byte(&CS[k]);
  OCR2A = (uint8_t)ocr;
  TCNT2 = 0;
  s_toggles = 2UL * freq * durMs / 1000UL;
  TIMSK2 = _BV(OCIE2A);
  interrupts();
}

static void toneStop() {
  noInterrupts();
  TIMSK2 = 0;
  s_toggles = 0;
  interrupts();
  digitalWrite(PIN_BUZZER, LOW);
}
#endif
static bool     s_activeOn = false;    // buzzer actif : bip en cours
static uint32_t s_activeStart = 0;
static uint16_t s_activeDur = 0;

static void startBeep(uint16_t freq, uint16_t durMs) {
#if BUZZER_IS_ACTIVE
  (void)freq;
  digitalWrite(PIN_BUZZER, HIGH);
  s_activeOn = true;
  s_activeStart = millis();
  s_activeDur = durMs;
#else
  toneStart(freq, durMs);              // non bloquant (Timer2)
#endif
}

static void stopBeep() {
#if BUZZER_IS_ACTIVE
  digitalWrite(PIN_BUZZER, LOW);
  s_activeOn = false;
#else
  toneStop();
#endif
}

void BuzzerManager::begin(bool enabled) {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
#if !BUZZER_IS_ACTIVE
  s_buzPin = portInputRegister(digitalPinToPort(PIN_BUZZER));
  s_buzMask = digitalPinToBitMask(PIN_BUZZER);
#endif
  s_enabled = enabled;
}

void BuzzerManager::setEnabled(bool on) {
  s_enabled = on;
  if (!on) stopBeep();                 // coupe immédiatement un bip en cours
}

bool BuzzerManager::isEnabled() { return s_enabled; }

bool BuzzerManager::toggle() {
  setEnabled(!s_enabled);
  if (s_enabled) uiBeep();             // retour sonore : "buzzer réactivé"
  return s_enabled;
}

uint16_t BuzzerManager::frequencyFor(HrClass c) {
  switch (c) {
    case HR_LOW:  return TONE_LOW_HZ;
    case HR_HIGH: return TONE_HIGH_HZ;
    case HR_NORMAL: return TONE_NORMAL_HZ;
    default: return 0;
  }
}

void BuzzerManager::beatBeep(HrClass c) {
  if (!s_enabled || c == HR_NONE) return;   // jamais de bip sur mesure invalide
  startBeep(frequencyFor(c), BEEP_DURATION_MS);
}

void BuzzerManager::uiBeep() {
  if (!s_enabled) return;
  startBeep(TONE_UI_HZ, BEEP_UI_MS);
}

void BuzzerManager::update(uint32_t nowMs) {
  if (s_activeOn && (uint32_t)(nowMs - s_activeStart) >= s_activeDur) stopBeep();
}
