/*
 * App.h — objets partagés entre le programme principal (CardioECE.ino),
 * le menu et la console série. Ils sont DÉFINIS une seule fois dans
 * CardioECE.ino (allocation statique : aucune allocation dynamique).
 */
#ifndef CARDIO_APP_H
#define CARDIO_APP_H

#include "config.h"
#include "PPGProcessor.h"
#include "HeartRate.h"
#include "EEPROMManager.h"
#if SIMULATION_MODE
#include "PPGSimulator.h"
#endif

extern PPGProcessor  g_proc;
extern HeartRate     g_hr;
extern EEPROMManager g_eeprom;
extern bool          g_signalOk;      // qualité du signal (dernier échantillon)
extern uint16_t      g_amplitudeAdc;  // amplitude crête-à-crête estimée
#if SIMULATION_MODE
extern PPGSimulator  g_sim;
#endif

// Modes de la sortie série temps réel
enum PlotMode : uint8_t { PLOT_OFF = 0, PLOT_ARDUINO = 1, PLOT_TELEPLOT = 2, PLOT_CSV = 3 };
extern uint8_t g_plotMode;

// Actions communes (bouton, menu, console) définies dans CardioECE.ino
void appSetBuzzer(bool on);
void appSetLanguage(uint8_t lang);
void appStartSelfTest();

#endif
