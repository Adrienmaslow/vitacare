/*
 * ===========================================================================
 *  CARDIO ECE — cardiofréquencemètre PPG sur Arduino (ATmega328P)
 * ===========================================================================
 *  FS1 acquisition + traitement PPG (algorithme maison, sans bibliothèque BPM)
 *  FS2 horloge DS1302          FS3 LED jaune/verte/rouge
 *  FS4 buzzer à 3 tonalités    FS5 deux OLED (texte + courbe)
 *  FS6 historique EEPROM + menu bilingue FR/EN
 *
 *  Architecture NON BLOQUANTE : l'échantillonnage est cadencé par le Timer1
 *  (interruption 100 Hz) et rangé dans une FIFO ; loop() ne fait que des
 *  tâches courtes et bornées, en traitant la FIFO EN PRIORITÉ entre chaque
 *  tâche. Aucun delay() en fonctionnement normal.
 *
 *  Configuration : config.h      Documentation : README.md
 * ===========================================================================
 */
#include "config.h"
#include "App.h"
#include "PPGSensor.h"
#include "PPGProcessor.h"
#include "HeartRate.h"
#include "RTCManager.h"
#include "LEDManager.h"
#include "BuzzerManager.h"
#include "InputManager.h"
#include "DisplayManager.h"
#include "EEPROMManager.h"
#include "MenuManager.h"
#include "Recorder.h"
#include "SerialConsole.h"
#include "Strings.h"
#if SIMULATION_MODE
#include "PPGSimulator.h"
#endif

// ----- Objets globaux (définitions uniques, déclarés dans App.h) -----------
PPGProcessor  g_proc;
HeartRate     g_hr;
EEPROMManager g_eeprom;
bool          g_signalOk = false;
uint16_t      g_amplitudeAdc = 0;
uint8_t       g_plotMode = PLOT_OFF;
#if SIMULATION_MODE
PPGSimulator  g_sim;
#endif

// ----- Auto-test non bloquant (démarrage et commande TEST) ----------------
static uint8_t  s_testStep = 0;      // 0 = inactif
static uint32_t s_testStepMs = 0;

void appStartSelfTest() {
  s_testStep = 1;
  s_testStepMs = millis();
}

static void updateSelfTest(uint32_t now) {
  // Étapes 1, 2, 3 : LED jaune + son grave, verte + moyen, rouge + aigu,
  // 400 ms chacune ; puis retour à l'affichage réel. Aucun delay().
  static uint8_t shown = 0;
  if (s_testStep == 0) return;
  if (shown != s_testStep) {
    shown = s_testStep;
    LEDManager::selfTest(s_testStep);
    const HrClass c = s_testStep == 1 ? HR_LOW : s_testStep == 2 ? HR_NORMAL : HR_HIGH;
    BuzzerManager::beatBeep(c);                   // respecte ON/OFF et le type de buzzer
  }
  if ((uint32_t)(now - s_testStepMs) >= 400) {
    s_testStepMs = now;
    if (++s_testStep > 3) {
      s_testStep = 0;
      shown = 0;
      LEDManager::selfTest(0);                     // rend la main à l'état réel
    }
  }
}

// ----- Actions communes ------------------------------------------------------
void appSetBuzzer(bool on) {
  BuzzerManager::setEnabled(on);
  if (on) BuzzerManager::uiBeep();
  g_eeprom.setBuzzerEnabled(on);     // n'écrit que si l'état change
}

void appSetLanguage(uint8_t lang) {
  MenuManager::setLanguage(lang);
  g_eeprom.setLanguage(lang);        // idem : pas d'écriture inutile
}

static void showRecordResult(uint32_t now, RecResult r) {
  switch (r) {
    case REC_STARTED:         BuzzerManager::uiBeep(); break;
    case REC_SAVED:
      MenuManager::showMessage(now, STR_MSG_SAVED, g_eeprom.count());
      BuzzerManager::uiBeep();
      Serial.print(F("Enregistrement #")); Serial.print(g_eeprom.count());
      Serial.print(F(" : ")); Serial.print(Recorder::lastBpm()); Serial.println(F(" BPM"));
      break;
    case REC_CANCELLED:       MenuManager::showMessage(now, STR_MSG_CANCELLED); break;
    case REC_TIMEOUT:         MenuManager::showMessage(now, STR_MSG_TIMEOUT); break;
    case REC_REFUSED_INVALID: MenuManager::showMessage(now, STR_MSG_INVALID); break;
    case REC_REFUSED_RTC:     MenuManager::showMessage(now, STR_MSG_RTC); break;
    case REC_REFUSED_FULL:    MenuManager::showMessage(now, STR_MSG_FULL); break;
    case REC_ERROR:           MenuManager::showMessage(now, STR_MSG_EEPROM_ERR); break;
    default: break;
  }
}

// ----- FS1 : traitement des échantillons en attente --------------------------
// Appelée plusieurs fois par tour de loop() : la FIFO ne déborde jamais.
static void processSamples(uint8_t maxCount) {
  uint16_t raw;
  uint32_t index;
  while (maxCount-- && PPGSensor::pop(raw, index)) {
#if SIMULATION_MODE
    raw = g_sim.next();   // même cadence (Timer1), seule la source change
#endif
    // Base de temps = numéro d'échantillon x 10 ms (quartz) : pas de gigue
    // liée à loop(). Débordement 32 bits géré par différences non signées.
    const uint32_t tMs = index * SAMPLE_PERIOD_MS;
    PPGSample s;
    g_proc.process(raw, tMs, s);
    const uint8_t ev = g_hr.update(tMs, s.signalOk, s.beat, s.beatTimeMs);
    g_proc.setRefractoryMs(g_hr.refractoryMs());
    g_signalOk = s.signalOk;
    g_amplitudeAdc = s.amplitudeAdc;

    DisplayManager::pushSample(s);
    const bool accepted = (ev & HR_EV_BEAT_ACCEPTED) && g_hr.isValid();
    if (accepted) {
      // FS4 : bip synchronisé sur le battement validé, tonalité selon la classe
      if (s_testStep == 0) BuzzerManager::beatBeep(g_hr.hrClass());
      DisplayManager::notifyBeat(millis());
    }
    const RecResult rr = Recorder::onHeartEvents(ev, g_hr.lastInstantBpmX10());
    if (rr != REC_NONE) showRecordResult(millis(), rr);
    SerialConsole::plotSample(s, accepted);
  }
}

// ----- Entrées utilisateur ---------------------------------------------------
static void handleButtons(uint32_t now) {
  const uint8_t rec = InputManager::events(BTN_RECORD);
#if HAS_BUZZER_BUTTON
  if (rec & BTN_EV_PRESS) showRecordResult(now, Recorder::toggle(now));
  if (InputManager::events(BTN_BUZZER) & BTN_EV_PRESS) appSetBuzzer(!BuzzerManager::isEnabled());
#else
  // Un seul bouton : appui court = enregistrer, appui long = buzzer ON/OFF
  if (rec & BTN_EV_SHORT) showRecordResult(now, Recorder::toggle(now));
  if (rec & BTN_EV_LONG) appSetBuzzer(!BuzzerManager::isEnabled());
#endif
  const int8_t d = InputManager::encoderDelta();
  const uint8_t enc = InputManager::events(BTN_ENCODER);
  if (d != 0 || enc != 0) MenuManager::handleInput(now, d, enc);
}

void setup() {
  SerialConsole::paintStack();               // mesure de la marge de pile (STATUS)
  Serial.begin(SERIAL_BAUD);
  g_eeprom.begin();                          // ne efface JAMAIS les données valides
  LEDManager::begin();
  BuzzerManager::begin(g_eeprom.buzzerEnabled());
  InputManager::begin();
  RTCManager::begin();                       // lecture seule : l'heure n'est pas modifiée
  MenuManager::begin(g_eeprom.language());
  DisplayManager::begin(MenuManager::composeLine);
  SerialConsole::begin();

  Serial.println(F("=== CARDIO ECE ==="));
#if SIMULATION_MODE
  Serial.println(F("!!! SIMULATION : signal synthetique !!!"));
#endif
  if (g_eeprom.wasFormatted()) Serial.println(F("EEPROM initialisee"));
  if (g_eeprom.wasRecovered()) Serial.println(F("EEPROM reparee"));
  Serial.print(F("Enreg. ")); Serial.println(g_eeprom.count());
  if (!RTCManager::isValid()) Serial.println(F("RTC non reglee -> SET"));
  if (!DisplayManager::textPresent()) Serial.println(F("OLED1 absent"));
  if (!DisplayManager::graphPresent()) Serial.println(F("OLED2 absent"));
  Serial.println(F("Tapez HELP"));

  appStartSelfTest();                        // LED + bips au démarrage (1,2 s, non bloquant)
  PPGSensor::begin();                        // en dernier : l'acquisition démarre
}

void loop() {
  const uint32_t now = millis();

  processSamples(SAMPLE_FIFO_SIZE);          // 1. PRIORITÉ : signal PPG

  InputManager::update(now);                 // 2. boutons (anti-rebond) + encodeur
  handleButtons(now);

  RTCManager::update(now);                   // 3. heure (toutes les 200 ms, ~0,7 ms)
  processSamples(4);

  const RecResult rr = Recorder::update(now);  // 4. annulation / délai d'enregistrement
  if (rr != REC_NONE) showRecordResult(now, rr);

  updateSelfTest(now);                       // 5. LED : seulement si changement
  if (s_testStep == 0) LEDManager::updateHeartRateIndicators(g_hr.hrClass());
  BuzzerManager::update(now);

  MenuManager::tick(now);                    // 6. écrans : 2 lignes OU 1 bande
  GraphInfo gi = { g_hr.bpm(), g_signalOk, SIMULATION_MODE != 0, MenuManager::language() };
  DisplayManager::update(now, gi);
  processSamples(4);

  SerialConsole::update();                   // 7. commandes série
}
