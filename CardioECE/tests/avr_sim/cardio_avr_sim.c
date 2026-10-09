/*
 * cardio_avr_sim.c — banc d'ÉMULATION du firmware CARDIO ECE complet
 * ---------------------------------------------------------------------------
 * Exécute le VRAI binaire AVR (CardioECE.elf) dans l'émulateur simavr
 * (ATmega328P à 16 MHz, cycle par cycle) et l'entoure de périphériques
 * virtuels écrits ici :
 *   - entrée analogique A0 : onde PPG synthétique (modèle INDÉPENDANT de
 *     PPGSimulator du firmware), fréquence programmable dans le scénario ;
 *   - DS1302 sur A1/A2/A3 : modèle bit à bit du protocole 3 fils ;
 *   - deux "écrans" I2C 0x3C/0x3D : acquittent les trames et reconstituent
 *     la mémoire d'image SSD1306 -> captures ASCII des deux OLED ;
 *   - boutons D4, D7 et encodeur D8/D9 ;
 *   - surveillance des LED D10/D11/D12 (exclusivité) et du buzzer D5
 *     (nombre de bips, fréquence mesurée).
 *
 * >>> CE N'EST PAS UN TEST MATÉRIEL. Il valide l'intégration logicielle
 * >>> (timers, interruptions, ADC, I2C, EEPROM, console) sur le jeu
 * >>> d'instructions réel, mais pas le capteur, l'optique ni l'électronique.
 *
 * Usage : ./cardio_avr_sim CardioECE.elf [dossier_sortie]
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <simavr/sim_avr.h>
#include <simavr/sim_elf.h>
#include <simavr/avr_ioport.h>
#include <simavr/avr_adc.h>
#include <simavr/avr_uart.h>
#include <simavr/avr_twi.h>
#include <simavr/avr_eeprom.h>

#define F_CPU 16000000.0
static avr_t *avr;
static double now_s(void) { return (double)avr->cycle / F_CPU; }

/* ------------------------------------------------------------------------ */
/* Résultats et vérifications                                              */
/* ------------------------------------------------------------------------ */
static int g_pass = 0, g_fail = 0;
#define CHECK(c, ...) do { if (c) { g_pass++; printf("  OK    "); } else { g_fail++; printf("  ECHEC "); } \
                           printf(__VA_ARGS__); printf("\n"); } while (0)

/* ------------------------------------------------------------------------ */
/* UART : capture de la sortie série                                        */
/* ------------------------------------------------------------------------ */
static char uart_log[1 << 20];
static size_t uart_len = 0;
static char uart_line[512];
static size_t uart_line_len = 0;

static void uart_out_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq; (void)param;
  if (uart_len < sizeof uart_log - 1) { uart_log[uart_len++] = (char)value; uart_log[uart_len] = 0; }
  if (value == '\n' || uart_line_len >= sizeof uart_line - 2) {
    uart_line[uart_line_len] = 0;
    printf("  [t=%6.2fs] UART> %s\n", now_s(), uart_line);
    uart_line_len = 0;
  } else if (value != '\r') {
    uart_line[uart_line_len++] = (char)value;
  }
}

static avr_irq_t *uart_in;
static const char *pending_tx = NULL;
static void uart_send(const char *s) { pending_tx = s; }
static double next_tx_s = 0;
static void uart_pump(void) {
  // 1 caractère toutes les 100 µs (≈ 115200 bauds)
  if (pending_tx && *pending_tx && now_s() >= next_tx_s) {
    avr_raise_irq(uart_in, (uint8_t)*pending_tx++);
    next_tx_s = now_s() + 0.0001;
    if (!*pending_tx) pending_tx = NULL;
  }
}

/* ------------------------------------------------------------------------ */
/* Signal PPG analogique sur A0 (modèle indépendant du firmware)            */
/* ------------------------------------------------------------------------ */
static double ppg_bpm = 72.0, ppg_phase = 0.0, ppg_last_t = 0.0;
static int ppg_finger = 1;
static double ppg_amp_mv = 600.0, ppg_noise_mv = 5.0;

static double ppg_shape(double x) {  // une période, x dans [0,1)
  return exp(-pow((x - 0.15) / 0.06, 2)) + 0.4 * exp(-pow((x - 0.42) / 0.09, 2));
}

static void adc_trigger_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq; (void)value; (void)param;
  const double t = now_s();
  ppg_phase += (t - ppg_last_t) * ppg_bpm / 60.0;   // phase continue même si le BPM change
  ppg_phase -= floor(ppg_phase);
  ppg_last_t = t;
  double mv = 2500.0 + 150.0 * sin(2 * M_PI * t / 23.0);            // dérive lente (lumière)
  if (ppg_finger) mv += ppg_amp_mv * (ppg_shape(ppg_phase) - 0.3);
  mv += ppg_noise_mv * ((double)rand() / RAND_MAX * 2.0 - 1.0);
  if (mv < 0) mv = 0;
  if (mv > 5000) mv = 5000;
  avr_raise_irq(avr_io_getirq(avr, AVR_IOCTL_ADC_GETIRQ, ADC_IRQ_ADC0), (uint32_t)mv);
}

/* ------------------------------------------------------------------------ */
/* DS1302 : modèle bit à bit (CE = PC3, SCLK = PC1, I/O = PC2)              */
/* ------------------------------------------------------------------------ */
static struct {
  int ce, sclk, phase;           // phase : 0 commande, 1 écriture, 2 lecture
  uint8_t cmd, cur, bit, idx;
  uint8_t reg[8];                // registres horloge (BCD), reg[7] = contrôle
  double  set_time;              // instant de réglage (temps émulé)
  int     transactions;
} ds;
static avr_irq_t *ds_io_irq;

static uint8_t bcd(int v) { return (uint8_t)(((v / 10) << 4) | (v % 10)); }
static int unbcd(uint8_t v) { return (v >> 4) * 10 + (v & 15); }

static uint8_t ds_read_reg(int r) {
  if (r == 7) return ds.reg[7];
  if (ds.reg[0] & 0x80) return ds.reg[r];        // CH = 1 : horloge arrêtée
  // horloge en marche : heure réglée + temps écoulé (secondes, minutes, heures)
  int s = unbcd(ds.reg[0] & 0x7F), m = unbcd(ds.reg[1]), h = unbcd(ds.reg[2] & 0x3F);
  long tot = s + 60L * m + 3600L * h + (long)(now_s() - ds.set_time);
  switch (r) {
    case 0: return bcd((int)(tot % 60));
    case 1: return bcd((int)(tot / 60 % 60));
    case 2: return bcd((int)(tot / 3600 % 24));
    default: return ds.reg[r];
  }
}

static int mcu_io_level(void) {   // niveau imposé par le MCU sur PC2 (PORTC bit 2)
  return (avr->data[0x28] >> 2) & 1;
}

static void ds_write(uint8_t cmd, int idx, uint8_t v) {
  int r = (cmd == 0xBE) ? idx : ((cmd >> 1) & 0x1F);
  if (cmd == 0x90 || r > 7) return;                // chargeur : ignoré
  if (r != 7 && (ds.reg[7] & 0x80)) return;        // WP actif
  if (r == 0 && !(v & 0x80)) {                     // démarrage de l'horloge
    ds.reg[0] = v;
    ds.set_time = now_s();
    return;
  }
  ds.reg[r] = v;
}

static void ds_pin_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq;
  const int pin = (int)(intptr_t)param;
  if (pin == 3) {                                   // CE
    ds.ce = (int)value;
    if (ds.ce) { ds.phase = 0; ds.cmd = 0; ds.bit = 0; ds.idx = 0; ds.transactions++; }
    return;
  }
  if (pin != 1 || !ds.ce) return;                   // SCLK uniquement
  const int rising = value && !ds.sclk;
  const int falling = !value && ds.sclk;
  ds.sclk = (int)value;
  if (rising) {
    if (ds.phase == 0) {
      ds.cmd |= (uint8_t)(mcu_io_level() << ds.bit);
      if (++ds.bit == 8) {
        ds.bit = 0;
        ds.phase = (ds.cmd & 1) ? 2 : 1;
        ds.idx = 0;
        if (ds.phase == 2) {
          int r = (ds.cmd == 0xBF) ? 0 : ((ds.cmd >> 1) & 0x1F);
          ds.cur = ds_read_reg(r);
        } else {
          ds.cur = 0;
        }
        ds.bit = 0xFF;                              // lecture : 1er bit au front descendant
        if (ds.phase == 1) ds.bit = 0;
      }
    } else if (ds.phase == 1) {
      ds.cur |= (uint8_t)(mcu_io_level() << ds.bit);
      if (++ds.bit == 8) {
        ds_write((uint8_t)(ds.cmd & 0xFE), ds.idx++, ds.cur);
        ds.cur = 0;
        ds.bit = 0;
      }
    }
  } else if (falling && ds.phase == 2) {
    if (ds.bit == 0xFF) ds.bit = 0;
    else if (++ds.bit == 8) {
      ds.bit = 0;
      ds.idx++;
      ds.cur = ds_read_reg(ds.cmd == 0xBF ? ds.idx : ((ds.cmd >> 1) & 0x1F));
    }
    avr_raise_irq(ds_io_irq, (ds.cur >> ds.bit) & 1);
  }
}

/* ------------------------------------------------------------------------ */
/* Écrans I2C 0x3C et 0x3D : acquittement + reconstitution de l'image       */
/* ------------------------------------------------------------------------ */
typedef struct {
  uint8_t addr7;
  uint8_t vram[8][128];
  int page, col, selected, first, data_mode, args_left;
  long bytes;
} oled_t;
static oled_t oled[2] = {{0x3C}, {0x3D}};
static avr_irq_t *twi_in;

static int cmd_args(uint8_t c) {
  switch (c) {
    case 0x81: case 0x8D: case 0xA8: case 0xD3: case 0xD5: case 0xD9:
    case 0xDA: case 0xDB: case 0x20: return 1;
    case 0x21: case 0x22: case 0xA3: return 2;
    default: return 0;
  }
}

static void oled_byte(oled_t *o, uint8_t b) {
  o->bytes++;
  if (o->first) { o->first = 0; o->data_mode = (b & 0x40) != 0; return; }  // octet de contrôle
  if (o->data_mode) {
    if (o->page < 8 && o->col < 128) o->vram[o->page][o->col] = b;
    o->col = (o->col + 1) & 127;
    return;
  }
  if (o->args_left) { o->args_left--; return; }
  if (b >= 0xB0 && b <= 0xB7) o->page = b - 0xB0;
  else if (b <= 0x0F) o->col = (o->col & 0xF0) | b;
  else if (b >= 0x10 && b <= 0x1F) o->col = (o->col & 0x0F) | ((b & 0x0F) << 4);
  else o->args_left = cmd_args(b);
}

static void twi_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq; (void)param;
  avr_twi_msg_irq_t v;
  v.u.v = value;
  if (v.u.twi.msg & TWI_COND_STOP) { oled[0].selected = oled[1].selected = 0; }
  if (v.u.twi.msg & TWI_COND_START) {
    for (int i = 0; i < 2; i++) {
      oled[i].selected = 0;
      if ((v.u.twi.addr >> 1) == oled[i].addr7 && !(v.u.twi.addr & 1)) {
        oled[i].selected = 1;
        oled[i].first = 1;
        avr_raise_irq(twi_in, avr_twi_irq_msg(TWI_COND_ACK, v.u.twi.addr, 1));
      }
    }
  }
  for (int i = 0; i < 2; i++) {
    if (oled[i].selected && (v.u.twi.msg & TWI_COND_WRITE)) {
      avr_raise_irq(twi_in, avr_twi_irq_msg(TWI_COND_ACK, v.u.twi.addr, 1));
      oled_byte(&oled[i], v.u.twi.data);
    }
  }
}

static void oled_dump(FILE *f, const char *title) {
  fprintf(f, "\n===== %s  (t = %.1f s, EMULATION) =====\n", title, now_s());
  for (int i = 0; i < 2; i++) {
    fprintf(f, "OLED 0x%02X %s\n+", oled[i].addr7, i == 0 ? "(texte)" : "(courbe)");
    for (int x = 0; x < 128; x++) fputc('-', f);
    fprintf(f, "+\n");
    for (int y = 0; y < 64; y += 2) {
      fputc('|', f);
      for (int x = 0; x < 128; x++) {
        int a = (oled[i].vram[y / 8][x] >> (y % 8)) & 1;
        int b = (oled[i].vram[(y + 1) / 8][x] >> ((y + 1) % 8)) & 1;
        fputs(a && b ? "\xE2\x96\x88" : a ? "\xE2\x96\x80" : b ? "\xE2\x96\x84" : " ", f);
      }
      fprintf(f, "|\n");
    }
    fputc('+', f);
    for (int x = 0; x < 128; x++) fputc('-', f);
    fprintf(f, "+\n");
  }
}

/* ------------------------------------------------------------------------ */
/* LED (exclusivité) et buzzer (bips, fréquence)                            */
/* ------------------------------------------------------------------------ */
static int led[3];                 // 0 rouge D10/PB2, 1 jaune D11/PB3, 2 vert D12/PB4
static long led_overlap = 0, led_changes = 0;
static double led_on_time[3];
static double led_since = 0;

static void led_account(void) {
  const double t = now_s();
  for (int i = 0; i < 3; i++) if (led[i]) led_on_time[i] += t - led_since;
  led_since = t;
}

static void led_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq;
  led_account();
  const int i = (int)(intptr_t)param;
  led[i] = (int)value;
  led_changes++;
  if (led[0] + led[1] + led[2] > 1) led_overlap++;
}

static double buz_last = -1, buz_burst_start = -1;
static long buz_toggles = 0, buz_beeps = 0, buz_burst_toggles = 0;
static double buz_freq_sum[3]; static long buz_freq_n[3];   // par plage
static double buz_beep_times[4096]; static int buz_beep_n = 0;

static void buz_close_burst(void) {
  if (buz_burst_toggles >= 4) {
    const double dur = buz_last - buz_burst_start;
    const double f = (buz_burst_toggles - 1) / 2.0 / dur;
    const int k = f < 650 ? 0 : (f < 1300 ? 1 : 2);
    buz_freq_sum[k] += f; buz_freq_n[k]++;
    buz_beeps++;
    if (buz_beep_n < 4096) buz_beep_times[buz_beep_n++] = buz_burst_start;
  }
  buz_burst_toggles = 0;
}

static void buz_hook(struct avr_irq_t *irq, uint32_t value, void *param) {
  (void)irq; (void)value; (void)param;
  const double t = now_s();
  if (buz_last < 0 || t - buz_last > 0.02) { buz_close_burst(); buz_burst_start = t; }
  buz_burst_toggles++;
  buz_toggles++;
  buz_last = t;
}

/* ------------------------------------------------------------------------ */
/* Entrées : boutons et encodeur (niveau bas = appui)                       */
/* ------------------------------------------------------------------------ */
static void pin_set(char port, int pin, int level) {
  avr_raise_irq(avr_io_getirq(avr, AVR_IOCTL_IOPORT_GETIRQ(port), pin), level);
}

/* ------------------------------------------------------------------------ */
/* Moteur de scénario                                                       */
/* ------------------------------------------------------------------------ */
static void run_until(double t_end) {
  while (now_s() < t_end) {
    int st = avr_run(avr);
    if (st == cpu_Done || st == cpu_Crashed) { printf("CPU arrêté (état %d)\n", st); exit(2); }
    uart_pump();
  }
}

static double last_status_bpm(void) {   // dernier "bpm_x10=" de la sortie série
  const char *p = NULL, *q = uart_log;
  uart_log[uart_len] = 0;
  while ((q = strstr(q, "bpm_x10=")) != NULL) { p = q; q++; }
  return p ? atof(p + 8) / 10.0 : -1;
}
static long last_status_value(const char *key) {
  const char *p = NULL, *q = uart_log;
  uart_log[uart_len] = 0;
  while ((q = strstr(q, key)) != NULL) { p = q; q++; }
  return p ? atol(p + strlen(key)) : -999;
}

static void encoder_cw(void) {   // un cran horaire : AB 11 -> 01 -> 00 -> 10 -> 11
  static const int seq[4][2] = {{0, 1}, {0, 0}, {1, 0}, {1, 1}};
  for (int k = 0; k < 4; k++) {
    pin_set('B', 1, seq[k][0]);  // A = D9 = PB1
    pin_set('B', 0, seq[k][1]);  // B = D8 = PB0
    run_until(now_s() + 0.003);
  }
}

static void press(char port, int pin, double dur) {
  pin_set(port, pin, 0);
  run_until(now_s() + dur);
  pin_set(port, pin, 1);
}

static avr_t *boot(const char *elf, uint8_t *eeprom_image) {
  elf_firmware_t fw;
  memset(&fw, 0, sizeof fw);
  if (elf_read_firmware(elf, &fw) != 0) { fprintf(stderr, "ELF illisible\n"); exit(2); }
  avr_t *a = avr_make_mcu_by_name("atmega328p");
  avr_init(a);
  avr_load_firmware(a, &fw);
  a->frequency = 16000000;
  a->vcc = a->avcc = a->aref = 5000;
  a->log = LOG_ERROR;
  avr = a;
  if (eeprom_image) {
    avr_eeprom_desc_t d = { .ee = eeprom_image, .offset = 0, .size = 1024 };
    avr_ioctl(a, AVR_IOCTL_EEPROM_SET, &d);
  }
  uint32_t f = 0;
  avr_ioctl(a, AVR_IOCTL_UART_GET_FLAGS('0'), &f);
  f &= ~AVR_UART_FLAG_STDIO;
  avr_ioctl(a, AVR_IOCTL_UART_SET_FLAGS('0'), &f);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_UART_GETIRQ('0'), UART_IRQ_OUTPUT), uart_out_hook, NULL);
  uart_in = avr_io_getirq(a, AVR_IOCTL_UART_GETIRQ('0'), UART_IRQ_INPUT);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_ADC_GETIRQ, ADC_IRQ_OUT_TRIGGER), adc_trigger_hook, NULL);
  // DS1302
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('C'), 1), ds_pin_hook, (void *)1);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('C'), 3), ds_pin_hook, (void *)3);
  ds_io_irq = avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('C'), 2);
  // I2C
  twi_in = avr_io_getirq(a, AVR_IOCTL_TWI_GETIRQ(0), TWI_IRQ_INPUT);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_TWI_GETIRQ(0), TWI_IRQ_OUTPUT), twi_hook, NULL);
  // LED + buzzer
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('B'), 2), led_hook, (void *)0);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('B'), 3), led_hook, (void *)1);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('B'), 4), led_hook, (void *)2);
  avr_irq_register_notify(avr_io_getirq(a, AVR_IOCTL_IOPORT_GETIRQ('D'), 5), buz_hook, NULL);
  // Boutons relâchés (niveau haut) et encodeur au repos (A = B = 1)
  pin_set('D', 4, 1); pin_set('D', 6, 1); pin_set('D', 7, 1);
  pin_set('B', 0, 1); pin_set('B', 1, 1);
  memset(oled[0].vram, 0, sizeof oled[0].vram);
  memset(oled[1].vram, 0, sizeof oled[1].vram);
  ppg_last_t = 0;
  next_tx_s = 0;
  led_since = 0;
  return a;
}

/* Scénario court pour le binaire compilé avec SIMULATION_MODE=1 : la source
 * du signal est alors le générateur interne du firmware (l'ADC est ignoré). */
static int run_sim_build(const char *elf) {
  printf("=== Binaire SIMULATION_MODE=1 ===\n");
  memset(&ds, 0, sizeof ds);
  ds.reg[0] = 0x80; ds.reg[7] = 0x80;
  boot(elf, NULL);
  run_until(1.0);
  CHECK(strstr(uart_log, "SIMULATION") != NULL, "bannière série « SIMULATION »");
  run_until(15.0);
  uart_send("STATUS\n");
  run_until(15.5);
  CHECK(fabs(last_status_bpm() - 75) <= 1, "BPM du générateur interne (75) : %.1f", last_status_bpm());
  printf("  RAM libre : %ld o, marge de pile minimale : %ld o\n",
         last_status_value("ram_libre="), last_status_value("pile_marge_min="));
  CHECK(last_status_value("pile_marge_min=") > 100, "marge de pile > 100 octets (build simulation)");
  uart_send("SIM BPM 110\n");
  run_until(30.0);
  uart_send("STATUS\n");
  run_until(30.5);
  CHECK(fabs(last_status_bpm() - 110) <= 1.5, "commande SIM BPM 110 : %.1f", last_status_bpm());
  uart_send("SIM FINGER 0\n");
  run_until(36.0);
  uart_send("STATUS\n");
  run_until(36.5);
  CHECK(last_status_value("bpm_x10=") == 0, "SIM FINGER 0 -> mesure invalide");
  CHECK(led[0] + led[1] + led[2] == 0, "aucune LED");
  printf("RÉSULTAT ÉMULATION (build simulation) : %d OK, %d ÉCHEC(S)\n", g_pass, g_fail);
  return g_fail ? 1 : 0;
}

int main(int argc, char **argv) {
  if (argc < 2) { fprintf(stderr, "usage: %s CardioECE.elf [sortie|--sim]\n", argv[0]); return 2; }
  if (argc > 2 && strcmp(argv[2], "--sim") == 0) return run_sim_build(argv[1]);
  const char *outdir = argc > 2 ? argv[2] : "resultats";
  char path[512];
  snprintf(path, sizeof path, "%s/oled_captures_emulation.txt", outdir);
  FILE *shots = fopen(path, "w");
  srand(1234);
  memset(&ds, 0, sizeof ds);
  ds.reg[0] = 0x80;                   // DS1302 neuf : CH = 1 (jamais réglé)
  ds.reg[3] = 0x01; ds.reg[4] = 0x01; ds.reg[5] = 0x01; ds.reg[6] = 0x00; ds.reg[7] = 0x80;

  printf("=== SESSION 1 : premier démarrage (EEPROM vierge, RTC non réglée) ===\n");
  boot(argv[1], NULL);
  ppg_bpm = 72;
  run_until(1.5);
  CHECK(strstr(uart_log, "RTC non reglee") != NULL, "RTC neuve détectée comme non réglée (pas de réglage automatique)");
  uart_send("SET 2026-10-09 14:30:00\n");
  run_until(2.5);
  uart_send("GET\n");
  run_until(3.0);
  CHECK(strstr(uart_log, "RTC OK 09/10/2026 14:30:00") != NULL, "réglage RTC par la commande SET (protocole 3 fils)");
  run_until(20.0);
  uart_send("STATUS\n");
  run_until(20.5);
  double b = last_status_bpm();
  CHECK(fabs(b - 72) <= 1.5, "BPM calculé par le firmware émulé à 72 BPM : %.1f", b);
  CHECK(last_status_value("perdus=") == 0, "aucun échantillon perdu (FIFO) : %ld", last_status_value("perdus="));
  printf("  remplissage max de la FIFO : %ld échantillon(s) sur 16 (retard max de loop() ≈ %ld ms)\n",
         last_status_value("fifo_max="), last_status_value("fifo_max=") * 10);
  CHECK(last_status_value("oled1=") == 1 && last_status_value("oled2=") == 1, "deux écrans I2C détectés (0x3C, 0x3D)");
  printf("  marge de pile minimale observée : %ld octets, RAM libre : %ld octets\n",
         last_status_value("pile_marge_min="), last_status_value("ram_libre="));
  CHECK(last_status_value("pile_marge_min=") > 100, "marge de pile > 100 octets");
  CHECK(led[2] == 1 && led[0] == 0 && led[1] == 0, "72 BPM -> LED verte seule");
  oled_dump(shots, "Accueil, 72 BPM");

  printf("--- enregistrement (bouton D4) ---\n");
  press('D', 4, 0.12);
  run_until(36.0);
  CHECK(strstr(uart_log, "Enregistrement #1 : 7") != NULL, "enregistrement #1 créé après 10 mesures");

  printf("--- rythme rapide progressif 72 -> 115 BPM ---\n");
  for (int k = 0; k <= 50; k++) { ppg_bpm = 72 + 43.0 * k / 50; run_until(now_s() + 0.1); }
  run_until(52.0);
  uart_send("STATUS\n");
  run_until(52.5);
  b = last_status_bpm();
  CHECK(fabs(b - 115) <= 2, "BPM à 115 BPM : %.1f", b);
  CHECK(led[0] == 1 && led[1] == 0 && led[2] == 0, "115 BPM -> LED rouge seule");

  printf("--- rythme lent 50 BPM ---\n");
  ppg_bpm = 50;
  run_until(68.0);
  uart_send("STATUS\n");
  run_until(68.5);
  b = last_status_bpm();
  CHECK(fabs(b - 50) <= 1.5, "BPM à 50 BPM : %.1f", b);
  CHECK(led[1] == 1 && led[0] == 0 && led[2] == 0, "50 BPM -> LED jaune seule");

  printf("--- retrait du doigt ---\n");
  const long beeps_before = buz_beeps;
  ppg_finger = 0;
  run_until(76.0);
  uart_send("STATUS\n");
  run_until(76.5);
  CHECK(last_status_value("bpm_x10=") == 0, "mesure invalidée sans doigt");
  CHECK(led[0] + led[1] + led[2] == 0, "aucune LED sans mesure valide");
  // le dernier bip possible est celui d'un battement d'avant le retrait (≤ 3 s)
  long late = 0;
  for (int i = 0; i < buz_beep_n; i++) if (buz_beep_times[i] > 72.5 && buz_beep_times[i] < 76.0) late++;
  CHECK(late == 0, "aucun bip après invalidation (%ld)", late);
  (void)beeps_before;
  press('D', 4, 0.12);              // tentative d'enregistrement invalide
  run_until(77.5);
  oled_dump(shots, "Doigt retire : -- BPM / SIGNAL INVALIDE + message");

  printf("--- encodeur : base de temps puis menu ---\n");
  ppg_finger = 1; ppg_bpm = 72;
  run_until(86.0);
  encoder_cw();
  run_until(88.5);
  oled_dump(shots, "Encodeur +1 cran : base de temps 10 s");
  press('D', 7, 0.1);               // clic : menu
  run_until(89.5);
  oled_dump(shots, "Menu principal");
  encoder_cw();                     // -> Historique
  run_until(89.8);
  press('D', 7, 0.1);
  run_until(90.8);
  oled_dump(shots, "Historique");
  press('D', 7, 0.9);               // appui long : accueil
  run_until(92.0);
  uart_send("DUMP\n");
  run_until(93.0);
  CHECK(strstr(uart_log, "1,7") != NULL && strstr(uart_log, "09/10/2026,14:3") != NULL,
        "DUMP : enregistrement horodaté");
  buz_close_burst();
  led_account();
  printf("  bips : %ld au total ; fréquences mesurées : grave %.0f Hz (%ld), moyen %.0f Hz (%ld), aigu %.0f Hz (%ld)\n",
         buz_beeps, buz_freq_n[0] ? buz_freq_sum[0] / buz_freq_n[0] : 0, buz_freq_n[0],
         buz_freq_n[1] ? buz_freq_sum[1] / buz_freq_n[1] : 0, buz_freq_n[1],
         buz_freq_n[2] ? buz_freq_sum[2] / buz_freq_n[2] : 0, buz_freq_n[2]);
  CHECK(buz_freq_n[0] > 0 && fabs(buz_freq_sum[0] / buz_freq_n[0] - 440) < 15, "tonalité grave ≈ 440 Hz");
  CHECK(buz_freq_n[1] > 0 && fabs(buz_freq_sum[1] / buz_freq_n[1] - 880) < 30, "tonalité moyenne ≈ 880 Hz");
  CHECK(buz_freq_n[2] > 0 && fabs(buz_freq_sum[2] / buz_freq_n[2] - 1760) < 80, "tonalité aiguë ≈ 1760 Hz");
  CHECK(led_overlap == 0, "jamais deux LED allumées ensemble (%ld changements d'état)", led_changes);
  printf("  écran texte : %ld octets I2C, écran courbe : %ld octets I2C\n", oled[0].bytes, oled[1].bytes);

  // Image EEPROM conservée pour la "remise sous tension"
  uint8_t ee[1024];
  avr_eeprom_desc_t d = { .ee = NULL, .offset = 0, .size = 1024 };
  avr_ioctl(avr, AVR_IOCTL_EEPROM_GET, &d);
  memcpy(ee, d.ee, 1024);
  const double t_session1 = now_s();

  printf("\n=== SESSION 2 : coupure puis remise sous tension (EEPROM et RTC sur pile conservées) ===\n");
  uart_len = 0;
  uart_log[0] = 0;
  ds.set_time -= t_session1;          // l'horloge DS1302 a continué de tourner
  boot(argv[1], ee);
  run_until(1.5);
  CHECK(strstr(uart_log, "Enreg. 1") != NULL, "historique conservé après redémarrage");
  CHECK(strstr(uart_log, "RTC non reglee") == NULL, "heure conservée (non réinitialisée au démarrage)");
  uart_send("GET\n");
  run_until(2.0);
  uart_send("DUMP\n");
  run_until(3.0);
  CHECK(strstr(uart_log, "1,7") != NULL, "enregistrement relu après redémarrage");

  fclose(shots);
  printf("\nCaptures d'écran émulées : %s\n", path);
  printf("RÉSULTAT ÉMULATION : %d OK, %d ÉCHEC(S)\n", g_pass, g_fail);
  return g_fail ? 1 : 0;
}
