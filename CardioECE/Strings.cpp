#include "Strings.h"
#include "pgmcompat.h"

// Définition de chaque texte en Flash : STR_xxx_fr[] et STR_xxx_en[]
#define CARDIO_STR_DEF(id, fr, en) \
  static const char id##_fr[] PROGMEM = fr; \
  static const char id##_en[] PROGMEM = en;
CARDIO_STRING_LIST(CARDIO_STR_DEF)
#undef CARDIO_STR_DEF

// Table [identifiant][langue] de pointeurs, elle aussi en Flash.
#define CARDIO_STR_ROW(id, fr, en) { id##_fr, id##_en },
static const char *const STR_TABLE[STR_COUNT][LANG_COUNT] PROGMEM = {
  CARDIO_STRING_LIST(CARDIO_STR_ROW)
};
#undef CARDIO_STR_ROW

static PGM_P lookup(StrId id, uint8_t lang) {
  if (id >= STR_COUNT) id = STR_TITLE;
  if (lang >= LANG_COUNT) lang = LANG_FR;
  return (PGM_P)pgm_read_ptr(&STR_TABLE[id][lang]);
}

void copyStr(StrId id, uint8_t lang, char *buf, size_t size) {
  if (size == 0) return;
  strncpy_P(buf, lookup(id, lang), size - 1);
  buf[size - 1] = '\0';
}

size_t strLen(StrId id, uint8_t lang) { return strlen_P(lookup(id, lang)); }
