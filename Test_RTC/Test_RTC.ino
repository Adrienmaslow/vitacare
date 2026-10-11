// Test du câblage du DS1302 (lecture seule : l'heure n'est PAS modifiée)
// Broches du tableau d'architecture : CLK (SCLK) -> D2, DAT (IO) -> D3, RST (CE) -> D13
// Moniteur série : 115200 bauds
//
// Lecture du registre des secondes (octet brut) :
//   0xFF en permanence -> le DS1302 ne répond pas : câblage, VCC/GND, mauvaises broches
//   bit 7 à 1 (ex. 0x80) -> le module répond mais l'horloge est arrêtée (jamais réglée / pile)
//   autre valeur qui change chaque seconde -> tout fonctionne
#include "virtuabotixRTC.h"

#define DS1302_CLK_PIN 2
#define DS1302_DAT_PIN 3
#define DS1302_RST_PIN 13

virtuabotixRTC RTC(DS1302_CLK_PIN, DS1302_DAT_PIN, DS1302_RST_PIN);

void setup() {
  Serial.begin(115200);
  Serial.println(F("Test DS1302 : CLK D2, DAT D3, RST D13"));
}

void loop() {
  uint8_t brut = RTC.DS1302_read(0x80);
  RTC.updateTime();
  Serial.print(F("registre secondes = 0x"));
  Serial.print(brut, HEX);
  Serial.print(F("   heure lue : "));
  Serial.print(RTC.year);    Serial.print('/');
  Serial.print(RTC.month);   Serial.print('/');
  Serial.print(RTC.dayofmonth); Serial.print(' ');
  Serial.print(RTC.hours);   Serial.print(':');
  Serial.print(RTC.minutes); Serial.print(':');
  Serial.print(RTC.seconds);
  if (brut == 0xFF)       Serial.println(F("   -> PAS DE REPONSE (cablage)"));
  else if (brut & 0x80)   Serial.println(F("   -> horloge arretee (a regler)"));
  else                    Serial.println(F("   -> OK"));
  delay(1000);
}
