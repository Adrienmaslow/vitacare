/*
 * Format — mise en forme de nombres sans printf.
 * snprintf() embarque vfprintf (~1,3 Ko de Flash sur AVR) : ces trois
 * fonctions suffisent pour l'affichage et coûtent ~150 octets.
 * Toutes écrivent à partir de p, terminent la chaîne par '\0' et renvoient
 * un pointeur sur ce '\0' (pour enchaîner les appels).
 */
#ifndef CARDIO_FORMAT_H
#define CARDIO_FORMAT_H

#include <stdint.h>

// Entier non signé ; width = largeur minimale, complétée par 'pad'.
char *fmtU(char *p, uint32_t v, uint8_t width = 0, char pad = ' ');
// Entier signé.
char *fmtI(char *p, int32_t v);
// Copie d'une chaîne en RAM.
char *fmtS(char *p, const char *s);
// "hh:mm:ss" ou "jj/mm/aaaa"
char *fmtTime(char *p, uint8_t h, uint8_t m, uint8_t s);
char *fmtDate(char *p, uint8_t d, uint8_t m, uint16_t y);

#endif
