#include <Arduino.h>
#include "PPGSensor.h"
#include "config.h"

#if (SAMPLE_FIFO_SIZE & (SAMPLE_FIFO_SIZE - 1)) != 0
#error "SAMPLE_FIFO_SIZE doit etre une puissance de 2"
#endif

// Variables partagées ISR <-> loop() : 'volatile' + accès atomiques.
static volatile uint16_t s_fifo[SAMPLE_FIFO_SIZE];
static volatile uint8_t  s_head = 0;     // écrit par l'ISR
static volatile uint8_t  s_tail = 0;     // écrit par loop()
static volatile uint32_t s_index = 0;    // index du prochain échantillon produit
static volatile uint16_t s_overruns = 0;
static volatile bool     s_primed = false;
static volatile uint8_t  s_maxLevel = 0;  // pire retard observé de loop() (en échantillons)

void PPGSensor::begin() {
  // --- ADC : référence AVcc (5 V), canal du capteur, horloge 125 kHz ------
  ADMUX = _BV(REFS0) | (PPG_ADC_CHANNEL & 0x07);
  ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);  // 16 MHz / 128
  DIDR0 |= _BV(PPG_ADC_CHANNEL);   // coupe le buffer numérique de A0 : moins de bruit
  ADCSRA |= _BV(ADSC);             // première conversion

  // --- Timer1 en mode CTC : f = 16 MHz / (8 x (OCR1A + 1)) ----------------
  noInterrupts();
  TCCR1A = 0;
  TCCR1B = _BV(WGM12) | _BV(CS11);                 // CTC, prescaler 8 -> 2 MHz
  OCR1A = (uint16_t)(F_CPU / 8UL / SAMPLE_RATE_HZ - 1UL); // 19999 -> 100 Hz
  TCNT1 = 0;
  TIFR1 = _BV(OCF1A);
  TIMSK1 = _BV(OCIE1A);
  interrupts();
}

ISR(TIMER1_COMPA_vect) {
  // Conversion lancée il y a 10 ms : forcément terminée (104 µs).
  const uint16_t v = ADC;
  ADCSRA |= _BV(ADSC);             // échantillon suivant, pris MAINTENANT
  if (!s_primed) { s_primed = true; return; }   // 1re conversion ignorée
  const uint8_t next = (uint8_t)((s_head + 1) & (SAMPLE_FIFO_SIZE - 1));
  if (next == s_tail) {            // FIFO pleine : loop() trop lente
    s_overruns++;
  } else {
    s_fifo[s_head] = v;
    s_head = next;
    const uint8_t level = (uint8_t)((next - s_tail) & (SAMPLE_FIFO_SIZE - 1));
    if (level > s_maxLevel) s_maxLevel = level;
  }
  s_index++;                       // compte aussi les éventuels perdus
}

bool PPGSensor::pop(uint16_t &raw, uint32_t &index) {
  bool ok = false;
  noInterrupts();
  const uint8_t tail = s_tail;
  if (tail != s_head) {
    raw = s_fifo[tail];
    const uint8_t level = (uint8_t)((s_head - tail) & (SAMPLE_FIFO_SIZE - 1));
    // index de cet échantillon = index courant - nombre encore en attente
    index = s_index - level;
    s_tail = (uint8_t)((tail + 1) & (SAMPLE_FIFO_SIZE - 1));
    ok = true;
  }
  interrupts();
  return ok;
}

uint16_t PPGSensor::overruns() {
  noInterrupts();
  const uint16_t o = s_overruns;
  interrupts();
  return o;
}

uint8_t PPGSensor::fifoLevel() {
  noInterrupts();
  const uint8_t l = (uint8_t)((s_head - s_tail) & (SAMPLE_FIFO_SIZE - 1));
  interrupts();
  return l;
}

uint8_t PPGSensor::maxLevel() {
  return s_maxLevel;   // lecture d'un octet : atomique sur AVR
}
