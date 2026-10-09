#include "Format.h"

char *fmtU(char *p, uint32_t v, uint8_t width, char pad) {
  char tmp[10];
  uint8_t n = 0;
  do { tmp[n++] = (char)('0' + v % 10); v /= 10; } while (v && n < sizeof tmp);
  while (width > n) { *p++ = pad; width--; }
  while (n) *p++ = tmp[--n];
  *p = 0;
  return p;
}

char *fmtI(char *p, int32_t v) {
  if (v < 0) { *p++ = '-'; return fmtU(p, (uint32_t)(-v)); }
  return fmtU(p, (uint32_t)v);
}

char *fmtS(char *p, const char *s) {
  while (*s) *p++ = *s++;
  *p = 0;
  return p;
}

char *fmtTime(char *p, uint8_t h, uint8_t m, uint8_t s) {
  p = fmtU(p, h, 2, '0'); *p++ = ':';
  p = fmtU(p, m, 2, '0'); *p++ = ':';
  return fmtU(p, s, 2, '0');
}

char *fmtDate(char *p, uint8_t d, uint8_t m, uint16_t y) {
  p = fmtU(p, d, 2, '0'); *p++ = '/';
  p = fmtU(p, m, 2, '0'); *p++ = '/';
  return fmtU(p, y, 4, '0');
}
