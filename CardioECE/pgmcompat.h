/*
 * pgmcompat.h — accès aux constantes en mémoire Flash (PROGMEM).
 * Sur AVR : les tableaux constants restent en Flash (32 Ko) au lieu d'être
 * copiés en SRAM (2 Ko) au démarrage. Sur PC (tests) : macros neutres.
 */
#ifndef PGM_COMPAT_H
#define PGM_COMPAT_H

#if defined(__AVR__)
#include <avr/pgmspace.h>
#else
#include <string.h>
#define PROGMEM
#define PGM_P const char *
#define pgm_read_byte(addr) (*(const uint8_t *)(addr))
#define pgm_read_word(addr) (*(const uint16_t *)(addr))
#define pgm_read_ptr(addr)  (*(const void * const *)(addr))
#define strcpy_P strcpy
#define strncpy_P strncpy
#define strlen_P strlen
#endif

#endif
