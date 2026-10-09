#include <Arduino.h>
#include "InputManager.h"
#include "config.h"

struct Button {
  uint8_t  pin;
  bool     present;
  bool     stable;       // état validé (true = appuyé)
  bool     lastRaw;
  bool     longFired;
  uint32_t changeMs;     // dernier changement brut
  uint32_t pressMs;      // début de l'appui validé
  uint8_t  events;
};

static Button s_btn[BTN_COUNT] = {
  {PIN_BTN_RECORD, true, false, false, false, 0, 0, 0},
  {PIN_BTN_BUZZER, HAS_BUZZER_BUTTON != 0, false, false, false, 0, 0, 0},
  {PIN_ENC_SW, true, false, false, false, 0, 0, 0},
};

// ----- Encodeur (ISR) -------------------------------------------------------
static volatile uint16_t s_encSteps = 0;  // transitions cumulées (modulo 2^16)
static volatile uint8_t s_encState = 0;   // (A<<1)|B précédent
static volatile uint8_t *s_encAReg;
static volatile uint8_t *s_encBReg;
static uint8_t s_encAMask, s_encBMask;
static uint16_t s_encConsumed = 0;

// Indice = (ancien état << 2) | nouvel état ; valeur = +1, -1 ou 0 (invalide)
static const int8_t QDEC[16] PROGMEM = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};

static inline void encoderIsr() {
  const uint8_t a = (*s_encAReg & s_encAMask) ? 1 : 0;
  const uint8_t b = (*s_encBReg & s_encBMask) ? 1 : 0;
  const uint8_t st = (uint8_t)((a << 1) | b);
  s_encSteps = (uint16_t)(s_encSteps + (uint16_t)(int16_t)(int8_t)pgm_read_byte(&QDEC[(s_encState << 2) | st]));
  s_encState = st;
}

// Un seul vecteur d'interruption par port concerné (Uno/Nano) :
//   D0..D7 -> PCINT2, D8..D13 -> PCINT0, A0..A5 (14..19) -> PCINT1.
// Avec le câblage D8/D9 : seul PCINT0 est utilisé. Aucune autre
// bibliothèque du projet n'utilise les interruptions PCINT.
#define ENC_PCINT_GROUP(p) ((p) <= 7 ? 2 : ((p) <= 13 ? 0 : 1))
#if ENC_PCINT_GROUP(PIN_ENC_A) == 0 || ENC_PCINT_GROUP(PIN_ENC_B) == 0
ISR(PCINT0_vect) { encoderIsr(); }
#endif
#if ENC_PCINT_GROUP(PIN_ENC_A) == 1 || ENC_PCINT_GROUP(PIN_ENC_B) == 1
ISR(PCINT1_vect) { encoderIsr(); }
#endif
#if ENC_PCINT_GROUP(PIN_ENC_A) == 2 || ENC_PCINT_GROUP(PIN_ENC_B) == 2
ISR(PCINT2_vect) { encoderIsr(); }
#endif

static void enablePcint(uint8_t pin) {
  *digitalPinToPCMSK(pin) |= _BV(digitalPinToPCMSKbit(pin));
  PCIFR |= _BV(digitalPinToPCICRbit(pin));
  PCICR |= _BV(digitalPinToPCICRbit(pin));
}

void InputManager::begin() {
  const uint32_t now = millis();
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    if (!s_btn[i].present) continue;
    pinMode(s_btn[i].pin, INPUT_PULLUP);
    s_btn[i].changeMs = now;
  }
  pinMode(PIN_ENC_A, INPUT_PULLUP);    // le KY-040 a déjà des 10 kΩ : sans effet néfaste
  pinMode(PIN_ENC_B, INPUT_PULLUP);
  s_encAReg = portInputRegister(digitalPinToPort(PIN_ENC_A));
  s_encBReg = portInputRegister(digitalPinToPort(PIN_ENC_B));
  s_encAMask = digitalPinToBitMask(PIN_ENC_A);
  s_encBMask = digitalPinToBitMask(PIN_ENC_B);
  noInterrupts();
  s_encState = (uint8_t)((((*s_encAReg & s_encAMask) ? 1 : 0) << 1) | ((*s_encBReg & s_encBMask) ? 1 : 0));
  enablePcint(PIN_ENC_A);
  enablePcint(PIN_ENC_B);
  interrupts();
}

void InputManager::update(uint32_t nowMs) {
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    Button &b = s_btn[i];
    if (!b.present) continue;
    const bool raw = digitalRead(b.pin) == LOW;      // appuyé = LOW
    if (raw != b.lastRaw) { b.lastRaw = raw; b.changeMs = nowMs; }
    if (raw != b.stable && (uint32_t)(nowMs - b.changeMs) >= DEBOUNCE_MS) {
      b.stable = raw;
      if (raw) {
        b.pressMs = nowMs;
        b.longFired = false;
        b.events |= BTN_EV_PRESS;
      } else if (!b.longFired) {
        b.events |= BTN_EV_SHORT;
      }
    }
    if (b.stable && !b.longFired && (uint32_t)(nowMs - b.pressMs) >= LONG_PRESS_MS) {
      b.longFired = true;
      b.events |= BTN_EV_LONG;
    }
  }
}

uint8_t InputManager::events(ButtonId id) {
  if (id >= BTN_COUNT) return 0;
  const uint8_t e = s_btn[id].events;
  s_btn[id].events = 0;
  return e;
}

bool InputManager::isDown(ButtonId id) { return id < BTN_COUNT && s_btn[id].stable; }

int8_t InputManager::encoderDelta() {
  noInterrupts();
  const uint16_t steps = s_encSteps;
  interrupts();
  // On ne consomme que des crans ENTIERS ; le reste est gardé pour la suite.
  // Arithmétique non signée : le débordement du compteur est sans effet.
  const int16_t pending = (int16_t)(uint16_t)(steps - s_encConsumed);
  const int16_t detents = (int16_t)(pending / ENCODER_STEPS_PER_DETENT);
  s_encConsumed = (uint16_t)(s_encConsumed + (uint16_t)(detents * ENCODER_STEPS_PER_DETENT));
  int16_t d = ENCODER_REVERSE ? -detents : detents;
  if (d > 127) d = 127;
  if (d < -127) d = -127;
  return (int8_t)d;
}
