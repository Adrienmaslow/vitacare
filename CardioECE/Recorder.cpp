#include <Arduino.h>
#include "Recorder.h"
#include "App.h"
#include "RTCManager.h"

static bool     s_active = false;
static uint8_t  s_n = 0;
static uint32_t s_sumX10 = 0;
static uint32_t s_startMs = 0;
static Record   s_rec;
static uint8_t  s_lastBpm = 0;

RecResult Recorder::toggle(uint32_t nowMs) {
  if (s_active) { s_active = false; return REC_CANCELLED; }   // 2e appui = annuler
  if (!g_hr.isValid()) return REC_REFUSED_INVALID;           // jamais de valeur invalide
  if (g_eeprom.isFull()) return REC_REFUSED_FULL;
  const bool rtcOk = RTCManager::isValid();
#if RECORD_REQUIRE_RTC
  if (!rtcOk) return REC_REFUSED_RTC;
#endif
  if (rtcOk) {
    const DateTime &dt = RTCManager::now();
    s_rec.day = dt.day; s_rec.month = dt.month; s_rec.year = (uint8_t)(dt.year - 2000);
    s_rec.hour = dt.hour; s_rec.minute = dt.minute; s_rec.second = dt.second;
  } else {                                                    // RECORD_REQUIRE_RTC = 0
    s_rec.day = 1; s_rec.month = 1; s_rec.year = 0;
    s_rec.hour = 0; s_rec.minute = 0; s_rec.second = 0;
  }
  s_active = true;
  s_n = 0;
  s_sumX10 = 0;
  s_startMs = nowMs;
  return REC_STARTED;
}

RecResult Recorder::onHeartEvents(uint8_t ev, uint16_t instBpmX10) {
  if (!s_active) return REC_NONE;
  if (ev & HR_EV_BEAT_REJECTED) {          // série interrompue : on recommence
    s_n = 0;
    s_sumX10 = 0;
  }
  if ((ev & HR_EV_BEAT_ACCEPTED) && g_hr.isValid() && instBpmX10 > 0) {
    s_sumX10 += instBpmX10;
    s_n++;
    if (s_n >= RECORD_SAMPLES) {
      s_active = false;
      // moyenne arithmétique des 10 BPM instantanés, arrondie à l'unité
      s_rec.bpm = (uint8_t)((s_sumX10 + 5UL * RECORD_SAMPLES) / (10UL * RECORD_SAMPLES));
      s_lastBpm = s_rec.bpm;
      const EEResult r = g_eeprom.append(s_rec);
      if (r == EE_OK) return REC_SAVED;
      return r == EE_FULL ? REC_REFUSED_FULL : REC_ERROR;
    }
  }
  return REC_NONE;
}

RecResult Recorder::update(uint32_t nowMs) {
  if (!s_active) return REC_NONE;
  if (!g_hr.isValid()) { s_active = false; return REC_CANCELLED; }
  if ((uint32_t)(nowMs - s_startMs) >= RECORD_TIMEOUT_MS) { s_active = false; return REC_TIMEOUT; }
  return REC_NONE;
}

bool Recorder::active() { return s_active; }
uint8_t Recorder::progress() { return s_n; }
uint8_t Recorder::lastBpm() { return s_lastBpm; }
