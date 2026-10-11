// Test : allumer seulement la LED jaune
// Broches (tableau d'architecture) : D10 = rouge, D11 = verte, D12 = jaune
const uint8_t PIN_LED_ROUGE = 10;
const uint8_t PIN_LED_VERTE = 11;
const uint8_t PIN_LED_JAUNE = 12;

void setup() {
  pinMode(PIN_LED_ROUGE, OUTPUT);
  pinMode(PIN_LED_VERTE, OUTPUT);
  pinMode(PIN_LED_JAUNE, OUTPUT);

  digitalWrite(PIN_LED_ROUGE, LOW);
  digitalWrite(PIN_LED_VERTE, LOW);
  digitalWrite(PIN_LED_JAUNE, HIGH);   // seule la jaune est allumée
}

void loop() {
}
