#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include "DisplayManager.h"
#include "Strings.h"
#include "config.h"
#include "Format.h"

// ----- Objets U8g2 (API C, allocation statique) ---------------------------
// L'API C est utilisée plutôt que les classes C++ U8X8/U8G2 : ces classes
// héritent de Print, dont la table virtuelle force l'édition de liens du
// moteur de polices proportionnelles (~2,5 Ko de Flash) même s'il ne sert
// pas. Ici, les deux écrans utilisent la même police 8x8 (déjà présente).
static u8x8_t s_text;                        // écran 1 : aucun tampon d'image
static u8g2_t s_graph;                       // écran 2 : tampon d'UNE page (128 o)
static const uint8_t *const FONT8 = u8x8_font_chroma48medium8_r;

static bool s_textOk = false;
static bool s_graphOk = false;
static TextLineProvider s_provider = nullptr;

// ----- Écran texte ----------------------------------------------------------
static uint16_t s_rowHash[8];
static uint8_t  s_row = 0;
static uint32_t s_lastTextPass = 0;

// ----- Courbe ---------------------------------------------------------------
// Géométrie (pixels). Pages de 8 lignes : page 0 = en-tête texte,
// pages 1..6 = tracé, page 7 = graduations texte.
static const uint8_t PLOT_X0 = 1;                       // 1re colonne de tracé
static const uint8_t PLOT_TOP = 10, PLOT_BOTTOM = 54;   // 45 lignes utiles
static const uint8_t PLOT_MID = (PLOT_TOP + PLOT_BOTTOM) / 2;
static const uint8_t PLOT_HALF = (PLOT_BOTTOM - PLOT_TOP) / 2;

// Bases de temps : fenêtre (s), libellés et graduation (px par division).
static const uint8_t SCALE_S[GRAPH_SCALE_COUNT] PROGMEM = {2, 5, 10, 20};
static const uint8_t DIV_PX[GRAPH_SCALE_COUNT] PROGMEM = {25, 20, 20, 25}; // 0,5 s / 1 s / 2 s / 5 s
static const char LBL_DIV0[] PROGMEM = ".5s/div";
static const char LBL_DIV1[] PROGMEM = "1s/div";
static const char LBL_DIV2[] PROGMEM = "2s/div";
static const char LBL_DIV3[] PROGMEM = "5s/div";
static const char *const LBL_DIV[GRAPH_SCALE_COUNT] PROGMEM = {LBL_DIV0, LBL_DIV1, LBL_DIV2, LBL_DIV3};

#if (SAMPLE_RATE_HZ * 2) % GRAPH_PLOT_WIDTH != 0
#error "fs x 2 s doit etre multiple de GRAPH_PLOT_WIDTH (echelle exacte)"
#endif

static uint8_t  s_colMin[GRAPH_PLOT_WIDTH];
static uint8_t  s_colMax[GRAPH_PLOT_WIDTH];
static uint8_t  s_colHead = 0;      // prochaine colonne écrite
static uint8_t  s_colCount = 0;
static uint8_t  s_accMin = PLOT_MID, s_accMax = PLOT_MID, s_accN = 0;
static uint8_t  s_lastY = PLOT_MID;
static uint8_t  s_scale = GRAPH_DEFAULT_SCALE;
static uint16_t s_spc = 5;          // échantillons par colonne

// Rendu page par page
static bool     s_inFrame = false;
static uint32_t s_frameStart = 0;
static uint8_t  s_snapHead = 0, s_snapCount = 0;
static uint32_t s_beatMs = 0;
static bool     s_beatSeen = false;

static bool i2cProbe(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void DisplayManager::begin(TextLineProvider provider) {
  s_provider = provider;
  Wire.begin();
  Wire.setWireTimeout(25000, true);   // bus I2C bloqué -> pas de blocage du programme
  s_textOk = i2cProbe(OLED_TEXT_ADDR);
  s_graphOk = i2cProbe(OLED_GRAPH_ADDR);

  if (s_textOk) {
#if OLED_TEXT_SH1106
    u8x8_Setup(&s_text, u8x8_d_sh1106_128x64_noname, u8x8_cad_ssd13xx_fast_i2c,
               u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#else
    u8x8_Setup(&s_text, u8x8_d_ssd1306_128x64_noname, u8x8_cad_ssd13xx_fast_i2c,
               u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#endif
    u8x8_SetI2CAddress(&s_text, OLED_TEXT_ADDR << 1);   // U8g2 attend l'adresse 8 bits
    s_text.bus_clock = I2C_CLOCK_HZ;
    u8x8_InitDisplay(&s_text);
    u8x8_ClearDisplay(&s_text);
    u8x8_SetPowerSave(&s_text, 0);
    u8x8_SetFont(&s_text, FONT8);
  }
  if (s_graphOk) {
#if OLED_GRAPH_SH1106
    u8g2_Setup_sh1106_i2c_128x64_noname_1(&s_graph, U8G2_R0, u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#else
    u8g2_Setup_ssd1306_i2c_128x64_noname_1(&s_graph, U8G2_R0, u8x8_byte_arduino_hw_i2c, u8x8_gpio_and_delay_arduino);
#endif
    u8g2_SetI2CAddress(&s_graph, OLED_GRAPH_ADDR << 1);
    u8g2_GetU8x8(&s_graph)->bus_clock = I2C_CLOCK_HZ;
    u8g2_InitDisplay(&s_graph);
    u8g2_ClearDisplay(&s_graph);
    u8g2_SetPowerSave(&s_graph, 0);
  }
  Wire.setWireTimeout(25000, true);   // réappliqué : l'init U8g2 rappelle Wire.begin()
  invalidateText();
  setScale(GRAPH_DEFAULT_SCALE);
}

bool DisplayManager::textPresent() { return s_textOk; }
bool DisplayManager::graphPresent() { return s_graphOk; }

// =============================== COURBE ====================================
void DisplayManager::setScale(uint8_t idx) {
  if (idx >= GRAPH_SCALE_COUNT) idx = GRAPH_SCALE_COUNT - 1;
  s_scale = idx;
  s_spc = (uint16_t)((uint16_t)pgm_read_byte(&SCALE_S[idx]) * SAMPLE_RATE_HZ / GRAPH_PLOT_WIDTH);
  // Les colonnes existantes représentent une autre durée : on repart d'un
  // écran vide plutôt que d'afficher une échelle fausse.
  s_colHead = 0;
  s_colCount = 0;
  s_accN = 0;
}

uint8_t DisplayManager::scale() { return s_scale; }
uint8_t DisplayManager::scaleSeconds() { return pgm_read_byte(&SCALE_S[s_scale]); }

void DisplayManager::changeScale(int8_t delta) {
  int8_t i = (int8_t)s_scale + delta;
  if (i < 0) i = 0;
  if (i >= GRAPH_SCALE_COUNT) i = GRAPH_SCALE_COUNT - 1;
  if ((uint8_t)i != s_scale) setScale((uint8_t)i);
}

void DisplayManager::notifyBeat(uint32_t nowMs) { s_beatMs = nowMs; s_beatSeen = true; }

void DisplayManager::pushSample(const PPGSample &s) {
  // Normalisation verticale automatique : le signal est recentré sur le
  // milieu des enveloppes haute/basse et mis à l'échelle de leur écart
  // (enveloppes déjà lissées, constante 2,56 s -> pas de "pompage"). Le
  // PPG étant asymétrique (pic systolique fin, diastole large), centrer sur
  // 0 gaspillerait la moitié basse de l'écran. Un plancher évite d'amplifier
  // le bruit en plein écran sans doigt ; au-delà du cadre, la courbe est
  // écrêtée (jamais repliée).
  const int32_t centre = ((int32_t)s.envMax + s.envMin) / 2;
  int32_t half = ((int32_t)s.envMax - s.envMin) / 2;
  const int32_t floorHalf = (int32_t)MIN_AMPLITUDE_ADC << (SIGNAL_SHIFT - 1);
  if (half < floorHalf) half = floorHalf;
  // 90 % de la demi-hauteur : petite marge visuelle en haut et en bas
  int32_t y = (int32_t)PLOT_MID - (((int32_t)s.filtered - centre) * (PLOT_HALF * 9 / 10)) / half;
  if (y < PLOT_TOP) y = PLOT_TOP;
  if (y > PLOT_BOTTOM) y = PLOT_BOTTOM;
  const uint8_t yy = (uint8_t)y;

  if (s_accN == 0) {               // nouvelle colonne : part du dernier point
    s_accMin = s_lastY;            // -> trait continu d'une colonne à l'autre
    s_accMax = s_lastY;
  }
  if (yy < s_accMin) s_accMin = yy;
  if (yy > s_accMax) s_accMax = yy;
  s_lastY = yy;
  if (++s_accN >= s_spc) {
    s_colMin[s_colHead] = s_accMin;
    s_colMax[s_colHead] = s_accMax;
    s_colHead = (uint8_t)((s_colHead + 1) % GRAPH_PLOT_WIDTH);
    if (s_colCount < GRAPH_PLOT_WIDTH) s_colCount++;
    s_accN = 0;
  }
}

// Texte 8x8 sur l'écran graphique : les glyphes de la police U8x8 ont
// exactement le format d'une page SSD1306 (8 octets = 8 colonnes, bit 0 en
// haut). On les COPIE directement dans le tampon de la page en cours :
// aucun moteur de police nécessaire. Le fond du caractère est effacé.
static void pageText(uint8_t page, uint8_t col, const char *str) {
  if (s_graph.tile_curr_row != page) return;   // pas la bande en cours
  uint8_t *buf = s_graph.tile_buf_ptr;
  const uint8_t first = pgm_read_byte(FONT8), last = pgm_read_byte(FONT8 + 1);
  for (; *str && col < 16; str++, col++) {
    uint8_t c = (uint8_t)*str;
    if (c < first || c > last) c = ' ';
    const uint8_t *g = FONT8 + 4 + (uint16_t)(c - first) * 8;
    for (uint8_t i = 0; i < 8; i++) buf[col * 8 + i] = pgm_read_byte(g + i);
  }
}

static void drawGraphPage(const GraphInfo &info, uint32_t nowMs) {
  u8g2_t *g = &s_graph;
  // --- Cadre, ligne médiane pointillée, graduations temporelles ---
  const uint8_t xR = PLOT_X0 + GRAPH_PLOT_WIDTH;         // bord droit = "maintenant"
  u8g2_DrawFrame(g, 0, PLOT_TOP - 1, GRAPH_PLOT_WIDTH + 2, PLOT_BOTTOM - PLOT_TOP + 3);
  for (uint8_t x = PLOT_X0; x < xR; x += 4) u8g2_DrawPixel(g, x, PLOT_MID);
  const uint8_t div = pgm_read_byte(&DIV_PX[s_scale]);
  for (int16_t x = (int16_t)xR - div; x > PLOT_X0; x -= div) {
    for (uint8_t y = PLOT_TOP; y <= PLOT_BOTTOM; y += 3) u8g2_DrawPixel(g, (uint8_t)x, y);
  }

  // --- Courbe : la plus ancienne colonne à gauche, la plus récente à droite
  const uint8_t n = s_snapCount;
  const uint8_t start = (uint8_t)((s_snapHead + GRAPH_PLOT_WIDTH - n) % GRAPH_PLOT_WIDTH);
  uint8_t x = (uint8_t)(xR - n);
  for (uint8_t i = 0; i < n; i++, x++) {
    const uint8_t c = (uint8_t)((start + i) % GRAPH_PLOT_WIDTH);
    u8g2_DrawVLine(g, x, s_colMin[c], (uint8_t)(s_colMax[c] - s_colMin[c] + 1));
  }

  // --- Témoin de battement (carré plein 150 ms) à droite du tracé ---
  if (s_beatSeen && (uint32_t)(nowMs - s_beatMs) < 150) u8g2_DrawBox(g, 109, 26, 14, 14);

  // --- En-tête (page 0) : "PPG [SIM]   76 BPM" ---
  char b[17];
  pageText(0, 0, "PPG");
  if (info.simulation) pageText(0, 4, "SIM");
  if (info.bpm > 0) strcpy_P(fmtU(b, info.bpm, 3), PSTR(" BPM"));
  else strcpy_P(b, PSTR(" -- BPM"));
  pageText(0, 9, b);

  // --- Axe du temps (page 7) : "-5s  1s/div   0" ---
  b[0] = '-';
  strcpy_P(fmtU(b + 1, pgm_read_byte(&SCALE_S[s_scale])), PSTR("s"));
  pageText(7, 0, b);
  strcpy_P(b, (const char *)pgm_read_ptr(&LBL_DIV[s_scale]));
  pageText(7, 5, b);
  pageText(7, 12, "0");                                  // x = 96..103 : "maintenant"

  // --- Signal absent : message (fond effacé) au milieu de l'écran ---
  if (!info.signalOk) {
    copyStr(STR_NO_SIGNAL, info.lang, b, sizeof b);
    pageText(4, (uint8_t)((16 - strlen(b)) / 2), b);
  }
}

static void updateGraph(uint32_t nowMs, const GraphInfo &info) {
  if (!s_graphOk) return;
  if (!s_inFrame) {
    if ((uint32_t)(nowMs - s_frameStart) < GRAPH_REFRESH_MS) return;
    s_frameStart = nowMs;
    s_snapHead = s_colHead;        // image cohérente : même jeu de colonnes
    s_snapCount = s_colCount;      // pour les 8 bandes
    u8g2_FirstPage(&s_graph);
    s_inFrame = true;
  }
  drawGraphPage(info, nowMs);      // U8g2 ne garde que la bande courante
  if (!u8g2_NextPage(&s_graph)) s_inFrame = false;   // envoie la bande (128 o)
}

// =============================== TEXTE =====================================
void DisplayManager::invalidateText() {
  for (uint8_t i = 0; i < 8; i++) s_rowHash[i] = 0;
  s_row = 0;
}

static uint16_t fnv16(const char *s, uint8_t flags) {
  uint32_t h = 2166136261UL;
  h = (h ^ flags) * 16777619UL;
  while (*s) h = (h ^ (uint8_t)*s++) * 16777619UL;
  uint16_t r = (uint16_t)(h ^ (h >> 16));
  return r == 0 ? 1 : r;           // 0 est réservé à "ligne à redessiner"
}

static void updateText(uint32_t nowMs) {
  if (!s_textOk || !s_provider) return;
  if (s_row == 0) {
    if ((uint32_t)(nowMs - s_lastTextPass) < TEXT_REFRESH_MS) return;
    s_lastTextPass = nowMs;
  }
  uint8_t drawn = 0;
  while (s_row < 8 && drawn < 2) {          // au plus 2 lignes par passage
    char buf[17];
    buf[0] = 0;
    const uint8_t flags = s_provider(s_row, buf);
    const uint8_t width = (flags & LINE_BIG) ? 8 : 16;
    uint8_t len = (uint8_t)strlen(buf);
    if (len > width) len = width;
    while (len < width) buf[len++] = ' ';   // complète : efface l'ancien texte
    buf[width] = 0;
    const uint16_t h = fnv16(buf, flags);
    if (h != s_rowHash[s_row]) {
      u8x8_SetInverseFont(&s_text, (flags & LINE_INVERSE) ? 1 : 0);
      if (flags & LINE_BIG) {
        u8x8_Draw2x2String(&s_text, 0, s_row, buf);
        if (s_row < 7) s_rowHash[s_row + 1] = 0;   // ligne recouverte
      } else {
        u8x8_DrawString(&s_text, 0, s_row, buf);
      }
      s_rowHash[s_row] = h;
      drawn++;
    }
    s_row = (uint8_t)(s_row + ((flags & LINE_BIG) ? 2 : 1));
  }
  if (s_row >= 8) s_row = 0;
}

void DisplayManager::update(uint32_t nowMs, const GraphInfo &info) {
  // Alternance : soit des lignes de texte, soit une bande de courbe ; jamais
  // les deux dans le même passage, pour borner la durée d'un tour de loop().
  static bool turn = false;
  turn = !turn;
  if (turn) updateText(nowMs);
  else updateGraph(nowMs, info);
}
