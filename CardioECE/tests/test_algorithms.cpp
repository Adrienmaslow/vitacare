/*
 * Tests PC du cœur algorithmique de CARDIO ECE (sans Arduino).
 * ---------------------------------------------------------------------------
 * Compile les MÊMES fichiers que le firmware (PPGProcessor, HeartRate,
 * PPGSimulator, EEPROMManager avec EEPROM simulée, Strings) avec les MÊMES
 * constantes (config.h).
 *
 *   cd CardioECE/tests && make && ./test_algorithms
 *
 * Les résultats FS1 sont écrits dans results_simulation.csv.
 * >>> CE SONT DES RÉSULTATS DE SIMULATION, PAS DES MESURES SUR LE WPSE340. <<<
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <string>

#include "../config.h"
#include "../PPGProcessor.h"
#include "../HeartRate.h"
#include "../PPGSimulator.h"
#include "../EEPROMManager.h"
#include "../Strings.h"
#include "../Format.h"

static int g_fail = 0, g_pass = 0;
static FILE *g_csv = nullptr;

#define CHECK(cond, ...) do { if (cond) { g_pass++; } else { g_fail++; \
  std::printf("  ECHEC  %s:%d : ", __FILE__, __LINE__); std::printf(__VA_ARGS__); std::printf("\n"); } } while (0)

// ---------------------------------------------------------------------------
// Banc de simulation : simulateur -> PPGProcessor -> HeartRate
// ---------------------------------------------------------------------------
struct Bench {
  PPGSimulator sim;
  PPGProcessor proc;
  HeartRate hr;
  uint32_t t = 0;              // ms
  uint32_t accepted = 0, rejected = 0, detections = 0;
  uint32_t validSamples = 0, samples = 0;
  uint32_t beepsWhileInvalid = 0;
  std::vector<double> bpmLog;  // BPM affiché (valide) échantillonné toutes les 100 ms

  explicit Bench(uint32_t startMs = 0) : t(startMs) {}

  void run(double seconds, bool log = true) {
    const uint32_t n = (uint32_t)(seconds * SAMPLE_RATE_HZ);
    for (uint32_t i = 0; i < n; i++) {
      PPGSample s;
      proc.process(sim.next(), t, s);
      uint8_t ev = hr.update(t, s.signalOk, s.beat, s.beatTimeMs);
      proc.setRefractoryMs(hr.refractoryMs());
      if (s.beat) detections++;
      if (ev & HR_EV_BEAT_ACCEPTED) { accepted++; if (!hr.isValid()) beepsWhileInvalid++; }
      if (ev & HR_EV_BEAT_REJECTED) rejected++;
      samples++;
      if (hr.isValid()) validSamples++;
      if (log && (i % 10 == 0)) bpmLog.push_back(hr.isValid() ? hr.bpmX10() / 10.0 : -1.0);
      t += SAMPLE_PERIOD_MS;
    }
  }
  // Moyenne des BPM valides sur les 'lastS' dernières secondes enregistrées
  double meanBpm(double lastS, double *validFrac = nullptr) const {
    size_t k = (size_t)(lastS * 10);
    if (k > bpmLog.size()) k = bpmLog.size();
    double sum = 0; size_t nv = 0;
    for (size_t i = bpmLog.size() - k; i < bpmLog.size(); i++)
      if (bpmLog[i] > 0) { sum += bpmLog[i]; nv++; }
    if (validFrac) *validFrac = k ? (double)nv / k : 0;
    return nv ? sum / nv : -1;
  }
  double maxAbsErr(double ref, double lastS) const {
    size_t k = (size_t)(lastS * 10);
    double m = 0;
    for (size_t i = bpmLog.size() - k; i < bpmLog.size(); i++)
      if (bpmLog[i] > 0) m = std::fmax(m, std::fabs(bpmLog[i] - ref));
    return m;
  }
};

static void report(const char *name, double ref, double measured, double validFrac) {
  double abs = measured > 0 ? std::fabs(measured - ref) : NAN;
  double rel = measured > 0 ? 100.0 * abs / ref : NAN;
  std::printf("  %-34s ref=%6.1f  calc=%6.1f  err=%5.2f BPM (%5.2f %%)  valide=%3.0f %%\n",
              name, ref, measured, abs, rel, 100 * validFrac);
  if (g_csv) std::fprintf(g_csv, "%s,%.1f,%.2f,%.3f,%.3f,%.1f\n", name, ref, measured, abs, rel, 100 * validFrac);
}

// ---------------------------------------------------------------------------
// FS1 : tests du traitement PPG
// ---------------------------------------------------------------------------
static void testRegular(double bpm, const char *name, uint16_t noise = 0, uint16_t amp = 120) {
  Bench b;
  b.sim.setBpmX10((uint16_t)(bpm * 10));
  b.sim.setNoise(noise);
  b.sim.setAmplitude(amp);
  b.run(30);
  double vf; double m = b.meanBpm(20, &vf);
  report(name, bpm, m, vf);
  CHECK(m > 0 && std::fabs(m - bpm) <= 1.0, "%s : BPM moyen %.2f (ref %.1f)", name, m, bpm);
  CHECK(b.maxAbsErr(bpm, 20) <= 2.0, "%s : écart max %.2f BPM", name, b.maxAbsErr(bpm, 20));
  CHECK(vf > 0.99, "%s : mesure valide %.0f %% du temps", name, vf * 100);
}

static void testAcquisitionDelay() {
  Bench b;
  b.sim.setBpmX10(750);
  uint32_t validAt = 0;
  for (int i = 0; i < 1500 && !validAt; i++) { b.run(0.01, false); if (b.hr.isValid()) validAt = b.t; }
  std::printf("  Délai avant 1er BPM valide (75 BPM) : %u ms\n", validAt);
  CHECK(validAt > 0 && validAt <= 8000, "délai d'accrochage %u ms", validAt);
}

static void testProgressive() {
  // Rampe 60 -> 120 BPM en 60 s puis retour à 70 en 30 s : suivi du rythme
  Bench b;
  double bpm = 60;
  b.sim.setBpmX10(600);
  b.run(10);
  double worst = 0; int validCount = 0, total = 0;
  for (int k = 0; k < 6000; k++) {                // 60 s
    bpm = 60 + 60.0 * k / 6000;
    b.sim.setBpmX10((uint16_t)(bpm * 10));
    b.run(0.01, false);
    if (k % 10 == 0 && k > 300) {
      total++;
      if (b.hr.isValid()) { validCount++; worst = std::fmax(worst, std::fabs(b.hr.bpmX10() / 10.0 - bpm)); }
    }
  }
  for (int k = 0; k < 3000; k++) {                // 120 -> 70 en 30 s
    bpm = 120 - 50.0 * k / 3000;
    b.sim.setBpmX10((uint16_t)(bpm * 10));
    b.run(0.01, false);
    if (k % 10 == 0) {
      total++;
      if (b.hr.isValid()) { validCount++; worst = std::fmax(worst, std::fabs(b.hr.bpmX10() / 10.0 - bpm)); }
    }
  }
  double vf = (double)validCount / total;
  std::printf("  %-34s écart max (retard du moyennage inclus) = %.2f BPM, valide=%.0f %%\n",
              "Rampe 60->120->70 BPM", worst, vf * 100);
  if (g_csv) std::fprintf(g_csv, "Rampe 60->120->70 (ecart max),-,-,%.3f,-,%.1f\n", worst, vf * 100);
  CHECK(worst <= 6.0, "rampe : écart max %.2f BPM", worst);
  CHECK(vf > 0.95, "rampe : valide %.0f %%", vf * 100);
}

static void testBaselineDrift() {
  Bench b;
  b.sim.setBpmX10(720);
  b.sim.setDrift(200, 8);     // ±200 pas ADC en 8 s : dérive très forte
  b.run(40);
  double vf; double m = b.meanBpm(30, &vf);
  report("72 BPM + dérive ±200 ADC / 8 s", 72, m, vf);
  CHECK(std::fabs(m - 72) <= 1.0 && vf > 0.95, "dérive : %.2f BPM valide %.0f%%", m, vf * 100);
}

static void testNoise() {
  testRegular(80, "80 BPM + bruit ±8 ADC", 8);
  testRegular(80, "80 BPM + bruit ±20 ADC", 20);
  testRegular(70, "70 BPM faible amplitude (30 ADC)", 3, 30);
}

static void testSpikes() {
  Bench b;
  b.sim.setBpmX10(700);
  b.sim.setSpikes(2300, 60);  // pic parasite de 60 ADC toutes les 2,3 s
  b.run(40);
  double vf; double m = b.meanBpm(30, &vf);
  report("70 BPM + pics parasites /2,3 s", 70, m, vf);
  CHECK(m > 0 && std::fabs(m - 70) <= 2.0, "pics parasites : %.2f BPM", m);
  std::printf("    battements acceptés=%u rejetés=%u\n", b.accepted, b.rejected);
}

static void testStrongSpikes() {
  // Impulsions de 20 ms plus grandes que le pouls (300 et 600 pas ADC,
  // jusqu'à saturer l'ADC) : supprimées par le filtre médian.
  const uint16_t heights[2] = {300, 600};
  for (uint16_t h : heights) {
    Bench b;
    b.sim.setBpmX10(700);
    b.sim.setSpikes(700, h);
    b.run(40);
    double vf; double m = b.meanBpm(30, &vf);
    char name[64];
    std::snprintf(name, sizeof name, "70 BPM + impulsions %u ADC /0,7 s", h);
    report(name, 70, m, vf);
    CHECK(m > 0 && std::fabs(m - 70) <= 1.0 && vf > 0.95, "%s : %.2f BPM valide %.0f%%", name, m, vf * 100);
    CHECK(b.maxAbsErr(70, 30) <= 2.0, "%s : écart max %.2f", name, b.maxAbsErr(70, 30));
  }
}

static void testNoFinger() {
  Bench b;
  b.sim.setBpmX10(750);
  b.run(15);
  CHECK(b.hr.isValid(), "BPM valide avant retrait du doigt");
  b.sim.setFinger(false);
  b.sim.setNoise(2);
  uint32_t t0 = b.t, invalidAt = 0;
  for (int i = 0; i < 1000 && !invalidAt; i++) { b.run(0.01, false); if (!b.hr.isValid()) invalidAt = b.t; }
  std::printf("  Retrait du doigt : mesure invalidée après %u ms\n", invalidAt - t0);
  CHECK(invalidAt && invalidAt - t0 <= BEAT_TIMEOUT_MS + 100, "invalidation après %u ms", invalidAt - t0);
  Bench &bb = b;
  uint32_t before = bb.accepted;
  bb.run(30, false);
  CHECK(!bb.hr.isValid() && bb.hr.bpm() == 0, "aucun BPM sans doigt");
  CHECK(bb.accepted == before, "aucun battement accepté (donc aucun bip) sans doigt : %u", bb.accepted - before);
  CHECK(bb.hr.hrClass() == HR_NONE, "classe NONE -> aucune LED");
  // Retour du doigt
  b.sim.setFinger(true);
  b.sim.setNoise(0);
  b.run(15);
  CHECK(b.hr.isValid() && std::abs((int)b.hr.bpm() - 75) <= 1, "ré-accrochage après remise du doigt : %u", b.hr.bpm());
}

static void testNoSignal() {
  Bench b;
  b.sim.setBpmX10(750);
  b.run(15);
  b.sim.setSignalPresent(false);   // fil débranché : ADC = 0
  b.run(5);
  CHECK(!b.hr.isValid(), "capteur débranché -> invalide");
  Bench c;                         // signal plat dès le départ
  c.sim.setFinger(false);
  c.run(30);
  CHECK(c.validSamples == 0 && c.accepted == 0, "signal plat : jamais valide (%u éch. valides)", c.validSamples);
  std::printf("  Absence de signal / capteur débranché : invalide, aucun battement accepté\n");
}

static void testLongRun() {
  // 2 heures simulées, en démarrant 10 s avant le débordement du compteur
  // 32 bits des millisecondes (cas qui survient après 49,7 jours).
  Bench b(0xFFFFFFFFu - 10000u);
  b.sim.setBpmX10(680);
  b.sim.setNoise(4);
  b.sim.setDrift(60, 30);
  double worst = 0; uint32_t invalid = 0, total = 0;
  b.run(15, false);
  for (int s = 0; s < 7200; s++) {
    b.run(1, false);
    total++;
    if (!b.hr.isValid()) invalid++;
    else worst = std::fmax(worst, std::fabs(b.hr.bpmX10() / 10.0 - 68));
  }
  std::printf("  %-34s écart max=%.2f BPM, invalide %u/%u s (passage 0xFFFFFFFF inclus)\n",
              "Fonctionnement 2 h", worst, invalid, total);
  if (g_csv) std::fprintf(g_csv, "Fonctionnement 2h (ecart max),68,-,%.3f,-,%.1f\n", worst, 100.0 * (total - invalid) / total);
  CHECK(worst <= 2.0 && invalid == 0, "longue durée : écart %.2f, invalide %u s", worst, invalid);
}

static void testOutlierRules() {
  // Tests directs de HeartRate avec des instants de battement imposés.
  HeartRate hr;
  uint32_t t = 1000;
  auto beatAt = [&](uint32_t tb) {
    uint8_t ev = 0;
    while (t < tb) { ev |= hr.update(t, true, false, 0); t += 10; }
    ev |= hr.update(t, true, true, tb);
    return ev;
  };
  uint32_t tb = 1000;
  for (int i = 0; i < 6; i++) { tb += 800; beatAt(tb); }
  CHECK(hr.isValid() && hr.bpm() == 75, "75 BPM nominal : %u", hr.bpm());
  // Battement parasite à mi-intervalle : rejeté, BPM inchangé
  uint8_t ev = beatAt(tb + 400);
  CHECK(ev & HR_EV_BEAT_REJECTED, "intervalle de 400 ms rejeté");
  CHECK(hr.bpm() == 75, "BPM inchangé après parasite : %u", hr.bpm());
  // Battement manqué (2x l'intervalle) : rejeté
  tb += 800;  // battement réel (on le rate)
  tb += 800;
  ev = beatAt(tb);
  CHECK(ev & HR_EV_BEAT_REJECTED, "intervalle double (battement manqué) rejeté");
  CHECK(hr.isValid() && hr.bpm() == 75, "BPM conservé : %u", hr.bpm());
  // Intervalle non physiologique (< 300 ms) rejeté
  ev = beatAt(tb + 200);
  CHECK(ev & HR_EV_BEAT_REJECTED, "IBI 200 ms (> 200 BPM) rejeté");
  // Changement brutal et durable de rythme : ré-accrochage
  tb += 200;
  for (int i = 0; i < 12; i++) { tb += 500; beatAt(tb); }
  CHECK(hr.isValid() && hr.bpm() == 120, "nouveau rythme 120 BPM adopté : %u", hr.bpm());
  // Timeout
  while (t < tb + BEAT_TIMEOUT_MS + 20) { hr.update(t, true, false, 0); t += 10; }
  CHECK(!hr.isValid() && hr.bpm() == 0, "timeout sans battement -> invalide");
  // Classification
  CHECK(classifyBpm(59) == HR_LOW && classifyBpm(60) == HR_NORMAL &&
        classifyBpm(100) == HR_NORMAL && classifyBpm(101) == HR_HIGH && classifyBpm(0) == HR_NONE,
        "seuils de classification 60/100");
}

static void testDcRemoval() {
  // Un échelon de ligne de base (+300 ADC, ex. allumage d'une lampe) doit
  // être absorbé en ~1,3 s par la moyenne glissante.
  PPGProcessor p; PPGSample s;
  uint32_t t = 0;
  for (int i = 0; i < 300; i++, t += 10) p.process(400, t, s);
  CHECK(s.filtered == 0, "signal constant -> centré nul (%d)", s.filtered);
  int maxAfter = 0;
  for (int i = 0; i < 300; i++, t += 10) { p.process(700, t, s); if (i > 140) maxAfter = std::max(maxAfter, std::abs((int)s.filtered)); }
  CHECK(maxAfter == 0, "échelon +300 absorbé après 1,4 s (résidu %d)", maxAfter);
  CHECK(!s.signalOk || s.amplitudeAdc < 400, "état après échelon");
}

// ---------------------------------------------------------------------------
// FS6 : EEPROM (EEPROM simulée en RAM, même code que sur la carte)
// ---------------------------------------------------------------------------
static void testEEPROM() {
  eepromFakeFill(0xFF);                    // puce neuve
  EEPROMManager e;
  e.begin();
  CHECK(e.count() == 0 && e.capacity() == EEPROM_CAPACITY, "format initial : count=%u cap=%u", e.count(), e.capacity());
  CHECK(e.capacity() == 126, "capacité = (1024-16)/8 = 126");
  Record r{76, 9, 10, 26, 14, 32, 8};
  CHECK(e.append(r) == EE_OK, "ajout 1");
  Record r2{55, 31, 12, 99, 23, 59, 59};
  CHECK(e.append(r2) == EE_OK, "ajout 2");
  // "Redémarrage" : nouvel objet, même contenu EEPROM
  EEPROMManager e2; e2.begin();
  Record o;
  CHECK(e2.count() == 2, "persistance après redémarrage : %u", e2.count());
  CHECK(e2.read(0, o) && o.bpm == 76 && o.day == 9 && o.month == 10 && o.year == 26 &&
        o.hour == 14 && o.minute == 32 && o.second == 8, "relecture enregistrement 1");
  CHECK(e2.read(1, o) && o.bpm == 55 && o.second == 59, "relecture enregistrement 2");
  CHECK(!e2.read(2, o), "lecture hors limites refusée");
  // Langue / buzzer : pas d'écriture si inchangé
  uint32_t w0 = eepromFakeWrites();
  e2.setLanguage(e2.language());
  CHECK(eepromFakeWrites() == w0, "setLanguage identique : 0 écriture");
  e2.setLanguage(1);
  EEPROMManager e3; e3.begin();
  CHECK(e3.language() == 1, "langue persistée");
  // Corruption d'un enregistrement -> CRC détecte
  eepromFakeCorrupt(EEPROM_HEADER_SIZE + 0 * EEPROM_RECORD_SIZE + 0);
  CHECK(!e3.read(0, o), "enregistrement corrompu détecté par CRC");
  // Effacement
  CHECK(e3.eraseAll() == EE_OK && e3.count() == 0, "effacement");
  uint32_t wErase = eepromFakeWrites();
  EEPROMManager e4; e4.begin();
  CHECK(e4.count() == 0, "effacement persistant (pas de résurrection après reboot)");
  CHECK(e4.language() == 1, "langue conservée après effacement");
  (void)wErase;
  // Mémoire pleine
  for (int i = 0; i < EEPROM_CAPACITY; i++) { Record x{(uint8_t)(60 + i % 50), 1, 1, 26, 0, 0, (uint8_t)(i % 60)}; e4.append(x); }
  CHECK(e4.count() == EEPROM_CAPACITY, "remplissage complet %u", e4.count());
  Record x{70, 1, 1, 26, 0, 0, 0};
  CHECK(e4.append(x) == EE_FULL, "mémoire pleine signalée");
  CHECK(e4.count() == EEPROM_CAPACITY, "aucun écrasement si plein");
  // Coupure d'alimentation pendant l'écriture de l'en-tête (count écrit, CRC non)
  e4.eraseAll();
  e4.append(r); e4.append(r);
  eepromFakeSetWriteBudget(8 + 1);         // record (8 o) + count, puis coupure
  e4.append(r2);
  eepromFakeSetWriteBudget(-1);
  EEPROMManager e5; e5.begin();
  CHECK(e5.count() == 3 && e5.wasRecovered(), "récupération après coupure (count=%u, recovered=%d)", e5.count(), e5.wasRecovered());
  // Coupure au milieu de l'enregistrement : il est ignoré, les autres restent
  eepromFakeSetWriteBudget(4);
  e5.append(r);
  eepromFakeSetWriteBudget(-1);
  EEPROMManager e6; e6.begin();
  CHECK(e6.count() == 3, "enregistrement partiel ignoré (count=%u)", e6.count());
  // Coupure pendant l'effacement (génération écrite, reste non)
  eepromFakeSetWriteBudget(1);
  e6.eraseAll();
  eepromFakeSetWriteBudget(-1);
  EEPROMManager e7; e7.begin();
  CHECK(e7.count() == 0, "effacement interrompu -> aucun ancien enregistrement ressuscité (count=%u)", e7.count());
  // Nombre d'écritures pour un ajout : 8 (record) + 2 (count + CRC)
  e7.eraseAll();
  uint32_t wa = eepromFakeWrites();
  e7.append(r);
  CHECK(eepromFakeWrites() - wa <= 10, "ajout = %u écritures d'octets", eepromFakeWrites() - wa);
}

// ---------------------------------------------------------------------------
// Chaînes multilingues : présence et largeur écran (16 caractères)
// ---------------------------------------------------------------------------
static void testStrings() {
  char buf[24];
  for (uint8_t lang = 0; lang < LANG_COUNT; lang++) {
    for (uint8_t i = 0; i < STR_COUNT; i++) {
      size_t n = strLen((StrId)i, lang);
      copyStr((StrId)i, lang, buf, sizeof buf);
      CHECK(n > 0 && n <= 16, "chaîne %u langue %u longueur %zu '%s'", i, lang, n, buf);
      for (size_t k = 0; k < n; k++)
        CHECK((unsigned char)buf[k] >= 32 && (unsigned char)buf[k] < 127, "caractère non ASCII chaîne %u", i);
    }
  }
  copyStr(STR_MENU_TITLE, LANG_FR, buf, sizeof buf);
  CHECK(std::strcmp(buf, "MENU PRINCIPAL") == 0, "FR menu '%s'", buf);
  copyStr(STR_MENU_TITLE, LANG_EN, buf, sizeof buf);
  CHECK(std::strcmp(buf, "MAIN MENU") == 0, "EN menu '%s'", buf);
}

static void testFormat() {
  char b[24];
  fmtU(b, 7, 3);            CHECK(std::strcmp(b, "  7") == 0, "fmtU largeur '%s'", b);
  fmtTime(b, 4, 5, 9);      CHECK(std::strcmp(b, "04:05:09") == 0, "fmtTime '%s'", b);
  fmtDate(b, 9, 10, 2026);  CHECK(std::strcmp(b, "09/10/2026") == 0, "fmtDate '%s'", b);
  fmtI(b, -42);             CHECK(std::strcmp(b, "-42") == 0, "fmtI '%s'", b);
  fmtU(b, 4294967295UL);    CHECK(std::strcmp(b, "4294967295") == 0, "fmtU max '%s'", b);
}

int main() {
  g_csv = std::fopen("results_simulation.csv", "w");
  if (g_csv) std::fprintf(g_csv, "# RESULTATS DE SIMULATION (PPGSimulator) - PAS DES MESURES CAPTEUR\n"
                                 "scenario,bpm_reference,bpm_calcule_moyen,erreur_absolue_bpm,erreur_relative_pct,temps_valide_pct\n");
  std::printf("=== FS1 : traitement PPG (SIGNAUX SIMULÉS) ===\n");
  testDcRemoval();
  testRegular(60, "60 BPM régulier");
  testRegular(80, "80 BPM régulier");
  testRegular(120, "120 BPM régulier");
  testRegular(45, "45 BPM régulier");
  testRegular(180, "180 BPM régulier");
  testAcquisitionDelay();
  testProgressive();
  testBaselineDrift();
  testNoise();
  testSpikes();
  testStrongSpikes();
  testNoFinger();
  testNoSignal();
  testOutlierRules();
  testLongRun();
  std::printf("=== FS6 : EEPROM (EEPROM simulée) ===\n");
  testEEPROM();
  std::printf("=== Multilingue ===\n");
  testStrings();
  testFormat();
  if (g_csv) std::fclose(g_csv);
  std::printf("\nRésultat : %d vérifications OK, %d ÉCHEC(S)\n", g_pass, g_fail);
  return g_fail ? 1 : 0;
}
