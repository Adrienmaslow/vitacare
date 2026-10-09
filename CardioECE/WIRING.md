# Câblage CARDIO ECE — Arduino Uno / Nano (ATmega328P, 5 V, 16 MHz)

> **Statut du câblage.** Les lignes marquées **[CONFIRMÉ]** proviennent du message
> de l'équipe (Discord, Luck8). Les lignes **[PROVISOIRE]** sont une proposition sans
> conflit, **à vérifier sur le montage réel**. Toute modification se fait **uniquement**
> dans `config.h` (section 1), sans toucher au reste du code.

## 1. Tableau de câblage

| Composant | Signal (broche module) | Broche Arduino | Tension | Rôle du fil | Composant additionnel | Statut |
|-----------|------------------------|----------------|---------|-------------|-----------------------|--------|
| Capteur WPSE340 | VCC | 5V | 5 V (vérifier la plage de la notice) | alimentation | — | PROVISOIRE |
| Capteur WPSE340 | GND | GND | 0 V | masse | — | PROVISOIRE |
| Capteur WPSE340 | S (sortie analogique) | **A0** | 0 … 5 V analogique | signal PPG vers l'ADC | aucune (câble court, éloigné des fils du buzzer) | PROVISOIRE |
| Buzzer **passif** | + | **D5** | 0/5 V, carré 440-1760 Hz | commande sonore | résistance série 100 Ω (limite le courant < 20 mA) | **CONFIRMÉ** |
| Buzzer passif | − | GND | 0 V | masse | — | CONFIRMÉ |
| LED rouge | anode (patte longue) | **D10** | 5 V → ≈ 2,0 V LED | FC élevée | **220 Ω** en série | **CONFIRMÉ** |
| LED jaune | anode | **D11** | 5 V → ≈ 2,1 V | FC faible | **220 Ω** en série | **CONFIRMÉ** |
| LED verte | anode | **D12** | 5 V → ≈ 2,2 V (3 V si verte « pure ») | FC normale | **220 Ω** en série | **CONFIRMÉ** |
| LED (×3) | cathode (patte courte) | GND | 0 V | retour | — | CONFIRMÉ |
| Encodeur KY-040 | CLK (A) | **D9** | 5 V logique | quadrature A | pull-up 10 kΩ sur le module (+ pull-up interne) | **CONFIRMÉ** (rôle CLK provisoire) |
| Encodeur KY-040 | DT (B) | **D8** | 5 V logique | quadrature B | idem | **CONFIRMÉ** (rôle DT provisoire) |
| Encodeur KY-040 | SW | **D7** | 5 V logique, appui = 0 V | clic menu / valider | pull-up interne (INPUT_PULLUP) | **CONFIRMÉ** (rôle SW provisoire) |
| Encodeur KY-040 | + / GND | 5V / GND | 5 V | alimentation | — | — |
| Bouton « Enregistrer » | une patte | **D4** | appui = 0 V | lancer un enregistrement | autre patte à **GND**, pull-up interne | **CONFIRMÉ** |
| Bouton « Buzzer ON/OFF » | une patte | **D6** | appui = 0 V | couper / rétablir le son | autre patte à GND, pull-up interne | **PROVISOIRE** (voir §4) |
| RTC DS1302 (MH-Real-Time Clock) | VCC | 5V | 2,0-5,5 V | alimentation principale | pile CR2032 sur le module | — |
| RTC DS1302 | GND | GND | 0 V | masse | — | — |
| RTC DS1302 | CLK (SCLK) | **A1** (D15) | 5 V logique | horloge série | — | **PROVISOIRE** |
| RTC DS1302 | DAT (I/O) | **A2** (D16) | 5 V logique, bidirectionnel | données série | — | **PROVISOIRE** |
| RTC DS1302 | RST (= CE) | **A3** (D17) | 5 V logique | sélection du circuit | — | **PROVISOIRE** |
| OLED 1 « texte » (SSD1306 128×64) | VCC / GND | 5V / GND | 3,3-5 V selon module (régulateur intégré) | alimentation | — | — |
| OLED 1 | SDA / SCL | **A4 / A5** | I2C, pull-ups du module | bus I2C (adresse **0x3C**) | — | imposé par l'ATmega328P |
| OLED 2 « courbe » | VCC / GND | 5V / GND | idem | alimentation | — | — |
| OLED 2 | SDA / SCL | **A4 / A5** (même bus) | I2C | bus I2C (adresse **0x3D**) | changer l'adresse : §3 | imposé |

Broches libres après ce câblage : **D2, D3** (interruptions externes), **D13**
(LED intégrée), **A6, A7** (Nano uniquement, analogiques seules).

## 2. Vérification des conflits (broches, timers, périphériques)

| Ressource | Utilisateur | Conflit possible | Vérification |
|-----------|-------------|------------------|--------------|
| Timer0 | `millis()`, `micros()` | PWM D5/D6 | le buzzer D5 n'utilise **pas** le PWM (signal généré par Timer2) → OK |
| Timer1 | échantillonnage PPG 100 Hz | PWM D9/D10, bibliothèque Servo | D9 (encodeur) et D10 (LED) en tout-ou-rien ; Servo non utilisée → OK |
| Timer2 | générateur de tonalité du buzzer | PWM D3/D11, `tone()` | D11 (LED) en tout-ou-rien ; `tone()` du cœur non utilisé → OK |
| ADC | canal 0 (A0) déclenché par Timer1 | `analogRead()` ailleurs | aucun autre `analogRead()` ; A1-A3 en numérique ne touchent pas l'ADC → OK |
| PCINT0 | encodeur D8/D9 | SoftwareSerial | SoftwareSerial non utilisée → OK |
| TWI (I2C) | 2 OLED | — | adresses distinctes obligatoires (§3) |
| USART | console série 115200 bauds (D0/D1) | — | ne rien câbler sur D0/D1 |
| SPI (D10-D13) | non utilisé | D10/D11/D12 servent aux LED | SPI désactivé → OK |

## 3. Deux écrans sur le même bus I2C

Les modules SSD1306 0,96" sortent d'usine en **0x3C**. Le second doit être passé en
**0x3D** : au dos du module, déplacer la résistance (souvent 4,7 kΩ ou 0 Ω) marquée
« IIC ADDRESS SELECT » de la position **0x78** vers **0x7A** (adresses 8 bits ;
0x78 = 0x3C × 2, 0x7A = 0x3D × 2).

* **Vérifier** : au démarrage, la console série affiche `OLED1 absent` ou
  `OLED2 absent` si une adresse ne répond pas ; la commande `STATUS` indique
  `oled1=1 oled2=1` quand les deux répondent.
* Si les deux écrans restent en 0x3C et ne peuvent pas être modifiés : multiplexeur
  I2C TCA9548A (non prévu dans le code actuel) ou modification matérielle.
* Écrans 1,3" : souvent contrôleur **SH1106** → mettre `OLED_TEXT_SH1106` /
  `OLED_GRAPH_SH1106` à 1 dans `config.h`.
* Résistances de tirage : chaque module en porte (souvent 4,7 kΩ ou 10 kΩ) ; deux
  modules en parallèle donnent 2,4-5 kΩ, valeur correcte pour 400 kHz.

## 4. Cas d'un seul bouton poussoir

Le câblage communiqué ne mentionne qu'**un** bouton (D4). Le cahier des charges
demande l'enregistrement **et** la commande du buzzer par bouton :

* **Option recommandée** : ajouter un 2e bouton sur **D6** (`HAS_BUZZER_BUTTON 1`).
* **Option un seul bouton** : `HAS_BUZZER_BUTTON 0` → sur D4, **appui court = enregistrer**,
  **appui long (0,8 s) = buzzer ON/OFF**. Le buzzer reste aussi réglable dans le menu.

## 5. Contraintes électriques

* **LED** : I = (5 V − V_LED) / R = (5 − 2,0) / 220 ≈ **14 mA** (rouge), ≈ 13 mA (jaune/verte).
  Limite ATmega328P : 40 mA absolu par broche, **20 mA recommandés**, 200 mA pour
  tout le boîtier. Avec une LED verte « pure » (V_F ≈ 3 V) : 9 mA, luminosité plus faible
  → 150 Ω possible.
* **Buzzer passif** : une piezo pure consomme quelques mA (direct possible). Un buzzer
  électromagnétique (bobine, ≈ 16-42 Ω) dépasse 20 mA : passer par un transistor NPN
  (2N2222/BC547 + 1 kΩ en base + diode de roue libre). **Vérifier la référence du buzzer.**
  Un buzzer **actif** (oscillateur intégré, un seul son) ne permet pas les 3 tonalités :
  mettre `BUZZER_IS_ACTIVE 1` si c'est le cas (les durées restent pilotées).
* **Entrée analogique A0** : tension 0-5 V maximum (référence AVcc = 5 V,
  1 pas = 4,88 mV). Impédance de source recommandée ≤ 10 kΩ (échantillonneur-bloqueur
  de l'ADC). Ne jamais appliquer plus de VCC + 0,5 V.
* **DS1302** : 2,0-5,5 V ; la pile CR2032 du module n'est **pas rechargeable** — le
  logiciel désactive le chargeur intégré (« trickle charger ») lors du réglage.
* **Alimentation** : USB 5 V / 500 mA suffisant (OLED ≈ 2 × 20 mA, LED 14 mA,
  capteur ≈ 5 mA, carte ≈ 50 mA).
* **Masse commune** : tous les GND reliés au GND de l'Arduino.

## 6. Ressources mémoire (mesurées à la compilation)

| Ressource | Capteur (`SIMULATION_MODE 0`) | Simulation (`SIMULATION_MODE 1`) | Limite ATmega328P |
|-----------|-------------------------------|----------------------------------|-------------------|
| Flash | 28 162 o (87,3 % des 32 256 o hors bootloader Uno) | 30 132 o (93,4 %) | 32 768 o (− 512 o bootloader Uno) |
| SRAM statique | 1 598 o | 1 640 o | 2 048 o |
| SRAM libre à l'exécution | 384 o, **marge de pile minimale observée 248 o** (émulation) | 340 o, marge 206 o (émulation) | — |
| EEPROM | 16 o d'en-tête + 126 × 8 o | idem | 1 024 o |

Valeurs exactes : `tools/size_report.sh` ; à l'exécution : commande `STATUS`
(`ram_libre`, `pile_marge_min`).
