# Dossier technique de soutenance — CARDIO ECE

Ce document prépare l'oral : chaque section explique **pourquoi** les choix ont été
faits. Les chiffres marqués *(simulation)* ou *(émulation)* ne sont **pas** des
mesures sur le matériel réel.

---

## 1. Le capteur WPSE340 : principe

* **Photopléthysmographie (PPG)** : une LED éclaire la peau (doigt) ; un photodétecteur
  mesure la lumière réfléchie ou transmise. À chaque systole, le volume de sang dans
  les capillaires augmente, absorbe davantage de lumière, et le signal reçu varie.
* Le signal contient :
  * une **composante continue** importante (tissus, os, sang veineux, lumière ambiante,
    pression du doigt) qui **dérive** lentement ;
  * une **composante pulsatile** faible (quelques % du total), au rythme cardiaque,
    avec un **front systolique** raide, un pic, une **encoche dicrote** puis une
    décroissance diastolique.
* **À vérifier sur la notice du module** (référence exacte non documentée dans nos
  sources) : présence ou non d'un **amplificateur intégré**. Avec un module amplifié
  (type « Pulse Sensor »), la sortie est centrée vers VCC/2 avec une amplitude de
  quelques centaines de mV ; sans amplificateur (type KY-039), la variation n'est que
  de quelques pas ADC. Notre traitement fonctionne dans les deux cas tant que
  l'amplitude dépasse `MIN_AMPLITUDE_ADC` (10 pas, ≈ 49 mV) ; la commande `STATUS`
  affiche l'amplitude mesurée (`amp_adc`) pour régler ce seuil.

## 2. Nature du signal de sortie

Tension analogique **0-5 V** (alimentation 5 V), continue, lentement variable,
modulée à 0,7-3,3 Hz (40-200 BPM). Bande utile : **0,5 à ~5 Hz**. Perturbations :
lumière ambiante (dont 100 Hz des éclairages secteur), mouvements, pression variable,
parasites impulsionnels.

## 3. Conversion ADC de l'ATmega328P

* 10 bits, approximations successives, échantillonneur-bloqueur intégré.
* Référence AVcc = 5 V → quantum $q = 5/1024 = 4{,}88$ mV.
* Horloge ADC = 16 MHz / 128 = 125 kHz (50-200 kHz requis pour la pleine
  résolution) ; une conversion = 13 cycles = **104 µs**.
* **Déclenchement par Timer1** : la conversion est lancée dans l'interruption à 100 Hz
  et lue au tick suivant → instants d'échantillonnage parfaitement réguliers (quartz),
  aucune attente active (contrairement à `analogRead()` qui bloque 112 µs).
* Le tampon numérique de A0 est désactivé (`DIDR0`) pour réduire le bruit.

## 4. La dérive du signal PPG

Causes : pression du doigt qui change, respiration (modulation 0,2-0,3 Hz), variation
de la lumière ambiante, température, déplacement du doigt. Sans correction, un seuil
fixe serait tantôt jamais franchi, tantôt toujours franchi.

## 5. La moyenne glissante

$m[n] = \frac{1}{128}\sum_{k=0}^{127} x[n-k]$ estime la composante continue sur
1,28 s. Implémentation **O(1)** : somme glissante $S \leftarrow S + x[n] - x[n-128]$ dans
un **buffer circulaire** ; division par décalage (128 = 2⁷). Entiers exacts → **aucune
dérive numérique** même après des heures (vérifié sur 2 h simulées).

**Pourquoi centrée ?** On retranche la moyenne à l'échantillon **du milieu** de la
fenêtre : le filtre est à phase linéaire (forme d'onde intacte) et annule
**exactement** une dérive linéaire. Mesure comparative *(simulation)* avec une dérive
de ±200 ADC en 8 s : 48 % de temps de mesure valide avec la moyenne causale, 100 %
avec la moyenne centrée. Contrepartie : 0,63 s de retard, compensé dans l'horodatage
(le BPM n'est pas affecté).

**Pourquoi 1,28 s ?** Coupure du passe-haut obtenu à 0,59 Hz (35 BPM) : on garde le
pouls dès 40 BPM (gain 0,84 à 0,67 Hz, 0,96 à 0,75 Hz) et on atténue la respiration
(0,2 Hz : gain 0,10).

## 6. Calcul du BPM

1. Détection du **front systolique** par franchissement montant d'un seuil adaptatif,
   avec hystérésis et période réfractaire ; instant **interpolé** au ms près.
2. Intervalle $IBI = t_k - t_{k-1}$ (différence non signée : correcte au débordement
   du compteur 32 bits).
3. Validation : 300-1500 ms et écart à la **médiane** des 8 derniers IBI ≤ 30 %.
4. $\text{BPM} = 60000 \times n / \sum IBI$ sur les 5 derniers IBI validés.
5. Valide seulement après 4 IBI cohérents ; invalide après 1 s de mauvais signal ou
   3 s sans battement accepté.

Pourquoi pas « compter les battements pendant 15 s × 4 » ? Résolution de 4 BPM et
15 s de latence. Pourquoi pas un `delay()` ? Il fausserait la base de temps et
bloquerait tout le reste.

## 7. Gestion de la luminosité

* Variations lentes (lampe, nuage, ombre) : supprimées par la moyenne glissante centrée.
* Changement d'amplitude (le signal utile dépend de l'éclairage et de la pression) :
  le **seuil est proportionnel à l'amplitude mesurée** par les enveloppes ; il n'y a
  aucun seuil absolu.
* Scintillement 100 Hz des éclairages : échantillonné à 100 Hz, il se replie à
  ≈ 0 Hz (composante quasi continue, retirée par la moyenne) ; le passe-bas sur 4
  échantillons a en outre un zéro exact à 25 et 50 Hz.
* Saturation (lumière trop forte, doigt trop appuyé) : détectée (ADC ≤ 5 ou ≥ 1018
  durablement) → mesure invalide, plutôt qu'une valeur fausse.
* **Conseil de démonstration** : couvrir le capteur et le doigt (ruban, capuchon) pour
  limiter la lumière parasite.

## 8. Communication avec le DS1302

* Bus **série 3 fils** : CE (sélection, actif haut), SCLK (horloge fournie par
  l'Arduino), I/O (donnée **bidirectionnelle**).
* Trame : CE = 1, octet de commande (bit 7 = 1, bits 5-1 = adresse, bit 0 = 1 lecture /
  0 écriture), puis données ; **LSB en premier** ; l'Arduino présente les bits sur front
  **montant**, le DS1302 émet sur front **descendant**.
* **Différence avec SPI** : SPI a deux lignes de données (MOSI, MISO), est full-duplex,
  MSB en premier par défaut et utilise un /SS actif bas ; le DS1302 a une seule ligne
  I/O half-duplex, LSB en premier, CE actif haut → le module SPI matériel ne convient
  pas, d'où un pilote « bit-banging » écrit à la main (`RTCManager.cpp`), ≈ 0,7 ms par
  lecture.
* Lecture en **mode rafale** (commande 0xBF) : les 8 registres sont figés ensemble,
  pas d'incohérence quand la seconde change pendant la lecture.
* Registres en **BCD** ; bit **CH** (clock halt) : oscillateur arrêté = heure jamais
  réglée ou pile vide → affiché « HEURE NON RÉGLÉE » ; bit **WP** (write protect)
  remis à 1 après chaque réglage ; **chargeur** désactivé (pile CR2032 non
  rechargeable).
* **Contrôles de cohérence** : BCD valide, plages, jours du mois, années bissextiles,
  module absent (0x00/0xFF), 3 erreurs consécutives avant d'invalider.
* **Dérive ≤ 3 s/jour** : 3 s / 86 400 s = **35 ppm**. Un quartz 32,768 kHz courant est
  donné à ±20 ppm à 25 °C (≈ 1,7 s/jour) mais dérive en température et selon la
  capacité de charge : **seule une mesure** peut conclure (protocole HW-10 :
  comparaison à l'heure NTP du PC sur 3 à 7 jours, `tests/tools/rtc_drift.py`).

## 9. Communication I2C avec les OLED

* Bus 2 fils (SDA = A4, SCL = A5), drain ouvert + résistances de tirage, **400 kHz**.
* Chaque écran a une adresse 7 bits : **0x3C** et **0x3D** (résistance à déplacer au dos
  du second). Trame : START, adresse + bit écriture, octet de contrôle (0x00 =
  commandes, 0x40 = données), octets, STOP.
* Le SSD1306 possède sa **propre RAM d'image** (1 Ko) organisée en 8 **pages** de
  8 lignes : un octet = 8 pixels verticaux.
* Durée : une page (128 octets) ≈ 3 ms à 400 kHz ; un écran complet ≈ 25 ms. D'où
  le découpage : **une page par tour de `loop()`**.
* Sécurité : `Wire.setWireTimeout(25 ms)` → un écran débranché ne bloque pas le
  programme ; détection de présence au démarrage (`STATUS` : `oled1`, `oled2`).

## 10. Gestion de la SRAM (2 048 octets)

Un écran 128×64 en mode « tampon complet » = 1 024 o ; deux = **toute la RAM**.
Solution :

| Poste | Octets | Choix |
|-------|--------|-------|
| Écran texte | 0 (+ 16 o d'empreintes de lignes) | mode caractères u8x8 : écriture directe dans la RAM de l'écran, seules les lignes modifiées sont renvoyées |
| Écran courbe | 128 | mode page u8g2 : une bande de 8 lignes à la fois |
| Historique de la courbe | 200 | 100 colonnes × (min, max) en `uint8_t` |
| Moyenne glissante | 160 | 128 × 10 bits rangés en 8 + 2 bits |
| FIFO d'acquisition | 32 | 16 × `uint16_t` |
| Wire + Serial (cœur) | ≈ 320 | tampons fixes des bibliothèques |
| Textes FR/EN, tables, police | 0 | **PROGMEM** (Flash) |
| **Total statique** | **1 598** | + pile : marge minimale **248 o** mesurée *(émulation)* |

Règles appliquées : aucune allocation dynamique (`malloc`, `new`, `String`), chaînes
en Flash (`F()`, `PSTR`, `PROGMEM`), structures compactes (`uint8_t`), pas de
`printf` (≈ 1,3 Ko de Flash économisés), marge de pile **mesurée** à l'exécution :
la RAM libre est remplie d'un motif au démarrage et `STATUS` compte les octets jamais
écrasés (`pile_marge_min`).

**Flash** : 28 162 / 32 256 o. Pour tenir, deux optimisations notables : l'API C
d'U8g2 (la classe C++ forçait le lien du moteur de polices, 2,5 Ko) et un générateur
de tonalité dédié sur Timer2 au lieu de `tone()` (≈ 0,9 Ko).

## 11. Organisation de l'EEPROM (1 024 octets)

| Adresse | Taille | Contenu |
|---------|--------|---------|
| 0x000 | 2 | signature « CE » |
| 0x002 | 1 | version du format |
| 0x003 | 1 | **génération** (incrémentée à chaque effacement) |
| 0x004 | 1 | nombre d'enregistrements |
| 0x005 | 1 | langue |
| 0x006 | 1 | buzzer ON/OFF |
| 0x007 | 1 | CRC-8 de l'en-tête |
| 0x008 | 8 | réservé |
| 0x010 | 126 × 8 | enregistrements : BPM, jour, mois, année−2000, heure, min, s, CRC-8 |

* Capacité : $(1024 - 16) / 8 = 126$ enregistrements.
* **CRC-8** (Dallas/Maxim) par enregistrement, initialisé avec la génération et
  l'indice : un enregistrement antérieur à un effacement ne peut pas « revenir ».
* **Effacement logique** : 3 octets écrits (génération, compteur, CRC) au lieu de
  1 008 → rapide et économe en endurance.
* `EEPROM.update()` partout : un octet n'est écrit que s'il change (100 000 cycles
  garantis par cellule ; 3,3 ms par écriture).
* **Ordre d'écriture** d'un ajout : enregistrement complet → compteur → CRC d'en-tête.
  Une coupure à n'importe quel moment laisse un état cohérent : au redémarrage, si
  le CRC d'en-tête est faux, le compteur est **reconstruit** en comptant les
  enregistrements valides. Testé *(simulation)* : coupure avant le CRC, au milieu
  d'un enregistrement, pendant l'effacement.
* **Limites** : une coupure pendant l'écriture d'un octet peut le corrompre (le CRC le
  détecte, l'enregistrement est ignoré) ; le détecteur de sous-tension (BOD 2,7 V des
  Uno) réduit ce risque. La mémoire n'est **jamais** effacée au démarrage.

## 12. Architecture non bloquante

* **Interruptions** : Timer1 (100 Hz, échantillon), Timer2 (buzzer), Timer0
  (`millis()`), PCINT0 (encodeur), TWI et USART (bibliothèques).
* **FIFO** entre l'interruption et `loop()` : l'acquisition n'attend jamais le
  traitement ; le traitement rattrape son retard au tour suivant.
* `loop()` traite la FIFO **trois fois par tour** et n'exécute que des tâches
  bornées : 2 lignes de texte **ou** 1 bande de courbe, lecture RTC toutes les
  200 ms, 16 caractères de console au plus, sortie série abandonnée plutôt que
  bloquante.
* *(émulation)* : FIFO jamais plus remplie que 3/16 → retard maximal de traitement
  30 ms ; 0 échantillon perdu en 93 s de scénario complet.
* Boutons : anti-rebond par horodatage (25 ms de stabilité), sans attente ;
  encodeur par interruption (aucun cran perdu pendant une trame I2C).

## 13. Limites techniques

* Pas encore de validation sur le vrai capteur (cf. `TESTS.md`, HW-01 à HW-21).
* Sensibilité aux mouvements (artefacts longs) : rejet puis invalidation, pas de
  correction.
* Retard ≈ 0,7 s du bip et de la courbe (moyenne centrée).
* BPM moyenné sur 5 intervalles : 3-5 battements pour suivre un changement brutal.
* Classification par seuils fixes, adulte au repos, sans valeur médicale.
* Précision de l'horloge dépendante du quartz du module.
* Pas de reprise automatique si les deux écrans ont la même adresse.

---

## 14. Questions probables du jury et réponses

**Q1. Pourquoi ne pas avoir utilisé la bibliothèque PulseSensor Playground ?**
C'est interdit par le cahier des charges, et surtout l'objectif est de maîtriser la
chaîne : filtrage, seuil, validation. Notre algorithme est testé (912 vérifications
sur signaux simulés) et chaque constante est justifiée.

**Q2. Comment garantissez-vous la fréquence d'échantillonnage ?**
Par une interruption du Timer1 (CTC, 16 MHz / 8 / 20 000 = 100 Hz) qui lance la
conversion ADC. Elle ne dépend pas de `loop()`. L'horodatage est le numéro
d'échantillon × 10 ms. Vérifiable : `analyze_csv.py` mesure fs sur une capture.

**Q3. Que se passe-t-il si `loop()` est ralentie par l'écran ?**
Les échantillons s'accumulent dans la FIFO (16 places = 160 ms) et sont traités au
tour suivant avec leur horodatage d'origine. Le rafraîchissement est découpé
(≈ 3 ms par tour). Compteurs `fifo_max` et `perdus` dans `STATUS`.

**Q4. Pourquoi 100 Hz et pas 500 Hz ?**
Le signal utile est < 5 Hz ; 100 Hz donne 10 ms de résolution, ramenée à ~1 ms par
interpolation linéaire du franchissement. Plus haut doublerait la RAM de la moyenne
glissante sans gain utile.

**Q5. Pourquoi une médiane d'IBI et non une moyenne pour le rejet ?**
Une seule valeur aberrante (battement manqué → IBI double) fausse la moyenne mais pas
la médiane : la référence de comparaison reste juste.

**Q6. Si le rythme change réellement, votre rejet à ±30 % ne bloque-t-il pas ?**
Une variation progressive passe (la médiane suit). Un changement brutal produit des
rejets : au 4e rejet consécutif, l'historique est réinitialisé et l'algorithme
s'accroche au nouveau rythme (testé 75 → 120 BPM).

**Q7. Comment évitez-vous de compter l'onde dicrote ?**
Trois protections : hystérésis (il faut redescendre sous le seuil bas), période
réfractaire de max(250 ms, ½ IBI) et rejet de l'IBI anormalement court.

**Q8. Que signifie « mesure invalide » et que fait le système ?**
Amplitude hors [10 ; 700] pas ADC, saturation, ou plus de battement accepté depuis 3 s.
Alors : `-- BPM`, `SIGNAL INVALIDE`, LED éteintes, aucun bip, enregistrement refusé
ou annulé. On n'affiche jamais un ancien BPM indéfiniment.

**Q9. Comment sont définies les « 10 mesures » de l'enregistrement ?**
Une mesure = le BPM instantané 60000/IBI d'un battement **accepté**. On en collecte
10 consécutives (≈ 10 s à 60 BPM) ; un battement rejeté remet la série à zéro ; une
perte de signal annule ; délai maximal 30 s. Le BPM moyen est la moyenne de ces 10
valeurs. L'horodatage est l'heure de l'appui.

**Q10. Que se passe-t-il au débordement de `millis()` après 49,7 jours ?**
Toutes les durées sont calculées par différence non signée `(uint32_t)(maintenant −
avant)`, juste même après le passage par zéro. Testé en démarrant la simulation
10 s avant le débordement.

**Q11. Pourquoi l'heure n'est-elle pas réglée à chaque démarrage avec `__TIME__` ?**
Ce serait l'heure de compilation : à chaque redémarrage l'horloge reculerait. Le
réglage est une procédure explicite (`SET`), la pile conserve l'heure.

**Q12. Comment avez-vous logé deux écrans dans 2 Ko de RAM ?**
Écran texte en mode caractères sans tampon, écran graphique en mode page (128 o),
envoyé bande par bande ; textes en Flash. RAM statique 1 598 o, marge de pile mesurée.

**Q13. L'échelle de temps affichée est-elle réelle ?**
Oui : 100 colonnes, chaque colonne résume exactement T échantillons (T = 2, 5, 10,
20) donc la largeur représente T secondes. Au changement d'échelle, le graphique
repart de zéro plutôt que d'afficher une échelle fausse.

**Q14. Que se passe-t-il si on coupe le courant pendant un enregistrement ?**
L'enregistrement est écrit avant le compteur, le CRC d'en-tête en dernier. Au
redémarrage, un en-tête incohérent est réparé en comptant les enregistrements dont
le CRC est valide. Les données antérieures ne sont jamais perdues.

**Q15. Vos seuils 60/100 BPM sont-ils un diagnostic ?**
Non. Ce sont des repères usuels pour un adulte au repos, configurables. Un sportif
peut être à 45 BPM au repos sans pathologie ; l'effort, l'âge, les médicaments ou
une arythmie ne sont pas pris en compte.

**Q16. Comment prouvez-vous que vos tests ne sont pas « arrangés » ?**
Les tests PC compilent **les mêmes fichiers** que le firmware ; l'émulation exécute le
**binaire réel** avec une onde PPG produite par un modèle différent de notre
générateur ; les résultats sont présentés comme simulation/émulation, et les
protocoles sur matériel sont fournis avec des colonnes à remplir.

**Q17. Quelle est la précision réelle de votre cardiofréquencemètre ?**
Elle n'est connue qu'après le protocole HW-05 (comparaison à un oxymètre sur
plusieurs personnes). Les 0,03 BPM obtenus sur signal simulé valident la logique,
pas la précision physique.

**Q18. Pourquoi avoir réécrit `tone()` ?**
`tone()` du cœur Arduino gère trois timers et n'importe quelle broche : 1,4 Ko de
Flash. Notre version utilise le même Timer2 et le même principe (interruption qui
inverse la broche, arrêt automatique), en ≈ 480 o : ≈ 0,9 Ko gagnés, qui ont
contribué à tenir dans les 32 Ko.
