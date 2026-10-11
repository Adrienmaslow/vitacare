// Test : LED jaune allumée et ligne "JAUNE (faible)" chaque seconde
// Le BPM est une valeur fixe (pas une mesure du capteur).
// Broches (tableau d'architecture) : D10 = rouge, D11 = verte, D12 = jaune
const uint8_t PIN_LED_ROUGE = 10;
const uint8_t PIN_LED_VERTE = 11;
const uint8_t PIN_LED_JAUNE = 12;
const int BPM = 52;                    // < 60 : faible

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_ROUGE, OUTPUT);
  pinMode(PIN_LED_VERTE, OUTPUT);
  pinMode(PIN_LED_JAUNE, OUTPUT);

  digitalWrite(PIN_LED_ROUGE, LOW);
  digitalWrite(PIN_LED_VERTE, LOW);
  digitalWrite(PIN_LED_JAUNE, HIGH);   // jaune
}

void loop() {
  Serial.print(F("[capteur] "));
  Serial.print(BPM);
  Serial.println(F(" bpm -> JAUNE (faible)"));
  delay(1000);
}
