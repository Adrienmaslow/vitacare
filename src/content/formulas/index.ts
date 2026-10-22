import type { Formula } from '@/types';

const r = String.raw;

/**
 * Formulaire. Chaque formule cite sa diapositive (cours) ou sa page (livret).
 * « intuition », « pitfalls » et « example » hors-PDF sont des ajouts pédagogiques ECE STUDY.
 */
export const FORMULAS: Formula[] = [
  /* ============================ COURS 0 ============================ */
  {
    id: 'f-ohm',
    name: 'Loi d’Ohm (1ʳᵉ formulation)',
    latex: r`V_{AB} = +R\,I \quad \text{(I entre par la borne +)}`,
    meaning:
      'La tension aux bornes d’une résistance est proportionnelle au courant qui la traverse. Si le courant entre par la borne « − », le signe change : V_AB = −RI.',
    variables: [
      { symbol: r`V_{AB}`, name: 'tension entre A et B', unit: 'V' },
      { symbol: 'R', name: 'résistance', unit: 'Ω' },
      { symbol: 'I', name: 'courant', unit: 'A' },
    ],
    conditions:
      'Dipôle ohmique (linéaire). Respecter le sens du courant par rapport aux bornes + et −.',
    intuition:
      'Plus on pousse fort (tension), plus le débit (courant) est grand ; R mesure la difficulté du passage.',
    example: {
      statement: 'R = 100 Ω parcourue par 20 mA entrant par la borne +.',
      solution: 'V = 100 × 0,020 = 2 V.',
    },
    pitfalls: [
      'Oublier le signe « − » quand le courant entre par la borne « − ».',
      'Utiliser des mA sans convertir en A.',
    ],
    conceptIds: ['c0-ohm'],
    source: { doc: 'cours0', pages: '6', label: 'Loi d’Ohm' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-ohm-2',
    name: 'Loi d’Ohm (2ᵉ formulation)',
    latex: r`I_{A\to B} = \dfrac{V_A - V_B}{R}`,
    meaning:
      'Le courant qui va de A vers B vaut le potentiel d’où vient le courant moins le potentiel où il va, divisé par R.',
    variables: [
      { symbol: r`V_A, V_B`, name: 'potentiels des bornes', unit: 'V' },
      { symbol: 'R', name: 'résistance', unit: 'Ω' },
    ],
    conditions:
      'Dipôle ohmique. Pas besoin de s’occuper des conventions : le signe sort tout seul.',
    intuition: 'Le courant « descend » les potentiels, comme l’eau descend une pente.',
    pitfalls: ['Inverser V_A et V_B par rapport au sens choisi pour I.'],
    conceptIds: ['c0-ohm', 'c0-noeuds-mailles'],
    source: { doc: 'cours0', pages: '6' },
    usedIn: [],
  },
  {
    id: 'f-noeuds',
    name: 'Loi des nœuds',
    latex: r`\sum I_{\text{entrants}} = \sum I_{\text{sortants}}`,
    meaning: 'En un nœud, la charge ne s’accumule pas : tout ce qui entre ressort.',
    variables: [{ symbol: 'I', name: 'courants de branche', unit: 'A' }],
    conditions: 'Régime où la charge ne s’accumule pas au nœud (toujours vrai pour un nœud idéal).',
    intuition:
      'Comme un carrefour de canalisations : le débit total entrant égale le débit sortant.',
    pitfalls: ['Mal orienter un courant puis oublier que sa valeur peut être négative.'],
    conceptIds: ['c0-kirchhoff'],
    source: { doc: 'cours0', pages: '7' },
    usedIn: [],
  },
  {
    id: 'f-mailles',
    name: 'Loi des mailles',
    latex: r`\sum_{\text{maille}} \pm V_k = 0`,
    meaning: 'En faisant le tour d’une maille, la somme algébrique des tensions est nulle.',
    variables: [{ symbol: 'V_k', name: 'tensions de la maille', unit: 'V' }],
    conditions:
      'Choisir un sens de parcours ; compter + une tension orientée dans ce sens, − sinon.',
    intuition: 'Revenir au point de départ, c’est revenir au même potentiel.',
    pitfalls: ['Mélanger le sens de parcours et le sens des flèches de tension.'],
    conceptIds: ['c0-kirchhoff'],
    source: { doc: 'cours0', pages: '7' },
    usedIn: [],
  },
  {
    id: 'f-div-tension',
    name: 'Diviseur de tension',
    latex: r`V_2 = \dfrac{R_2}{R_1 + R_2}\,V_s`,
    meaning: 'Deux résistances en série se partagent la tension proportionnellement à leur valeur.',
    variables: [
      { symbol: 'V_s', name: 'tension totale', unit: 'V' },
      { symbol: 'R_1, R_2', name: 'résistances en série', unit: 'Ω' },
      { symbol: 'V_2', name: 'tension aux bornes de R₂', unit: 'V' },
    ],
    conditions:
      'R₁ et R₂ en série : le même courant les traverse (aucun courant ne part au point milieu).',
    intuition: 'La plus grande résistance « prend » la plus grande part de la tension.',
    example: {
      statement: 'R₁ = R₂ = 100 Ω, V_s = 5 V.',
      solution: 'V₂ = 100/200 × 5 = 2,5 V (cours 1, diapo 25).',
    },
    pitfalls: [
      'Appliquer la formule alors qu’une charge est branchée au point milieu (cf. suiveur, cours 1 diapo 33).',
    ],
    conceptIds: ['c0-diviseurs'],
    source: { doc: 'cours0', pages: '9' },
    usedIn: [],
  },
  {
    id: 'f-div-courant',
    name: 'Diviseur de courant',
    latex: r`i_2 = \dfrac{R_1}{R_1 + R_2}\,i_0`,
    meaning:
      'Deux résistances en parallèle se partagent le courant : la plus petite résistance reçoit le plus grand courant.',
    variables: [
      { symbol: 'i_0', name: 'courant total', unit: 'A' },
      { symbol: 'i_2', name: 'courant dans R₂', unit: 'A' },
    ],
    conditions: 'R₁ et R₂ en parallèle.',
    intuition:
      'Le courant préfère le chemin le plus facile — attention, au numérateur on trouve l’AUTRE résistance.',
    pitfalls: ['Mettre R₂ au numérateur (confusion avec le diviseur de tension).'],
    conceptIds: ['c0-diviseurs'],
    source: { doc: 'cours0', pages: '9' },
    usedIn: [],
  },
  {
    id: 'f-millman',
    name: 'Théorème de Millman',
    latex: r`V_A = \dfrac{\sum_k \frac{V_k}{R_k} + \sum_j i_j}{\sum_k \frac{1}{R_k}}`,
    meaning:
      'Potentiel d’un nœud A relié par des résistances R_k à des nœuds de potentiels V_k, et alimenté par des sources de courant i_j.',
    variables: [
      { symbol: 'V_k', name: 'potentiels des nœuds voisins', unit: 'V' },
      { symbol: 'R_k', name: 'résistances reliant A à ces nœuds', unit: 'Ω' },
      { symbol: 'i_j', name: 'courants de source entrant en A', unit: 'A' },
    ],
    conditions: 'Circuit linéaire. Les sources de courant n’apparaissent pas au dénominateur.',
    intuition: 'Une moyenne pondérée des potentiels voisins, pondérée par les conductances.',
    pitfalls: ['Ajouter 1/R d’une branche contenant une source de courant au dénominateur.'],
    conceptIds: ['c0-superposition-millman'],
    source: { doc: 'cours0', pages: '19-20' },
    usedIn: [],
  },
  {
    id: 'f-thevenin-norton',
    name: 'Équivalence Thévenin ↔ Norton',
    latex: r`V_{Th} = R_N\,I_N, \qquad R_{Th} = R_N`,
    meaning:
      'Un générateur de tension V_Th en série avec R_Th équivaut à un générateur de courant I_N en parallèle avec R_N.',
    variables: [
      { symbol: 'V_{Th}', name: 'tension de Thévenin (tension à vide)', unit: 'V' },
      { symbol: 'I_N', name: 'courant de Norton (courant de court-circuit)', unit: 'A' },
      { symbol: 'R_{Th}=R_N', name: 'résistance vue, sources éteintes', unit: 'Ω' },
    ],
    conditions: 'Circuit linéaire, étudié sans la charge.',
    intuition: 'Deux façons de décrire la même « boîte noire » vue de ses bornes.',
    pitfalls: [
      'Éteindre une source de courant en la remplaçant par un fil (c’est un circuit ouvert).',
    ],
    conceptIds: ['c0-transfo', 'c0-thevenin-norton'],
    source: { doc: 'cours0', pages: '4, 21, 25' },
    usedIn: [],
  },
  {
    id: 'f-aop-inverseur',
    name: 'AOP : montage inverseur',
    latex: r`V_{out} = -\dfrac{R_f}{R_1}\,V_{in}`,
    meaning: 'Amplifie et inverse la tension d’entrée.',
    variables: [
      { symbol: 'R_f', name: 'résistance de contre-réaction', unit: 'Ω' },
      { symbol: 'R_1', name: 'résistance d’entrée', unit: 'Ω' },
    ],
    conditions: 'AOP idéal en régime linéaire (contre-réaction sur l’entrée −), pas de saturation.',
    intuition: 'L’entrée − est une masse virtuelle : tout le courant de R₁ passe dans R_f.',
    pitfalls: ['Oublier le signe −.'],
    conceptIds: ['c0-aop'],
    source: { doc: 'cours0', pages: '33' },
    usedIn: [],
  },
  {
    id: 'f-aop-non-inverseur',
    name: 'AOP : montage non inverseur',
    latex: r`V_{out} = \left(1 + \dfrac{R_f}{R_1}\right) V_{in}`,
    meaning: 'Amplifie sans inverser, avec un gain toujours ≥ 1.',
    variables: [
      { symbol: 'R_f', name: 'résistance de contre-réaction', unit: 'Ω' },
      { symbol: 'R_1', name: 'résistance vers la masse', unit: 'Ω' },
    ],
    conditions: 'AOP idéal, régime linéaire.',
    intuition: 'V⁻ suit V⁺ = V_in ; V⁻ est obtenu par un diviseur de V_out.',
    pitfalls: [
      'Dans le cours 1 (diapo 25), R₁ est la résistance de contre-réaction : (1 + R₁/R₂). Bien identifier qui est où.',
    ],
    conceptIds: ['c0-aop'],
    source: { doc: 'cours0', pages: '34' },
    usedIn: [],
  },
  {
    id: 'f-aop-autres',
    name: 'AOP : suiveur, sommateur, soustracteur',
    latex: r`V_{out}=V_{in};\quad V_{out}=-R_f\!\left(\tfrac{V_1}{R_1}+\tfrac{V_2}{R_2}\right);\quad V_{out}=\tfrac{R_2}{R_1}(V_2-V_1)`,
    meaning: 'Suiveur (adaptation d’impédance), additionneur inverseur, soustracteur.',
    variables: [{ symbol: 'V_1, V_2', name: 'tensions d’entrée', unit: 'V' }],
    conditions:
      'AOP idéal en régime linéaire ; pour le soustracteur, résistances appariées comme sur la diapo 35.',
    intuition:
      'Le suiveur ne consomme aucun courant en entrée : il « recopie » une tension sans la perturber.',
    pitfalls: ['Croire que le suiveur amplifie : son gain vaut 1.'],
    conceptIds: ['c0-aop'],
    source: { doc: 'cours0', pages: '32, 35' },
    usedIn: [],
  },

  /* ============================ COURS 1 ============================ */
  {
    id: 'f-champ',
    name: 'Champ électrique dans un conducteur',
    latex: r`E = \dfrac{u}{\ell}`,
    meaning:
      'Une tension u appliquée sur une longueur ℓ crée un champ uniforme, orienté vers les potentiels décroissants.',
    variables: [
      { symbol: 'u', name: 'tension appliquée', unit: 'V' },
      { symbol: r`\ell`, name: 'longueur (ou épaisseur) du conducteur', unit: 'm' },
      { symbol: 'E', name: 'norme du champ électrique', unit: 'V/m' },
    ],
    conditions: 'Conducteur homogène de section constante (champ uniforme).',
    intuition: 'La tension est la « pente » totale ; le champ est la pente par mètre.',
    example: {
      statement: 'U = 1 V sur une épaisseur e = 4 mm (livret, AD1.4).',
      solution: 'E = 1/0,004 = 250 V/m.',
    },
    pitfalls: ['Laisser ℓ en mm ou en cm.'],
    conceptIds: ['c1-champ'],
    source: { doc: 'cours1', pages: '6, 9' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-coulomb-courant',
    name: 'Force électrique et intensité',
    latex: r`\vec F = q\vec E = -e\vec E, \qquad i = \dfrac{dq}{dt}`,
    meaning:
      'Les électrons subissent une force opposée au champ ; le courant est le débit de charge.',
    variables: [
      { symbol: 'q', name: 'charge', unit: 'C' },
      { symbol: 'e', name: 'charge élémentaire 1,6·10⁻¹⁹', unit: 'C' },
      { symbol: 'i', name: 'intensité', unit: 'A' },
    ],
    conditions: 'Toujours valable.',
    intuition:
      'Un ampère = un coulomb qui passe chaque seconde, soit ≈ 6,25·10¹⁸ électrons par seconde.',
    pitfalls: [
      'Confondre le sens de déplacement des électrons et le sens conventionnel du courant.',
    ],
    conceptIds: ['c1-champ'],
    source: { doc: 'cours1', pages: '4' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-drude',
    name: 'Vitesse de dérive (modèle de Drude)',
    latex: r`\vec v = \dfrac{q\tau}{m}\vec E \;\Rightarrow\; \vec v = -\mu\vec E, \quad \mu = \dfrac{e\tau}{m}`,
    meaning:
      'En régime permanent, les électrons avancent à vitesse moyenne constante, opposée au champ, proportionnelle à E.',
    variables: [
      { symbol: r`\tau`, name: 'temps moyen entre collisions (≈ 3·10⁻¹⁴ s)', unit: 's' },
      { symbol: 'm', name: 'masse de l’électron 9,1·10⁻³¹', unit: 'kg' },
      { symbol: r`\mu`, name: 'mobilité', unit: 'm²/(V·s)' },
      { symbol: 'v', name: 'vitesse de dérive', unit: 'm/s' },
    ],
    conditions:
      'Régime permanent atteint (t > 5τ). Modèle classique simplifié des électrons libres d’un métal.',
    intuition:
      'Comme une bille dans du miel : la force électrique est compensée par un frottement, d’où une vitesse limite.',
    example: {
      statement: 'Fil de cuivre ℓ = 10 m, u = 10 V (cours 1, diapo 9).',
      solution: 'v = eτ/m · u/ℓ ≈ 5·10⁻³ m/s = 5 mm/s.',
    },
    pitfalls: [
      'Confondre vitesse de dérive (mm/s) et vitesse d’agitation thermique (≈ 10⁶ m/s).',
      'Oublier que v est opposée à E pour les électrons.',
    ],
    conceptIds: ['c1-derive'],
    source: { doc: 'cours1', pages: '7-9' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-densite',
    name: 'Vecteur densité de courant',
    latex: r`\vec j = \rho_m \vec v = -ne\,\vec v, \qquad i = \iint_S \vec j\cdot d\vec S`,
    meaning: 'Courant par unité de surface. Pour une section S traversée uniformément : i = jS.',
    variables: [
      { symbol: 'n', name: 'porteurs par unité de volume', unit: 'm⁻³' },
      { symbol: r`\rho_m`, name: 'densité volumique de charge mobile', unit: 'C/m³' },
      { symbol: 'j', name: 'densité de courant', unit: 'A/m²' },
    ],
    conditions: 'j uniforme sur la section pour écrire i = jS.',
    intuition:
      'Nombre de charges × charge × vitesse : combien de coulombs traversent 1 m² chaque seconde.',
    pitfalls: ['Confondre la densité volumique de charge ρ_m avec la résistivité ρ.'],
    conceptIds: ['c1-densite'],
    source: { doc: 'cours1', pages: '10-11' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-ohm-locale',
    name: 'Loi d’Ohm locale',
    latex: r`\vec j = \gamma\,\vec E, \qquad \gamma = \dfrac{n e^2 \tau}{m}`,
    meaning:
      'Dans un conducteur, la densité de courant est proportionnelle au champ ; la conductivité γ (aussi notée σ) caractérise le matériau.',
    variables: [
      { symbol: r`\gamma\ (\sigma)`, name: 'conductivité', unit: 'S/m = Ω⁻¹·m⁻¹' },
      { symbol: 'E', name: 'champ électrique', unit: 'V/m' },
    ],
    conditions: 'Matériau ohmique, homogène.',
    intuition: 'Version « microscopique » de U = RI.',
    example: {
      statement: 'Cuivre : γ = 59,6·10⁶ S/m ; KCl à 1 mol/L : 10,2 S/m (cours 1, diapo 12).',
      solution: 'Le métal conduit environ 6 millions de fois mieux.',
    },
    pitfalls: ['Unités : S/m et non S·m.'],
    conceptIds: ['c1-ohm-locale'],
    source: { doc: 'cours1', pages: '12' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-resistance',
    name: 'Résistance d’un conducteur',
    latex: r`R = \dfrac{1}{\gamma}\dfrac{\ell}{S} = \rho\,\dfrac{\ell}{S}, \qquad \rho = \dfrac{1}{\gamma}`,
    meaning: 'La résistance dépend du matériau (ρ) et de la géométrie (longueur ℓ, section S).',
    variables: [
      { symbol: r`\rho`, name: 'résistivité', unit: 'Ω·m' },
      { symbol: r`\ell`, name: 'longueur', unit: 'm' },
      { symbol: 'S', name: 'section', unit: 'm²' },
      { symbol: 'R', name: 'résistance', unit: 'Ω' },
    ],
    conditions: 'Conducteur homogène, section constante, courant uniformément réparti.',
    intuition:
      'Un fil deux fois plus long résiste deux fois plus ; deux fois plus large en section, deux fois moins.',
    example: {
      statement: 'Fil de carbone ℓ = 10 cm, r = 0,2 mm, γ = 2,5·10⁴ S/m (cours 1, diapo 15).',
      solution: 'R = 0,1 / (2,5·10⁴ × π × (2·10⁻⁴)²) ≈ 31,8 Ω.',
    },
    pitfalls: [
      'ℓ en m et S en m² (ou tout en cm si ρ est en Ω·cm).',
      'Utiliser le diamètre au lieu du rayon dans S = πr².',
    ],
    conceptIds: ['c1-resistivite'],
    source: { doc: 'cours1', pages: '13, 15' },
    usedIn: ['TD1', 'TD2'],
    explorer: 'resistance',
  },
  {
    id: 'f-matthiessen',
    name: 'Résistivité et température (Matthiessen)',
    latex: r`\rho(T) = \rho_0\,[1 + \alpha\,(T - T_0)]`,
    meaning: 'La résistivité d’un métal croît avec la température.',
    variables: [
      { symbol: r`\rho_0`, name: 'résistivité à T₀', unit: 'Ω·m' },
      { symbol: r`\alpha`, name: 'coefficient empirique', unit: 'K⁻¹' },
      { symbol: 'T', name: 'température', unit: 'K ou °C (écart)' },
    ],
    conditions: 'Conducteurs, modèle linéaire autour de T₀.',
    intuition: 'Plus les atomes vibrent, plus les électrons sont gênés.',
    pitfalls: [
      'Pour un isolant ou un semi-conducteur, la tendance est inverse (la résistance diminue).',
    ],
    conceptIds: ['c1-temperature'],
    source: { doc: 'cours1', pages: '24' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-impuretes',
    name: 'Résistivité d’un métal impur',
    latex: r`\rho = \rho_0 + \Delta\rho = \dfrac{1}{\sigma_0} + \sum \Delta\rho_{\text{impureté}}`,
    meaning: 'Chaque impureté ajoute sa contribution à la résistivité du métal pur.',
    variables: [
      { symbol: r`\sigma_0`, name: 'conductivité du métal pur', unit: 'Ω⁻¹·cm⁻¹' },
      { symbol: r`\Delta\rho`, name: 'augmentation due aux impuretés', unit: 'µΩ·cm' },
    ],
    conditions: 'Faibles concentrations d’impuretés (contributions additives).',
    intuition: 'Chaque atome étranger est un obstacle supplémentaire pour les électrons.',
    example: {
      statement: 'Cuivre commercial (livret, AD1.2).',
      solution: 'ρ = 1,675 + 0,17 = 1,845 µΩ·cm.',
    },
    pitfalls: ['Additionner des conductivités au lieu des résistivités.'],
    conceptIds: ['c1-temperature'],
    source: { doc: 'livret', pages: '6-7', label: 'Exercice 1.2' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-condensateur',
    name: 'Condensateur : définition et relation courant-tension',
    latex: r`C = \dfrac{q}{u}, \qquad i = C\,\dfrac{du}{dt}`,
    meaning: 'La capacité mesure la charge stockée par volt appliqué.',
    variables: [
      { symbol: 'C', name: 'capacité', unit: 'F' },
      { symbol: 'q', name: 'charge d’une armature', unit: 'C' },
      { symbol: 'u', name: 'tension', unit: 'V' },
    ],
    conditions: 'Condensateur idéal (convention récepteur pour i = C du/dt).',
    intuition: 'Un réservoir de charges : à tension constante, aucun courant ne le traverse.',
    pitfalls: ['Le farad est énorme : les valeurs usuelles sont en pF, nF, µF.'],
    conceptIds: ['c1-condensateur'],
    source: { doc: 'cours1', pages: '39' },
    usedIn: ['TD1'],
  },
  {
    id: 'f-condensateur-plan',
    name: 'Capacité d’un condensateur plan',
    latex: r`C = \varepsilon\,\dfrac{S}{d} = \varepsilon_0\varepsilon_r\,\dfrac{S}{d}`,
    meaning: 'La capacité augmente avec la surface des armatures et diminue avec leur écartement.',
    variables: [
      { symbol: r`\varepsilon_0`, name: 'permittivité du vide 8,85·10⁻¹²', unit: 'F/m' },
      {
        symbol: r`\varepsilon_r`,
        name: 'permittivité relative du diélectrique',
        unit: 'sans unité',
      },
      { symbol: 'S', name: 'surface en regard', unit: 'm²' },
      { symbol: 'd', name: 'distance entre armatures', unit: 'm' },
    ],
    conditions:
      'Armatures planes, parallèles, d petit devant les dimensions (effets de bord négligés).',
    intuition: 'Plus les plaques sont grandes et proches, plus elles « s’attirent » de charges.',
    example: {
      statement: 'S = 900 mm², d = 2 mm, vide (livret, Q1.7).',
      solution: 'C = 8,85·10⁻¹² × 9·10⁻⁴ / 2·10⁻³ ≈ 3,98 pF.',
    },
    pitfalls: [
      'mm² → m² : multiplier par 10⁻⁶, pas 10⁻³.',
      'Oublier ε_r quand un diélectrique remplit l’espace.',
    ],
    conceptIds: ['c1-condensateur'],
    source: { doc: 'cours1', pages: '39' },
    usedIn: ['TD1'],
    explorer: 'capacitor',
  },
  {
    id: 'f-coupure',
    name: 'Fréquence de coupure RC et impédance',
    latex: r`f_c = \dfrac{1}{2\pi RC}, \qquad Z_C = \dfrac{1}{jC\omega},\ |Z_C| = \dfrac{1}{2\pi f C}`,
    meaning: 'Le condensateur laisse passer d’autant mieux le signal que la fréquence est élevée.',
    variables: [
      { symbol: 'f', name: 'fréquence', unit: 'Hz' },
      { symbol: r`\omega = 2\pi f`, name: 'pulsation', unit: 'rad/s' },
    ],
    conditions: 'Condensateur idéal (le modèle réel présente R_ESR et L_ESL).',
    intuition: 'Aux hautes fréquences, un condensateur se comporte presque comme un fil.',
    pitfalls: ['Confondre f et ω (facteur 2π).'],
    conceptIds: ['c1-condensateur-usages'],
    source: { doc: 'cours1', pages: '40, 49' },
    usedIn: [],
  },
  {
    id: 'f-potentiometre',
    name: 'Potentiomètre',
    latex: r`R_1 = \dfrac{\ell_1}{\ell_{MAX}}R_{MAX},\quad R_2 = \dfrac{\ell_2}{\ell_{MAX}}R_{MAX},\quad v_{OUT} = \dfrac{R_2}{R_1+R_2}V_{CC}`,
    meaning:
      'Le curseur partage la piste résistive en deux : c’est un diviseur de tension réglable.',
    variables: [
      { symbol: 'R_{MAX}', name: 'résistance totale de la piste', unit: 'Ω' },
      {
        symbol: r`\ell_1, \ell_2`,
        name: 'longueurs de piste de part et d’autre du curseur',
        unit: 'm',
      },
    ],
    conditions:
      'Piste homogène (R ∝ ℓ) ; pas de charge sur la sortie (sinon, utiliser un suiveur).',
    intuition: 'R = ρℓ/S appliqué à une piste dont on choisit la longueur.',
    pitfalls: ['Oublier l’effet de la charge en sortie (cours 1, diapo 33 : 2,5 V → 0,42 V).'],
    conceptIds: ['c1-composants'],
    source: { doc: 'cours1', pages: '31-33' },
    usedIn: [],
  },

  /* ============================ COURS 2 ============================ */
  {
    id: 'f-thermique',
    name: 'Énergie thermique (équipartition)',
    latex: r`E_{Th} = \langle E_C\rangle = \dfrac{3}{2}\,k_B T`,
    meaning:
      'Énergie cinétique moyenne de vibration d’un atome (3 degrés de liberté de translation × ½k_BT).',
    variables: [
      { symbol: 'k_B', name: 'constante de Boltzmann 1,38·10⁻²³', unit: 'J/K' },
      { symbol: 'T', name: 'température absolue', unit: 'K' },
    ],
    conditions: 'Équilibre thermique.',
    intuition: 'La température mesure, à un facteur près, l’agitation moyenne des particules.',
    pitfalls: ['T en kelvins : T(K) = θ(°C) + 273,15.'],
    conceptIds: ['c2-thermique'],
    source: { doc: 'cours2', pages: '7-8' },
    usedIn: [],
  },
  {
    id: 'f-photon',
    name: 'Énergie d’un photon',
    latex: r`E_\nu = \dfrac{hc}{\lambda} \geq E_g \iff \lambda \leq \dfrac{hc}{E_g}`,
    meaning:
      'Un photon peut faire passer un électron de la bande de valence à la bande de conduction si son énergie dépasse le gap.',
    variables: [
      { symbol: 'h', name: 'constante de Planck 6,63·10⁻³⁴', unit: 'J·s' },
      { symbol: 'c', name: 'vitesse de la lumière 3·10⁸', unit: 'm/s' },
      { symbol: r`\lambda`, name: 'longueur d’onde', unit: 'm' },
      { symbol: 'E_g', name: 'énergie de gap', unit: 'J (1 eV = 1,6·10⁻¹⁹ J)' },
    ],
    conditions: 'Absorption d’un photon par un électron de la bande de valence.',
    intuition: 'Plus la longueur d’onde est courte (bleu), plus le photon est énergétique.',
    example: {
      statement: 'Silicium E_g = 1,12 eV (livret, AD2.5).',
      solution: 'λ ≤ 6,63·10⁻³⁴ × 3·10⁸ / (1,12 × 1,6·10⁻¹⁹) ≈ 1,1 µm.',
    },
    pitfalls: ['Oublier de convertir les eV en J.'],
    conceptIds: ['c2-photon'],
    source: { doc: 'livret', pages: '10-11', label: 'Exercice 2.2' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-denombrement',
    name: 'Nombre d’atomes par unité de volume',
    latex: r`N = \dfrac{\mathcal{N}_A\,\rho_{\text{masse}}}{M}`,
    meaning:
      'Nombre d’atomes dans 1 cm³ (si ρ en g/cm³) à partir de la masse volumique et de la masse molaire.',
    variables: [
      { symbol: r`\mathcal{N}_A`, name: 'nombre d’Avogadro 6,02·10²³', unit: 'mol⁻¹' },
      { symbol: r`\rho_{\text{masse}}`, name: 'masse volumique', unit: 'g/cm³' },
      { symbol: 'M', name: 'masse molaire', unit: 'g/mol' },
    ],
    conditions: 'Matériau pur, homogène.',
    intuition:
      'Masse de 1 cm³ ÷ masse d’une mole = nombre de moles ; × Avogadro = nombre d’atomes.',
    example: {
      statement: 'Silicium ρ = 2,33 g/cm³, M = 28,086 g/mol (livret, ES2.8).',
      solution: 'N ≈ 5·10²² atomes/cm³.',
    },
    pitfalls: ['Mélanger kg/m³ et g/cm³ (2,33·10³ kg/m³ = 2,33 g/cm³).'],
    conceptIds: ['c2-denombrement'],
    source: { doc: 'livret', pages: '16, 18', label: 'Exercices 2.7 et 2.9' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-ni',
    name: 'Concentration intrinsèque',
    latex: r`n_i = A\,T^{3/2}\,e^{-\frac{1}{2}\frac{E_g}{k_B T}}`,
    meaning:
      'Nombre de paires électron-trou créées par agitation thermique dans un semi-conducteur pur.',
    variables: [
      { symbol: 'A', name: 'constante du matériau', unit: 'm⁻³·K⁻³ᐟ² (si n_i en m⁻³)' },
      { symbol: 'E_g', name: 'gap', unit: 'J' },
      { symbol: 'T', name: 'température', unit: 'K' },
    ],
    conditions: 'Semi-conducteur intrinsèque (non dopé), équilibre thermodynamique.',
    intuition:
      'Le terme exponentiel domine : n_i explose quand T augmente ou quand le gap diminue.',
    pitfalls: ['Le facteur ½ dans l’exponentielle.', 'T en kelvins.'],
    conceptIds: ['c2-intrinseque'],
    source: { doc: 'cours2', pages: '22' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-action-masse',
    name: 'Loi d’action de masse',
    latex: r`n\,p = n_i^2`,
    meaning:
      'À l’équilibre, le produit des concentrations d’électrons et de trous ne dépend que du matériau et de T.',
    variables: [
      { symbol: 'n', name: 'concentration en électrons (bande de conduction)', unit: 'cm⁻³' },
      { symbol: 'p', name: 'concentration en trous (bande de valence)', unit: 'cm⁻³' },
      { symbol: 'n_i', name: 'concentration intrinsèque', unit: 'cm⁻³' },
    ],
    conditions:
      'Équilibre thermodynamique (pas de courant, T uniforme). Non valable sous éclairement (cf. ES2.2).',
    intuition:
      'Ajouter des électrons favorise les recombinaisons : les trous se raréfient d’autant.',
    pitfalls: ['Garder la même unité (cm⁻³ ou m⁻³) pour n, p et n_i.'],
    conceptIds: ['c2-action-masse'],
    source: { doc: 'cours2', pages: '20-21' },
    usedIn: ['TD2'],
    explorer: 'mass-action',
  },
  {
    id: 'f-dopage-n',
    name: 'Semi-conducteur dopé N',
    latex: r`n \approx N_D, \qquad p = \dfrac{n_i^2}{N_D}`,
    meaning:
      'Si N_D ≫ n_i, les électrons sont majoritaires et leur concentration vaut celle des donneurs.',
    variables: [{ symbol: 'N_D', name: 'concentration en atomes donneurs', unit: 'cm⁻³' }],
    conditions: 'Tous les donneurs ionisés, N_D ≫ n_i.',
    intuition: 'Chaque atome de la colonne 15 fournit un électron libre.',
    example: {
      statement: 'Si : n_i = 1,5·10¹⁰ cm⁻³, N_D = 10¹⁷ cm⁻³ (cours 2, diapo 23).',
      solution: 'n = 10¹⁷ cm⁻³ ; p = 2,25·10³ cm⁻³ (le support arrondit à 10³).',
    },
    pitfalls: ['Oublier de vérifier N_D ≫ n_i avant l’approximation.'],
    conceptIds: ['c2-action-masse', 'c2-dopage'],
    source: { doc: 'cours2', pages: '23' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-dopage-p',
    name: 'Semi-conducteur dopé P',
    latex: r`p \approx N_A, \qquad n = \dfrac{n_i^2}{N_A}`,
    meaning:
      'Si N_A ≫ n_i, les trous sont majoritaires et leur concentration vaut celle des accepteurs.',
    variables: [{ symbol: 'N_A', name: 'concentration en atomes accepteurs', unit: 'cm⁻³' }],
    conditions: 'Tous les accepteurs ionisés, N_A ≫ n_i.',
    intuition: 'Chaque atome de la colonne 13 crée un trou.',
    example: {
      statement: 'Si : n_i = 1,5·10¹⁰ cm⁻³, N_A = 10¹⁶ cm⁻³ (cours 2, diapo 24).',
      solution: 'p = 10¹⁶ cm⁻³ ; n = 2,25·10⁴ cm⁻³ (le support arrondit à 10⁴).',
    },
    pitfalls: ['Confondre N_A (accepteurs) et 𝒩_A (Avogadro).'],
    conceptIds: ['c2-action-masse', 'c2-dopage'],
    source: { doc: 'cours2', pages: '24' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-conductivite-sc',
    name: 'Conductivité d’un semi-conducteur',
    latex: r`\gamma_{sc} = e\,(n\mu_n + p\mu_p), \qquad \rho_{sc} = \dfrac{1}{\gamma_{sc}}`,
    meaning: 'Électrons et trous contribuent tous deux au courant de conduction.',
    variables: [
      { symbol: r`\mu_n, \mu_p`, name: 'mobilités des électrons et des trous', unit: 'm²/(V·s)' },
      { symbol: 'n, p', name: 'concentrations', unit: 'm⁻³' },
      { symbol: r`\gamma_{sc}`, name: 'conductivité', unit: 'S/m' },
    ],
    conditions:
      'Champ faible (mobilités constantes). Si un type de porteur domine, on néglige l’autre.',
    intuition: 'Nombre de porteurs × aptitude à se déplacer, pour chaque type de porteur.',
    example: {
      statement: 'Ge dopé N_D = 4,4·10²² m⁻³, μ_n = 0,40 m²/(V·s) (livret, AD2.12).',
      solution: 'γ ≈ N_D e μ_n ≈ 2,8·10³ S/m.',
    },
    pitfalls: ['Mélanger cm⁻³ et m²/(V·s) : convertir tout en SI (ou tout en cm).'],
    conceptIds: ['c2-conduction-sc'],
    source: { doc: 'cours2', pages: '27-28' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-vitesses-sc',
    name: 'Vitesses des électrons et des trous',
    latex: r`\vec v_n = -\mu_n\vec E, \qquad \vec v_p = \mu_p\vec E`,
    meaning:
      'Les électrons vont à l’opposé du champ, les trous dans le sens du champ ; les deux courants s’ajoutent.',
    variables: [{ symbol: r`\mu_n,\mu_p`, name: 'mobilités (positives)', unit: 'm²/(V·s)' }],
    conditions: 'Champ faible.',
    intuition: 'Charges opposées, mouvements opposés, mais courants dans le même sens.',
    pitfalls: ['Penser que les courants d’électrons et de trous se compensent.'],
    conceptIds: ['c2-conduction-sc'],
    source: { doc: 'cours2', pages: '27' },
    usedIn: ['TD2'],
  },
  {
    id: 'f-fick',
    name: 'Courant de diffusion (loi de Fick)',
    latex: r`\vec j_d = e D_n\,\overrightarrow{\mathrm{grad}}\,n - e D_p\,\overrightarrow{\mathrm{grad}}\,p`,
    meaning:
      'Les porteurs se déplacent des zones concentrées vers les zones peu concentrées, même sans champ.',
    variables: [{ symbol: 'D_n, D_p', name: 'coefficients de diffusion', unit: 'cm²/s' }],
    conditions: 'Gradient de concentration.',
    intuition: 'Une goutte de colorant qui s’étale dans l’eau calme.',
    pitfalls: [
      'Signes : le courant de diffusion des électrons et celui des trous sont opposés pour des gradients de même sens.',
    ],
    conceptIds: ['c2-diffusion'],
    source: { doc: 'cours2', pages: '29-30' },
    usedIn: [],
  },
  {
    id: 'f-einstein',
    name: 'Relation d’Einstein',
    latex: r`\dfrac{D_n}{\mu_n} = \dfrac{D_p}{\mu_p} = \dfrac{k_B T}{q}`,
    meaning: 'Diffusion et mobilité ont la même origine physique (l’agitation thermique).',
    variables: [{ symbol: r`k_BT/q`, name: 'potentiel thermique (≈ 25 mV à 20 °C)', unit: 'V' }],
    conditions: 'Champs faibles, équilibre thermique.',
    intuition: 'Un porteur mobile diffuse aussi facilement.',
    example: {
      statement: 'Si, μ_n = 1000 cm²/(V·s), μ_p = 400 cm²/(V·s) (cours 2, diapo 31).',
      solution: 'D_n = 25 cm²/s, D_p = 10 cm²/s.',
    },
    pitfalls: ['Unités : si μ en cm²/(V·s), D est en cm²/s.'],
    conceptIds: ['c2-diffusion'],
    source: { doc: 'cours2', pages: '31' },
    usedIn: [],
  },
  {
    id: 'f-barriere',
    name: 'Barrière de potentiel de la jonction PN',
    latex: r`V_0 = \dfrac{k_B T}{e}\,\ln\!\left(\dfrac{N_A N_D}{n_i^2}\right)`,
    meaning: 'Différence de potentiel qui s’établit à l’équilibre entre la zone N et la zone P.',
    variables: [
      { symbol: 'N_A', name: 'accepteurs (côté P)', unit: 'cm⁻³' },
      { symbol: 'N_D', name: 'donneurs (côté N)', unit: 'cm⁻³' },
      { symbol: r`k_BT/e`, name: '≈ 0,026 V à l’ambiante', unit: 'V' },
    ],
    conditions: 'Jonction à l’équilibre (non polarisée).',
    intuition:
      'Plus on dope, plus la différence entre les deux zones est marquée, plus la barrière est haute.',
    example: {
      statement: 'Si : N_A = 10¹⁶, N_D = 10¹⁷ cm⁻³, n_i = 1,5·10¹⁰ cm⁻³ (cours 2, diapo 37).',
      solution: 'V₀ = 0,026 ln(10³³/2,25·10²⁰) ≈ 0,76 V.',
    },
    pitfalls: [
      'Le support inverse les exemples dans son rappel (diapo 36) : N_A = accepteurs (bore, type P), N_D = donneurs (phosphore, type N).',
    ],
    conceptIds: ['c2-jonction'],
    source: { doc: 'cours2', pages: '36-37' },
    usedIn: [],
    explorer: 'barrier',
  },
  {
    id: 'f-shockley',
    name: 'Relation de Shockley',
    latex: r`I_D = I_S\left(e^{\frac{e U_D}{\eta k_B T}} - 1\right)`,
    meaning:
      'Courant dans une jonction PN en fonction de la tension appliquée (positive en direct, négative en inverse).',
    variables: [
      { symbol: 'I_S', name: 'courant inverse de saturation', unit: 'A' },
      { symbol: r`\eta`, name: 'coefficient entre 1 et 2 selon le matériau', unit: 'sans unité' },
      { symbol: 'U_D', name: 'tension aux bornes', unit: 'V' },
    ],
    conditions: 'Hors zone de claquage (tension inverse inférieure à la tension de rupture).',
    intuition: 'En direct, le courant croît exponentiellement ; en inverse, il plafonne à −I_S.',
    pitfalls: ['En inverse, I_D ≈ −I_S (pas zéro exactement).'],
    conceptIds: ['c2-polarisation'],
    source: { doc: 'cours2', pages: '42-43' },
    usedIn: [],
  },
  {
    id: 'f-photogeneration',
    name: 'Porteurs créés par éclairement',
    latex: r`n = p = G \times \tau_{vie}`,
    meaning:
      'En régime permanent, le nombre de paires présentes vaut le taux de création multiplié par leur durée de vie.',
    variables: [
      { symbol: 'G', name: 'paires créées par seconde et par cm³', unit: 'cm⁻³·s⁻¹' },
      { symbol: r`\tau_{vie}`, name: 'durée de vie des porteurs', unit: 's' },
    ],
    conditions: 'Éclairement uniforme et constant ; paires très nombreuses devant le dopage.',
    intuition: 'Un robinet (création) et une fuite (recombinaison) : le niveau se stabilise.',
    example: {
      statement: 'G = 5·10²² cm⁻³·s⁻¹, τ = 1 µs (livret, ES2.2).',
      solution: 'n = p = 5·10¹⁶ cm⁻³.',
    },
    pitfalls: ['Appliquer np = n_i² hors équilibre.'],
    conceptIds: ['c2-photon'],
    source: { doc: 'livret', pages: '15', label: 'Exercice 2.6' },
    usedIn: ['TD2'],
  },
];

export const formulaById = (id: string) => FORMULAS.find((f) => f.id === id);
