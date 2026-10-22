import type { Exercise } from '@/types';
import { mcq, num } from '../quizzes/helpers';
import { part } from './helpers';

const r = String.raw;
const L = (pages: string, label?: string) => ({ doc: 'livret' as const, pages, label });

/**
 * TD1 — Résistivité et capacité (livret, p. 5 à 9).
 * Énoncés reformulés fidèlement (dépôt public) : toutes les données numériques sont conservées.
 * Corrections : celles du livret quand elles existent (rédaction propre à ECE STUDY, résultats
 * vérifiés par recalcul), sinon corrections calculées par ECE STUDY (signalées).
 */
export const TD1: Exercise[] = [
  {
    id: 'td1-ex1-1',
    td: 'TD1',
    section: 'Applications directes',
    number: '1.1',
    title: 'Choix d’un matériau',
    statement:
      'Une ligne électrique de longueur ℓ doit relier deux villes en limitant au maximum les pertes par effet Joule. La masse de métal utilisée est imposée (constante). On hésite entre le cuivre et l’aluminium.',
    data: [
      {
        label: 'Aluminium (20 °C)',
        value: r`$m_0 = 2{,}7\ \text{g/cm}^3$, $\rho = 2{,}85\ \mu\Omega\cdot\text{cm}$`,
      },
      {
        label: 'Cuivre (20 °C)',
        value: r`$m_0 = 8{,}96\ \text{g/cm}^3$, $\rho = 1{,}73\ \mu\Omega\cdot\text{cm}$`,
      },
      {
        label: 'Notation',
        value: r`$m_0$ : masse volumique (pour ne pas la confondre avec la résistivité $\rho$)`,
      },
    ],
    objective: 'Comparer deux conducteurs à masse égale plutôt qu’à section égale.',
    skills: [
      'Exprimer une contrainte (masse constante)',
      'Utiliser R = ρℓ/S',
      'Raisonner par identification',
    ],
    prerequisiteLessonIds: ['c1-l4'],
    conceptIds: ['c1-resistivite'],
    difficulty: 2,
    source: L('5-6', 'Exercice 1.1'),
    parts: [
      part({
        id: 'AD1.1',
        prompt: 'Quel matériau, du cuivre ou de l’aluminium, est préférable pour cette ligne ?',
        question: mcq({
          id: 'ex-AD1.1',
          concepts: ['c1-resistivite'],
          difficulty: 2,
          prompt: 'Quel matériau choisir, à masse de métal imposée ?',
          choices: [
            [
              'L’aluminium',
              r`Oui : le produit $\rho m_0$ est le plus faible (7,69 contre 15,5 µΩ·g/cm²).`,
            ],
            [
              'Le cuivre',
              'Il a la plus faible résistivité, mais à masse égale sa section est 3,3 fois plus petite.',
            ],
            ['Les deux se valent', r`Les produits $\rho m_0$ diffèrent d’un facteur 2.`],
            [
              'On ne peut pas conclure sans ℓ',
              'ℓ est commune aux deux lignes : elle s’élimine dans la comparaison.',
            ],
          ],
          correct: 0,
          explanation: r`À masse $m = m_0 S \ell$ imposée, $R/\ell = \rho m_0 / K$ : il faut minimiser $\rho m_0$.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'La masse est fixée : la section S n’est donc pas libre. Exprime S en fonction de la masse.',
          r`$m = m_0 V = m_0 S \ell$, donc $m/\ell = m_0 S = K$ (constante). Et $R = \rho\,\ell/S$.`,
          r`Remplace S par $K/m_0$ dans $R/\ell = \rho/S$ : tu obtiens $R/\ell = \rho m_0/K$. Il reste à comparer $\rho m_0$ pour les deux métaux.`,
        ],
        steps: [
          {
            title: 'Contrainte de masse',
            md: r`$m = m_0 V = m_0 S\ell$, d’où $\dfrac{m}{\ell} = m_0 S = K$ (masse par unité de longueur, constante).`,
          },
          {
            title: 'Résistance linéique',
            md: r`$R = \rho\dfrac{\ell}{S}$ donc $\dfrac{R}{\ell} = \dfrac{\rho}{S} = \dfrac{\rho\,m_0}{K}$.`,
          },
          {
            title: 'Comparaison',
            md: r`$(\rho m_0)_{Al} = 2{,}85 \times 2{,}7 \approx 7{,}69\ \mu\Omega\cdot\text{g/cm}^2$ ; $(\rho m_0)_{Cu} = 1{,}73\times8{,}96 \approx 15{,}5\ \mu\Omega\cdot\text{g/cm}^2$.`,
          },
          {
            title: 'Conclusion',
            md: 'À masse égale, la ligne en aluminium a une résistance environ deux fois plus faible : on choisit l’aluminium (c’est le cas des lignes à haute tension réelles).',
          },
        ],
        origin: 'livret',
      }),
    ],
  },
  {
    id: 'td1-ex1-2',
    td: 'TD1',
    section: 'Applications directes',
    number: '1.2',
    title: 'Résistivité du cuivre présentant des impuretés',
    statement:
      'Un cuivre « commercialement pur », utilisé pour fabriquer du fil électrique, contient des impuretés : fer 100 ppm atomique, chrome 100 ppm atomique, argent 400 ppm atomique. La figure 1.1 du livret donne l’augmentation de résistivité Δρ du cuivre en fonction de la teneur de chaque impureté.',
    data: [
      {
        label: 'Conductivité du cuivre pur (20 °C)',
        value: r`$\sigma_0 = 5{,}97\cdot10^5\ \Omega^{-1}\cdot\text{cm}^{-1}$`,
      },
      {
        label: 'Lectures sur la figure 1.1 (données par la correction du livret)',
        value: r`$\Delta\rho_{Fe} = +0{,}1$ ; $\Delta\rho_{Cr} = +0{,}05$ ; $\Delta\rho_{Ag} = +0{,}02\ \mu\Omega\cdot\text{cm}$`,
      },
      { label: 'Fil (AD1.3)', value: 'longueur 100 m, diamètre 3 mm' },
    ],
    figure: {
      label: 'Figure 1.1',
      description:
        'Variation de la résistivité du cuivre pur en fonction de la composition en impuretés (graphique non reproduit).',
      page: 6,
    },
    objective:
      'Additionner les contributions à la résistivité puis calculer la résistance d’un fil réel.',
    skills: ['Passer de σ à ρ', 'Lire un graphique', 'Appliquer R = ρℓ/S avec des unités en cm'],
    prerequisiteLessonIds: ['c1-l4', 'c1-l5'],
    conceptIds: ['c1-temperature', 'c1-resistivite', 'c0-unites'],
    difficulty: 2,
    source: L('6-7', 'Exercice 1.2'),
    parts: [
      part({
        id: 'AD1.2',
        prompt: 'Quelle est la résistivité ρ_com de ce cuivre commercial ?',
        question: num({
          id: 'ex-AD1.2',
          concepts: ['c1-temperature'],
          difficulty: 2,
          prompt: 'Résistivité du cuivre commercial',
          value: 1.845,
          unit: 'µΩ.cm',
          tolerance: 0.01,
          explanation: r`$\rho = 1/\sigma_0 + \Delta\rho = 1{,}675 + 0{,}17 = 1{,}845\ \mu\Omega\cdot\text{cm}$.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'La résistivité du cuivre impur = résistivité du cuivre pur + augmentations dues aux impuretés.',
          r`$\rho_0 = 1/\sigma_0$ et $\Delta\rho = \Delta\rho_{Fe} + \Delta\rho_{Cr} + \Delta\rho_{Ag}$.`,
          r`$1/(5{,}97\cdot10^5) = 1{,}675\cdot10^{-6}\ \Omega\cdot\text{cm} = 1{,}675\ \mu\Omega\cdot\text{cm}$. Ajoute $0{,}17\ \mu\Omega\cdot\text{cm}$.`,
        ],
        steps: [
          {
            title: 'Contributions des impuretés',
            md: r`$\Delta\rho = 0{,}1 + 0{,}05 + 0{,}02 = 0{,}17\ \mu\Omega\cdot\text{cm}$.`,
          },
          {
            title: 'Cuivre pur',
            md: r`$\rho_0 = \dfrac{1}{\sigma_0} = \dfrac{1}{5{,}97\cdot10^5} \approx 1{,}675\cdot10^{-6}\ \Omega\cdot\text{cm}$.`,
          },
          {
            title: 'Résultat',
            md: r`$\rho_{com} = \rho_0 + \Delta\rho \approx 1{,}845\ \mu\Omega\cdot\text{cm}$, soit une augmentation de $1{,}845/1{,}675 \approx 1{,}10$ : **+10 %**.`,
          },
        ],
        origin: 'livret',
        similar: 'gen-impuretes',
      }),
      part({
        id: 'AD1.3',
        prompt:
          'Quelle est la résistance R_com d’un fil de ce cuivre, de longueur 100 m et de diamètre 3 mm ?',
        question: num({
          id: 'ex-AD1.3',
          concepts: ['c1-resistivite', 'c0-unites'],
          difficulty: 2,
          prompt: 'Résistance du fil',
          value: 0.261,
          unit: 'Ω',
          explanation: r`$R = \rho\ell/S = 1{,}845\cdot10^{-6}\times10^4 / (\pi\times0{,}15^2) \approx 0{,}26\ \Omega$ (tout en cm).`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'Applique R = ρℓ/S en choisissant UN système d’unités cohérent.',
          r`ρ est en Ω·cm : exprime ℓ en cm ($10^4$ cm) et S en cm² avec le RAYON $r = 0{,}15$ cm.`,
          r`$S = \pi(0{,}15)^2 \approx 0{,}0707\ \text{cm}^2$ ; calcule $1{,}845\cdot10^{-6}\times10^4/0{,}0707$.`,
        ],
        steps: [
          { title: 'Unités', md: r`ρ en Ω·cm ⇒ ℓ = 100 m = $10^4$ cm ; r = 1,5 mm = 0,15 cm.` },
          {
            title: 'Section',
            md: r`$S = \pi r^2 = \pi\times(0{,}15)^2 \approx 7{,}07\cdot10^{-2}\ \text{cm}^2$.`,
          },
          {
            title: 'Résistance',
            md: r`$R = \rho\dfrac{\ell}{S} = 1{,}845\cdot10^{-6}\times\dfrac{10^4}{7{,}07\cdot10^{-2}} \approx 0{,}26\ \Omega$ (soit 260 mΩ).`,
          },
        ],
        origin: 'livret',
        similar: 'gen-resistance',
      }),
    ],
  },
  {
    id: 'td1-ex1-3',
    td: 'TD1',
    section: 'Applications directes',
    number: '1.3',
    title: 'Vitesse de dérive',
    statement:
      'Un thermistor (résistance dont la valeur varie avec la température) en silicium intrinsèque a la forme d’un disque d’épaisseur e = 4 mm. On applique une différence de potentiel U = 1 V entre ses deux faces. On rappelle que v̄ = μE.',
    data: [
      { label: 'Épaisseur', value: 'e = 4 mm' },
      { label: 'Tension', value: 'U = 1 V' },
      {
        label: 'Mobilité des électrons',
        value: r`$\mu = 0{,}14\ \text{m}^2/(\text{V}\cdot\text{s})$ — valeur utilisée par la correction du livret mais absente de l’énoncé`,
      },
    ],
    objective: 'Relier tension, champ et vitesse de dérive ; en déduire un temps de traversée.',
    skills: ['E = U/e', 'v = μE', 't = e/v'],
    prerequisiteLessonIds: ['c1-l2'],
    conceptIds: ['c1-derive', 'c1-champ'],
    difficulty: 1,
    source: L('7-8', 'Exercice 1.3'),
    auditNotes: [
      'La mobilité μ = 0,14 m²/(V·s) n’est pas donnée dans l’énoncé du livret ; elle apparaît seulement dans la correction (AD1.4).',
    ],
    parts: [
      part({
        id: 'AD1.4',
        prompt: 'Calcule la vitesse de dérive v̄ des électrons dans ce thermistor.',
        question: num({
          id: 'ex-AD1.4',
          concepts: ['c1-derive', 'c1-champ'],
          prompt: 'Vitesse de dérive',
          value: 35,
          unit: 'm/s',
          explanation: r`$E = U/e = 250$ V/m, $\bar v = \mu E = 0{,}14\times250 = 35$ m/s.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'Il te faut le champ électrique dans le disque avant d’utiliser v̄ = μE.',
          r`Champ uniforme : $E = U/e$, avec e en mètres.`,
          r`$E = 1/0{,}004 = 250$ V/m, puis multiplie par μ = 0,14.`,
        ],
        steps: [
          {
            title: 'Champ',
            md: r`$E = \dfrac{U}{e} = \dfrac{1}{0{,}004} = 250\ \text{V}\cdot\text{m}^{-1}$.`,
          },
          {
            title: 'Vitesse',
            md: r`$\bar v = \mu E = 0{,}14\times250 = 35\ \text{m}\cdot\text{s}^{-1}$.`,
          },
        ],
        origin: 'livret',
        similar: 'gen-drift',
      }),
      part({
        id: 'AD1.5',
        prompt:
          'Calcule le temps mis par un électron pour traverser le thermistor dans son épaisseur.',
        question: num({
          id: 'ex-AD1.5',
          concepts: ['c1-derive'],
          prompt: 'Temps de traversée',
          value: 0.004 / 35,
          unit: 's',
          explanation: r`$t = e/\bar v = 0{,}004/35 \approx 1{,}14\cdot10^{-4}$ s = 0,114 ms.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'Mouvement à vitesse constante sur une distance connue.',
          r`$\bar v = e/t$ donc $t = e/\bar v$.`,
          r`$t = 0{,}004/35$ (en secondes).`,
        ],
        steps: [
          {
            md: r`$t = \dfrac{e}{\bar v} = \dfrac{0{,}004}{35} \approx 1{,}14\cdot10^{-4}\ \text{s} = 0{,}114\ \text{ms}$.`,
          },
        ],
        origin: 'livret',
        erratum:
          'Le livret écrit « 1,1143·10⁻⁴ » : il faut lire 1,143·10⁻⁴ s. Le résultat final (0,114 ms) est correct.',
      }),
    ],
  },
  {
    id: 'td1-ex1-4',
    td: 'TD1',
    section: 'Applications directes',
    number: '1.4',
    title: 'Vitesse de dérive, épisode II',
    statement:
      'Un fil de cuivre de 6 m de long et 5,6 mm de diamètre, de résistivité ρ₀ = 1,54·10⁻⁶ Ω·cm à 0 °C, est soumis à une différence de potentiel de 0,1 V. À 100 °C, sa résistivité devient ρ₁₀₀ = 2,22·10⁻⁶ Ω·cm.',
    data: [
      { label: 'Fil', value: 'ℓ = 6 m, d = 5,6 mm' },
      {
        label: 'Résistivités',
        value: r`$\rho_0 = 1{,}54\cdot10^{-6}\ \Omega\cdot\text{cm}$ (0 °C) ; $\rho_{100} = 2{,}22\cdot10^{-6}\ \Omega\cdot\text{cm}$ (100 °C)`,
      },
      { label: 'Tension', value: 'U = 0,1 V' },
      { label: 'Charge élémentaire', value: r`$e = 1{,}6\cdot10^{-19}$ C` },
    ],
    objective: 'Relier courant et débit d’électrons ; voir l’effet de la température.',
    skills: ['Loi d’Ohm', 'R = ρℓ/S', 'i = (nombre d’électrons/s) × e', 'Loi de Matthiessen'],
    prerequisiteLessonIds: ['c1-l4', 'c1-l5'],
    conceptIds: ['c1-resistivite', 'c1-champ', 'c1-temperature', 'c0-ohm'],
    difficulty: 2,
    source: L('8-9', 'Exercice 1.4'),
    parts: [
      part({
        id: 'AD1.6',
        prompt: 'Combien d’électrons traversent la section du fil chaque seconde (à 0 °C) ?',
        question: num({
          id: 'ex-AD1.6',
          concepts: ['c1-resistivite', 'c1-champ', 'c0-ohm'],
          difficulty: 2,
          prompt: 'Électrons par seconde',
          value: 1.666e20,
          unit: 's^-1',
          unitRequired: false,
          explanation: r`$x_0 = \dfrac{US}{\ell\rho e} \approx 1{,}66\cdot10^{20}$ électrons/s.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'Un courant I correspond à I/e électrons par seconde. Il faut donc d’abord le courant.',
          r`Loi d’Ohm : $I = U/R$ avec $R = \rho\ell/S$, d’où $x_0 = \dfrac{I}{e} = \dfrac{U S}{\ell\rho e}$.`,
          r`En SI : $\rho = 1{,}54\cdot10^{-8}\ \Omega\cdot\text{m}$, $S = \pi(2{,}8\cdot10^{-3})^2 \approx 2{,}46\cdot10^{-5}$ m², ℓ = 6 m.`,
        ],
        steps: [
          { title: 'Débit d’électrons', md: r`$x_0 = \dfrac{I}{e}$ (1).` },
          {
            title: 'Courant',
            md: r`$I = \dfrac{U}{R} = \dfrac{1}{\rho}\dfrac{S}{\ell}U$ (2), d’où $x_0 = \dfrac{U S}{\ell\rho e}$.`,
          },
          {
            title: 'Application numérique (SI)',
            md: r`$R = \dfrac{1{,}54\cdot10^{-8}\times6}{2{,}46\cdot10^{-5}} \approx 3{,}75\ \text{m}\Omega$, $I \approx 26{,}7$ A, $x_0 \approx \dfrac{26{,}7}{1{,}6\cdot10^{-19}} \approx 1{,}66\cdot10^{20}$ électrons/s.`,
          },
          {
            title: 'Attention aux unités',
            md: 'ρ est donné en Ω·cm : convertis en Ω·m (× 10⁻²) si tu travailles en mètres. Le livret mélange les deux dans son écriture intermédiaire, mais son résultat est correct.',
          },
        ],
        origin: 'livret',
        similar: 'gen-electron-flow',
      }),
      part({
        id: 'AD1.7',
        prompt:
          'Comment évolue ce nombre d’électrons par seconde à 100 °C ? Donne sa nouvelle valeur.',
        question: num({
          id: 'ex-AD1.7',
          concepts: ['c1-temperature'],
          difficulty: 2,
          prompt: 'Électrons par seconde à 100 °C',
          value: 1.1557e20,
          unit: 's^-1',
          unitRequired: false,
          explanation: r`$x_{100} = x_0\,\rho_0/\rho_{100} \approx 1{,}15\cdot10^{20}$ électrons/s : il diminue.`,
          td: ['TD1'],
          origin: 'pdf',
        }),
        hints: [
          'Quand la température augmente, la résistivité d’un métal augmente (Matthiessen).',
          r`$x \propto 1/\rho$ (les autres grandeurs ne changent pas), donc $\dfrac{x_{100}}{x_0} = \dfrac{\rho_0}{\rho_{100}}$.`,
          r`$x_{100} = 1{,}66\cdot10^{20}\times\dfrac{1{,}54}{2{,}22}$.`,
        ],
        steps: [
          {
            md: r`Le nombre d’électrons par seconde est inversement proportionnel à ρ, qui augmente avec la température : il **diminue**.`,
          },
          {
            md: r`$x_{100} = \dfrac{\rho_0}{\rho_{100}}x_0 = \dfrac{1{,}54}{2{,}22}\times1{,}66\cdot10^{20} \approx 1{,}15\cdot10^{20}$ électrons/s.`,
          },
        ],
        origin: 'livret',
      }),
    ],
  },
  {
    id: 'td1-ex1-5',
    td: 'TD1',
    section: 'Travaux dirigés',
    number: '1.5',
    title: 'Vitesse de dérive (TD)',
    statement:
      'Un conducteur cylindrique de rayon r = 5 mm et de longueur ℓ = 50 cm est soumis à une tension U = 12 V. Il est traversé par un courant i = 0,1 A. Le fil contient N = 10²⁴ électrons (libres).',
    data: [
      { label: 'Géométrie', value: 'r = 5 mm, ℓ = 50 cm' },
      { label: 'Électrique', value: 'U = 12 V, i = 0,1 A' },
      { label: 'Électrons dans le fil', value: r`$N = 10^{24}$` },
    ],
    objective:
      'Enchaîner résistance, conductivité, densité de courant, champ et vitesse de dérive.',
    skills: ['R = U/i', 'γ = ℓ/(RS)', 'j = i/S', 'E = U/ℓ', 'v = j/(ne)'],
    prerequisiteLessonIds: ['c1-l2', 'c1-l3', 'c1-l4'],
    conceptIds: ['c1-ohm-locale', 'c1-densite', 'c1-champ', 'c1-derive', 'c1-resistivite'],
    difficulty: 2,
    source: L('9', 'Exercice 1.5'),
    auditNotes: [
      'Pas de correction dans le livret : corrigé calculé par ECE STUDY (cohérence vérifiée : j = γE).',
    ],
    parts: [
      part({
        id: 'Q1.1',
        prompt: 'Calcule la conductivité du conducteur.',
        question: num({
          id: 'ex-Q1.1',
          concepts: ['c1-resistivite', 'c1-ohm-locale'],
          difficulty: 2,
          prompt: 'Conductivité',
          value: 53.05,
          unit: 'S/m',
          explanation: r`$R = 120\ \Omega$, $S = \pi r^2 \approx 7{,}85\cdot10^{-5}$ m², $\gamma = \ell/(RS) \approx 53$ S/m.`,
          td: ['TD1'],
        }),
        hints: [
          'Commence par la résistance du conducteur, puis isole γ dans la formule de R.',
          r`$R = U/i$ et $R = \dfrac{\ell}{\gamma S}$ donc $\gamma = \dfrac{\ell}{RS}$.`,
          r`$R = 12/0{,}1 = 120\ \Omega$ ; $S = \pi(5\cdot10^{-3})^2$ ; ℓ = 0,5 m.`,
        ],
        steps: [
          { title: 'Résistance', md: r`$R = U/i = 12/0{,}1 = 120\ \Omega$.` },
          {
            title: 'Section',
            md: r`$S = \pi r^2 = \pi(5\cdot10^{-3})^2 \approx 7{,}85\cdot10^{-5}\ \text{m}^2$.`,
          },
          {
            title: 'Conductivité',
            md: r`$\gamma = \dfrac{\ell}{RS} = \dfrac{0{,}5}{120\times7{,}85\cdot10^{-5}} \approx 53\ \text{S/m}$ (ρ ≈ 1,9·10⁻² Ω·m : ce n’est pas un métal).`,
          },
        ],
        origin: 'ece-study',
        similar: 'gen-ohm-locale',
      }),
      part({
        id: 'Q1.2',
        prompt: 'Calcule la densité de courant.',
        question: num({
          id: 'ex-Q1.2',
          concepts: ['c1-densite'],
          prompt: 'Densité de courant',
          value: 1273.2,
          unit: 'A/m^2',
          explanation: r`$j = i/S = 0{,}1/7{,}85\cdot10^{-5} \approx 1{,}27\cdot10^3$ A/m².`,
          td: ['TD1'],
        }),
        hints: [
          'Le courant est réparti uniformément sur la section.',
          r`$i = \iint \vec j\cdot d\vec S = jS$ donc $j = i/S$.`,
          r`$j = 0{,}1/(7{,}85\cdot10^{-5})$.`,
        ],
        steps: [
          {
            md: r`$j = \dfrac{i}{S} = \dfrac{0{,}1}{7{,}85\cdot10^{-5}} \approx 1{,}27\cdot10^3\ \text{A}\cdot\text{m}^{-2}$.`,
          },
        ],
        origin: 'ece-study',
      }),
      part({
        id: 'Q1.3',
        prompt: 'Calcule le champ électrique dans ce conducteur.',
        question: num({
          id: 'ex-Q1.3',
          concepts: ['c1-champ', 'c1-ohm-locale'],
          prompt: 'Champ électrique',
          value: 24,
          unit: 'V/m',
          explanation: r`$E = U/\ell = 12/0{,}5 = 24$ V/m (vérification : $\gamma E \approx 53\times24 \approx 1{,}27\cdot10^3$ A/m² = j).`,
          td: ['TD1'],
        }),
        hints: [
          'Deux méthodes possibles : à partir de U et ℓ, ou avec la loi d’Ohm locale.',
          r`$E = U/\ell$ (ou $E = j/\gamma$).`,
          r`$E = 12/0{,}5$.`,
        ],
        steps: [
          { md: r`$E = \dfrac{U}{\ell} = \dfrac{12}{0{,}5} = 24\ \text{V/m}$.` },
          {
            title: 'Vérification',
            md: r`Loi d’Ohm locale : $j = \gamma E = 53{,}05\times24 \approx 1273$ A/m², identique à Q1.2.`,
          },
        ],
        origin: 'ece-study',
      }),
      part({
        id: 'Q1.4',
        prompt: 'Sachant que le fil contient N = 10²⁴ électrons, calcule la vitesse de dérive.',
        question: num({
          id: 'ex-Q1.4',
          concepts: ['c1-derive', 'c1-densite'],
          difficulty: 3,
          prompt: 'Vitesse de dérive',
          value: 3.125e-7,
          unit: 'm/s',
          explanation: r`$n = N/(S\ell) \approx 2{,}55\cdot10^{28}$ m⁻³, $v = j/(ne) \approx 3{,}1\cdot10^{-7}$ m/s.`,
          td: ['TD1'],
        }),
        hints: [
          'La densité de courant s’écrit j = n e v : il faut la densité volumique n d’électrons.',
          r`$n = \dfrac{N}{V} = \dfrac{N}{S\ell}$, puis $v = \dfrac{j}{ne}$ (en norme).`,
          r`Plus direct : $v = \dfrac{i\,\ell}{N e}$. Calcule $0{,}1\times0{,}5/(10^{24}\times1{,}6\cdot10^{-19})$.`,
        ],
        steps: [
          {
            title: 'Densité d’électrons',
            md: r`$V = S\ell \approx 3{,}93\cdot10^{-5}\ \text{m}^3$, $n = N/V \approx 2{,}55\cdot10^{28}\ \text{m}^{-3}$.`,
          },
          {
            title: 'Vitesse',
            md: r`$v = \dfrac{j}{ne} = \dfrac{1273}{2{,}55\cdot10^{28}\times1{,}6\cdot10^{-19}} \approx 3{,}1\cdot10^{-7}\ \text{m/s}$.`,
          },
          {
            title: 'Interprétation',
            md: 'Les électrons avancent d’environ 0,3 µm par seconde : la vitesse de dérive est extrêmement lente devant l’agitation thermique.',
          },
        ],
        origin: 'ece-study',
      }),
    ],
  },
  {
    id: 'td1-ex1-6',
    td: 'TD1',
    section: 'Travaux dirigés',
    number: '1.6',
    title: 'Capacité électrique',
    statement:
      'On veut stocker une charge Q = 3·10⁻¹⁰ C dans un condensateur plan dont les armatures ont une surface S = 900 mm² et sont distantes de e = 2 mm. Cas 1 : le vide sépare les armatures. Cas 2 : un diélectrique de permittivité relative ε_r = 4 remplit l’espace.',
    data: [
      { label: 'Charge', value: r`$Q = 3\cdot10^{-10}$ C` },
      { label: 'Géométrie', value: r`$S = 900\ \text{mm}^2$, $e = 2$ mm` },
      { label: 'Diélectrique (cas 2)', value: r`$\varepsilon_r = 4$` },
      {
        label: 'Permittivité du vide (cours 1)',
        value: r`$\varepsilon_0 = 8{,}85\cdot10^{-12}$ F/m`,
      },
    ],
    objective: 'Calculer une capacité plane et voir le rôle du diélectrique.',
    skills: ['C = ε₀ε_r S/e', 'U = Q/C', 'σ = Q/S', 'Conversions mm² → m²'],
    prerequisiteLessonIds: ['c1-l7', 'c0-l0'],
    conceptIds: ['c1-condensateur', 'c0-unites'],
    difficulty: 2,
    source: L('9', 'Exercice 1.6'),
    auditNotes: [
      'Pas de correction dans le livret : corrigé calculé par ECE STUDY avec ε₀ = 8,85·10⁻¹² F/m (valeur du cours 1, diapo 39).',
    ],
    parts: [
      part({
        id: 'Q1.5',
        prompt: 'Quelle tension faut-il appliquer si l’espace entre les plaques est vide (cas 1) ?',
        question: num({
          id: 'ex-Q1.5',
          concepts: ['c1-condensateur', 'c0-unites'],
          difficulty: 2,
          prompt: 'Tension, cas 1',
          value: 75.33,
          unit: 'V',
          explanation: r`$C_1 = \varepsilon_0 S/e \approx 3{,}98$ pF, $U_1 = Q/C_1 \approx 75$ V.`,
          td: ['TD1'],
        }),
        hints: [
          'Il faut d’abord la capacité du condensateur, puis utiliser C = Q/U.',
          r`$C_1 = \varepsilon_0\dfrac{S}{e}$ avec S en m² et e en m.`,
          r`$S = 900\cdot10^{-6} = 9\cdot10^{-4}$ m², $e = 2\cdot10^{-3}$ m ⇒ $C_1 \approx 3{,}98\cdot10^{-12}$ F ; $U_1 = Q/C_1$.`,
        ],
        steps: [
          {
            title: 'Capacité',
            md: r`$C_1 = \varepsilon_0\dfrac{S}{e} = 8{,}85\cdot10^{-12}\times\dfrac{9\cdot10^{-4}}{2\cdot10^{-3}} \approx 3{,}98\cdot10^{-12}$ F.`,
          },
          {
            title: 'Tension',
            md: r`$U_1 = \dfrac{Q}{C_1} = \dfrac{3\cdot10^{-10}}{3{,}98\cdot10^{-12}} \approx 75{,}3$ V.`,
          },
        ],
        origin: 'ece-study',
        similar: 'gen-capacitor',
      }),
      part({
        id: 'Q1.6',
        prompt: 'Quelle tension faut-il appliquer avec le diélectrique ε_r = 4 (cas 2) ?',
        question: num({
          id: 'ex-Q1.6',
          concepts: ['c1-condensateur'],
          prompt: 'Tension, cas 2',
          value: 18.83,
          unit: 'V',
          explanation: r`$C_2 = \varepsilon_r C_1$, donc $U_2 = U_1/4 \approx 18{,}8$ V.`,
          td: ['TD1'],
        }),
        hints: [
          'Le diélectrique multiplie la capacité par ε_r.',
          r`$C_2 = \varepsilon_0\varepsilon_r S/e = 4C_1$ et $U_2 = Q/C_2$.`,
          r`$U_2 = U_1/4 = 75{,}3/4$.`,
        ],
        steps: [
          { md: r`$C_2 = 4C_1 \approx 15{,}9$ pF, donc $U_2 = Q/C_2 = U_1/4 \approx 18{,}8$ V.` },
        ],
        origin: 'ece-study',
      }),
      part({
        id: 'Q1.7 (cas 1)',
        prompt: 'Quelle est la capacité du condensateur dans le cas 1 ?',
        question: num({
          id: 'ex-Q1.7a',
          concepts: ['c1-condensateur'],
          prompt: 'Capacité, cas 1',
          value: 3.9825e-12,
          unit: 'F',
          explanation: r`$C_1 \approx 3{,}98$ pF.`,
          td: ['TD1'],
        }),
        hints: [
          'Tu l’as déjà calculée pour Q1.5.',
          r`$C_1 = \varepsilon_0 S/e$.`,
          r`$8{,}85\cdot10^{-12}\times9\cdot10^{-4}/2\cdot10^{-3}$.`,
        ],
        steps: [
          {
            md: r`$C_1 = \varepsilon_0\dfrac{S}{e} \approx 3{,}98\cdot10^{-12}\ \text{F} = 3{,}98$ pF.`,
          },
        ],
        origin: 'ece-study',
      }),
      part({
        id: 'Q1.7 (cas 2)',
        prompt: 'Quelle est la capacité du condensateur dans le cas 2 ?',
        question: num({
          id: 'ex-Q1.7b',
          concepts: ['c1-condensateur'],
          prompt: 'Capacité, cas 2',
          value: 1.593e-11,
          unit: 'F',
          explanation: r`$C_2 = 4C_1 \approx 15{,}9$ pF.`,
          td: ['TD1'],
        }),
        hints: [
          'Même géométrie, mais avec un diélectrique.',
          r`$C_2 = \varepsilon_r C_1$.`,
          r`$4\times3{,}98$ pF.`,
        ],
        steps: [
          { md: r`$C_2 = \varepsilon_r C_1 \approx 1{,}59\cdot10^{-11}\ \text{F} = 15{,}9$ pF.` },
        ],
        origin: 'ece-study',
      }),
      part({
        id: 'Q1.8',
        prompt:
          'Quelle est la densité superficielle de charges sur les plaques dans le cas 2 (en µC·m⁻²) ?',
        question: num({
          id: 'ex-Q1.8',
          concepts: ['c1-condensateur', 'c0-unites'],
          difficulty: 2,
          prompt: 'Densité superficielle de charges',
          value: 0.3333,
          unit: 'µC/m^2',
          explanation: r`$\sigma = Q/S = 3\cdot10^{-10}/9\cdot10^{-4} \approx 3{,}33\cdot10^{-7}$ C/m² = 0,333 µC/m².`,
          td: ['TD1'],
        }),
        hints: [
          'C’est une charge par unité de surface.',
          r`$\sigma = Q/S$ (la charge Q est imposée : elle ne dépend pas du diélectrique).`,
          r`$3\cdot10^{-10}/(9\cdot10^{-4})$ en C/m², puis convertis en µC/m² (× 10⁶).`,
        ],
        steps: [
          {
            md: r`$\sigma = \dfrac{Q}{S} = \dfrac{3\cdot10^{-10}}{9\cdot10^{-4}} \approx 3{,}33\cdot10^{-7}\ \text{C}\cdot\text{m}^{-2} = 0{,}333\ \mu\text{C}\cdot\text{m}^{-2}$.`,
          },
          {
            title: 'Remarque',
            md: 'La charge étant fixée, σ est la même dans les cas 1 et 2 ; c’est la tension nécessaire qui change.',
          },
        ],
        origin: 'ece-study',
      }),
    ],
  },
];
