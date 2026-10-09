/*
 * Strings — textes de l'interface en français et en anglais (FS6)
 * ---------------------------------------------------------------------------
 * Toutes les chaînes sont dans UNE liste (X-macro) : l'identifiant, le texte
 * FR et le texte EN sont côte à côte, impossible d'oublier une traduction.
 * Elles sont stockées en Flash (PROGMEM) : 0 octet de SRAM consommé ; on ne
 * copie que la chaîne à afficher dans un petit tampon. Pas de classe String,
 * pas d'allocation dynamique.
 * Écran texte : 16 caractères par ligne, ASCII sans accents (police 8x8).
 */
#ifndef CARDIO_STRINGS_H
#define CARDIO_STRINGS_H

#include <stdint.h>
#include <stddef.h>

enum Lang : uint8_t { LANG_FR = 0, LANG_EN = 1, LANG_COUNT = 2 };

//        identifiant           français              anglais
#define CARDIO_STRING_LIST(X) \
  X(STR_TITLE,            "CARDIO ECE",         "CARDIO ECE")          \
  X(STR_STATE_LOW,        "ETAT : FAIBLE",      "STATE : LOW")         \
  X(STR_STATE_NORMAL,     "ETAT : NORMAL",      "STATE : NORMAL")      \
  X(STR_STATE_HIGH,       "ETAT : ELEVE",       "STATE : HIGH")        \
  X(STR_SIGNAL_INVALID,   "SIGNAL INVALIDE",    "INVALID SIGNAL")      \
  X(STR_SEARCHING,        "RECHERCHE POULS",    "SEARCHING PULSE")     \
  X(STR_NO_SIGNAL,        "PAS DE SIGNAL",      "NO SIGNAL")           \
  X(STR_SOUND,            "SON",                "SND")                 \
  X(STR_REC_PREFIX,       "ENR",                "REC")                 \
  X(STR_RTC_NOT_SET,      "HEURE NON REGLEE",   "TIME NOT SET")        \
  X(STR_MSG_SAVED,        "ENREGISTRE #",       "SAVED #")             \
  X(STR_MSG_CANCELLED,    "ENREG. ANNULE",      "REC. CANCELLED")      \
  X(STR_MSG_INVALID,      "MESURE INVALIDE",    "INVALID READING")     \
  X(STR_MSG_FULL,         "MEMOIRE PLEINE",     "MEMORY FULL")         \
  X(STR_MSG_RTC,          "HEURE INVALIDE",     "INVALID TIME")        \
  X(STR_MSG_ERASED,       "HISTO. EFFACE",      "HISTORY ERASED")      \
  X(STR_MSG_TIMEOUT,      "DELAI DEPASSE",      "TIMED OUT")           \
  X(STR_MSG_EEPROM_ERR,   "ERREUR EEPROM",      "EEPROM ERROR")        \
  X(STR_MENU_TITLE,       "MENU PRINCIPAL",     "MAIN MENU")           \
  X(STR_MENU_MEASURE,     "Mesure",             "Measurement")         \
  X(STR_MENU_HISTORY,     "Historique",         "History")             \
  X(STR_MENU_ERASE,       "Effacer donnees",    "Erase data")          \
  X(STR_MENU_LANGUAGE,    "Langue: FR",         "Language: EN")        \
  X(STR_MENU_BUZZER,      "Buzzer:",            "Buzzer:")             \
  X(STR_MENU_BACK,        "Retour",             "Back")                \
  X(STR_ON,               "ON",                 "ON")                  \
  X(STR_OFF,              "OFF",                "OFF")                 \
  X(STR_HIST_TITLE,       "HISTORIQUE",         "HISTORY")             \
  X(STR_HIST_EMPTY,       "Aucune donnee",      "No data")             \
  X(STR_HIST_CORRUPT,     "Donnee corrompue",   "Corrupted record")    \
  X(STR_ERASE_TITLE,      "EFFACER TOUT ?",     "ERASE ALL ?")         \
  X(STR_ERASE_WARN,       "Irreversible",       "Cannot be undone")    \
  X(STR_NO,               "NON",                "NO")                  \
  X(STR_YES,              "OUI",                "YES")                 \
  X(STR_HINT_SELECT,      "Clic: valider",      "Click: select")       \
  X(STR_HINT_BACK,        "Long: retour",       "Hold: back")          \
  X(STR_SIM,              "SIMULATION",         "SIMULATION")

#define CARDIO_STR_ENUM(id, fr, en) id,
enum StrId : uint8_t { CARDIO_STRING_LIST(CARDIO_STR_ENUM) STR_COUNT };
#undef CARDIO_STR_ENUM

// Copie la chaîne (Flash -> RAM) dans buf, tronquée à size-1 caractères.
void   copyStr(StrId id, uint8_t lang, char *buf, size_t size);
size_t strLen(StrId id, uint8_t lang);

#endif
