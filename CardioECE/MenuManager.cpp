#include <Arduino.h>
#include "MenuManager.h"
#include "DisplayManager.h"
#include "InputManager.h"
#include "BuzzerManager.h"
#include "RTCManager.h"
#include "Recorder.h"
#include "App.h"
#include "Format.h"

enum MenuItem : uint8_t {
  MI_MEASURE = 0, MI_HISTORY, MI_ERASE, MI_LANGUAGE, MI_BUZZER, MI_BACK, MI_COUNT
};
static const uint8_t MENU_LABEL[MI_COUNT] PROGMEM = {
  STR_MENU_MEASURE, STR_MENU_HISTORY, STR_MENU_ERASE,
  STR_MENU_LANGUAGE, STR_MENU_BUZZER, STR_MENU_BACK
};

static UiMode   s_mode = UI_HOME;
static uint8_t  s_lang = LANG_FR;
static uint8_t  s_cursor = 0;          // élément de menu sélectionné
static uint8_t  s_histPos = 0;         // 0 = enregistrement le plus récent
static bool     s_eraseYes = false;    // choix par défaut : NON (sécurité)
static uint32_t s_lastActivity = 0;
static StrId    s_msg = STR_COUNT;     // STR_COUNT = aucun message
static int16_t  s_msgNum = -1;
static uint32_t s_msgStart = 0;

void MenuManager::begin(uint8_t lang) {
  s_lang = lang < LANG_COUNT ? lang : (uint8_t)LANG_FR;
  s_mode = UI_HOME;
}

uint8_t MenuManager::language() { return s_lang; }
void MenuManager::setLanguage(uint8_t lang) { if (lang < LANG_COUNT) s_lang = lang; }
UiMode MenuManager::mode() { return s_mode; }

void MenuManager::showMessage(uint32_t nowMs, StrId id, int16_t number) {
  s_msg = id;
  s_msgNum = number;
  s_msgStart = nowMs;
}

static void goHome() { s_mode = UI_HOME; }

void MenuManager::tick(uint32_t nowMs) {
  if (s_msg != STR_COUNT && (uint32_t)(nowMs - s_msgStart) >= MESSAGE_DURATION_MS) s_msg = STR_COUNT;
  if (s_mode != UI_HOME && (uint32_t)(nowMs - s_lastActivity) >= MENU_TIMEOUT_MS) goHome();
}

static void selectItem(uint32_t nowMs) {
  switch (s_cursor) {
    case MI_MEASURE: goHome(); break;
    case MI_HISTORY: s_histPos = 0; s_mode = UI_HISTORY; break;
    case MI_ERASE:   s_eraseYes = false; s_mode = UI_ERASE_CONFIRM; break;
    case MI_LANGUAGE: appSetLanguage(s_lang == LANG_FR ? LANG_EN : LANG_FR); break;
    case MI_BUZZER:  appSetBuzzer(!BuzzerManager::isEnabled()); break;
    default:         goHome(); break;
  }
  (void)nowMs;
}

void MenuManager::handleInput(uint32_t nowMs, int8_t d, uint8_t ev) {
  if (d != 0 || ev != 0) s_lastActivity = nowMs;
  if (ev & BTN_EV_LONG) { goHome(); return; }       // appui long : accueil

  switch (s_mode) {
    case UI_HOME:
      if (d != 0) DisplayManager::changeScale(d);    // base de temps de la courbe
      if (ev & BTN_EV_SHORT) { s_cursor = 0; s_mode = UI_MENU; }
      break;

    case UI_MENU:
      if (d != 0) s_cursor = (uint8_t)((s_cursor + MI_COUNT + (d % MI_COUNT)) % MI_COUNT);
      if (ev & BTN_EV_SHORT) selectItem(nowMs);
      break;

    case UI_HISTORY: {
      const uint8_t n = g_eeprom.count();
      if (n > 0 && d != 0) {
        int16_t p = (int16_t)s_histPos + d;
        if (p < 0) p = 0;
        if (p >= n) p = n - 1;
        s_histPos = (uint8_t)p;
      }
      if (ev & BTN_EV_SHORT) s_mode = UI_MENU;
      break;
    }

    case UI_ERASE_CONFIRM:
      if (d != 0) s_eraseYes = !s_eraseYes;
      if (ev & BTN_EV_SHORT) {
        if (s_eraseYes) {
          g_eeprom.eraseAll();
          MenuManager::showMessage(nowMs, STR_MSG_ERASED);
          BuzzerManager::uiBeep();
        }
        s_mode = UI_MENU;
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Construction des lignes (16 caractères max, 8 pour une ligne LINE_BIG)
// ---------------------------------------------------------------------------
static void centre(char *buf, uint8_t width) {
  uint8_t len = (uint8_t)strlen(buf);
  if (len >= width) return;
  const uint8_t pad = (uint8_t)((width - len) / 2);
  memmove(buf + pad, buf, len + 1);
  memset(buf, ' ', pad);
}

static void fmtBig(char *buf, uint16_t bpm) {
  if (bpm > 0) strcpy_P(fmtU(buf, bpm, 3), PSTR(" BPM"));
  else strcpy_P(buf, PSTR(" -- BPM"));
}

static uint8_t messageLine(char *buf) {
  if (s_msg == STR_COUNT) return LINE_NORMAL;
  copyStr(s_msg, s_lang, buf, 17);
  if (s_msgNum >= 0 && strlen(buf) < 12) fmtU(buf + strlen(buf), (uint16_t)s_msgNum);
  centre(buf, 16);
  return LINE_INVERSE;
}

static uint8_t homeLine(uint8_t row, char *buf) {
  switch (row) {
    case 0:
      copyStr(STR_TITLE, s_lang, buf, 17);
#if SIMULATION_MODE
      strcat_P(buf, PSTR("   SIM"));          // simulation toujours signalée
#endif
      centre(buf, 16);
      return LINE_INVERSE;
    case 1:
      if (RTCManager::isValid()) {
        const DateTime &t = RTCManager::now();
        fmtTime(buf, t.hour, t.minute, t.second);
      } else {
        strcpy_P(buf, PSTR("--:--:--"));
      }
      centre(buf, 16);
      return LINE_NORMAL;
    case 2:
      if (RTCManager::isValid()) {
        const DateTime &t = RTCManager::now();
        fmtDate(buf, t.day, t.month, t.year);
      } else {
        copyStr(STR_RTC_NOT_SET, s_lang, buf, 17);
      }
      centre(buf, 16);
      return LINE_NORMAL;
    case 3:
      fmtBig(buf, g_hr.bpm());
      return LINE_BIG;
    case 5: {
      // "SON:ON  ENR 3/10" pendant un enregistrement, sinon "SON:ON  MEM:12"
      char tmp[8];
      copyStr(STR_SOUND, s_lang, buf, 17);
      strcat_P(buf, PSTR(":"));
      copyStr(BuzzerManager::isEnabled() ? STR_ON : STR_OFF, s_lang, tmp, sizeof tmp);
      strcat(buf, tmp);
      char right[11];
      if (Recorder::active()) {
        copyStr(STR_REC_PREFIX, s_lang, right, 4);
        char *q = right + strlen(right);
        *q++ = ' ';
        q = fmtU(q, Recorder::progress());
        *q++ = '/';
        fmtU(q, RECORD_SAMPLES);
      } else {
        strcpy_P(right, PSTR("MEM:"));
        fmtU(right + 4, g_eeprom.count());
      }
      uint8_t l = (uint8_t)strlen(buf);
      const uint8_t r = (uint8_t)strlen(right);
      while (l + r < 16) buf[l++] = ' ';
      buf[l] = 0;
      strncat(buf, right, 16 - l);
      return LINE_NORMAL;
    }
    case 6: {
      StrId id;
      switch (g_hr.hrClass()) {
        case HR_LOW:    id = STR_STATE_LOW; break;
        case HR_NORMAL: id = STR_STATE_NORMAL; break;
        case HR_HIGH:   id = STR_STATE_HIGH; break;
        default:        id = g_signalOk ? STR_SEARCHING : STR_SIGNAL_INVALID; break;
      }
      copyStr(id, s_lang, buf, 17);
      centre(buf, 16);
      return LINE_NORMAL;
    }
    case 7:
      return messageLine(buf);
    default:
      return LINE_NORMAL;                    // ligne vide
  }
}

static uint8_t menuLine(uint8_t row, char *buf) {
  if (row == 0) { copyStr(STR_MENU_TITLE, s_lang, buf, 17); centre(buf, 16); return LINE_INVERSE; }
  if (row >= 1 && row <= MI_COUNT) {
    const uint8_t item = (uint8_t)(row - 1);
    buf[0] = (item == s_cursor) ? '>' : ' ';
    buf[1] = ' ';
    copyStr((StrId)pgm_read_byte(&MENU_LABEL[item]), s_lang, buf + 2, 15);
    if (item == MI_BUZZER) {
      strcat_P(buf, PSTR(" "));
      char tmp[4];
      copyStr(BuzzerManager::isEnabled() ? STR_ON : STR_OFF, s_lang, tmp, sizeof tmp);
      strncat(buf, tmp, 16 - strlen(buf));
    }
    return LINE_NORMAL;
  }
  if (row == 7) {
    if (s_msg != STR_COUNT) return messageLine(buf);
    copyStr(STR_HINT_SELECT, s_lang, buf, 17);
    centre(buf, 16);
  }
  return LINE_NORMAL;
}

static uint8_t historyLine(uint8_t row, char *buf) {
  const uint8_t n = g_eeprom.count();
  if (row == 0) { copyStr(STR_HIST_TITLE, s_lang, buf, 17); centre(buf, 16); return LINE_INVERSE; }
  if (row == 7) { copyStr(STR_HINT_BACK, s_lang, buf, 17); centre(buf, 16); return LINE_NORMAL; }
  if (n == 0) {
    if (row == 3) { copyStr(STR_HIST_EMPTY, s_lang, buf, 17); centre(buf, 16); }
    return LINE_NORMAL;
  }
  if (s_histPos >= n) s_histPos = (uint8_t)(n - 1);
  const uint8_t index = (uint8_t)(n - 1 - s_histPos);        // plus récent d'abord
  if (row == 1) {
    char *q = buf;
    *q++ = '#';
    q = fmtU(q, index + 1u);
    strcpy_P(q, PSTR(" / "));
    fmtU(q + 3, n);
    centre(buf, 16);
    return LINE_NORMAL;
  }
  Record r;
  const bool ok = g_eeprom.read(index, r);                   // relu en EEPROM (CRC vérifié)
  if (!ok) {
    if (row == 3) { copyStr(STR_HIST_CORRUPT, s_lang, buf, 17); centre(buf, 16); }
    return LINE_NORMAL;
  }
  switch (row) {
    case 3: fmtBig(buf, r.bpm); return LINE_BIG;
    case 5: fmtDate(buf, r.day, r.month, (uint16_t)(2000 + r.year)); centre(buf, 16); break;
    case 6: fmtTime(buf, r.hour, r.minute, r.second); centre(buf, 16); break;
    default: break;
  }
  return LINE_NORMAL;
}

static uint8_t eraseLine(uint8_t row, char *buf) {
  switch (row) {
    case 0: copyStr(STR_ERASE_TITLE, s_lang, buf, 17); centre(buf, 16); return LINE_INVERSE;
    case 2: copyStr(STR_ERASE_WARN, s_lang, buf, 17); centre(buf, 16); break;
    case 3: { char *q = fmtU(buf + 1, g_eeprom.count()); buf[0] = '('; q[0] = ')'; q[1] = 0; centre(buf, 16); break; }
    case 5: {
      char no[4], yes[4];
      copyStr(STR_NO, s_lang, no, sizeof no);
      copyStr(STR_YES, s_lang, yes, sizeof yes);
      // "> NON      OUI" : le curseur '>' désigne le choix courant
      memset(buf, ' ', 16);
      buf[16] = 0;
      buf[1] = s_eraseYes ? ' ' : '>';
      memcpy(buf + 3, no, strlen(no));
      buf[9] = s_eraseYes ? '>' : ' ';
      memcpy(buf + 11, yes, strlen(yes));
      break;
    }
    case 7: copyStr(STR_HINT_SELECT, s_lang, buf, 17); centre(buf, 16); break;
    default: break;
  }
  return LINE_NORMAL;
}

uint8_t MenuManager::composeLine(uint8_t row, char *buf) {
  buf[0] = 0;
  switch (s_mode) {
    case UI_MENU:          return menuLine(row, buf);
    case UI_HISTORY:       return historyLine(row, buf);
    case UI_ERASE_CONFIRM: return eraseLine(row, buf);
    default:               return homeLine(row, buf);
  }
}
