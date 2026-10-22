import { mulberry32, pick } from '@/lib/random';
import { texNum } from '@/lib/format';
import type { CorrectionStep, Difficulty, NumericQuestion } from '@/types';

/**
 * Exercices d'entraînement générés (étiquetés « entraînement supplémentaire »).
 * - Graine ⇒ même énoncé, mêmes valeurs (reproductible).
 * - Les paramètres sont tirés dans des plages physiquement réalistes.
 * - La réponse attendue est calculée ici, jamais saisie à la main.
 */
export interface GeneratedExercise {
  generatorId: string;
  seed: number;
  title: string;
  difficulty: Difficulty;
  conceptIds: string[];
  statement: string;
  question: NumericQuestion;
  hints: [string, string, string];
  steps: CorrectionStep[];
}

export interface Generator {
  id: string;
  title: string;
  difficulty: Difficulty;
  conceptIds: string[];
  make: (seed: number) => GeneratedExercise;
}

const E = 1.6e-19;
const EPS0 = 8.85e-12;
const NA = 6.02e23;
const H = 6.63e-34;
const C = 3e8;

const fx = texNum;

function q(
  id: string,
  concepts: string[],
  difficulty: Difficulty,
  value: number,
  unit: string,
  explanation: string,
  tolerance = 0.02,
): NumericQuestion {
  return {
    id,
    type: 'numeric',
    conceptIds: concepts,
    difficulty,
    prompt: '',
    explanation,
    origin: 'ece-study',
    answer: { value, unit, tolerance, unitRequired: unit !== '' },
  };
}

const range = (rng: () => number, min: number, max: number, step: number) =>
  Math.round((min + rng() * (max - min)) / step) * step;

const MATERIALS = [
  { name: 'cuivre', rho: 1.7e-8 },
  { name: 'aluminium', rho: 2.8e-8 },
  { name: 'argent', rho: 1.6e-8 },
  { name: 'tungstène', rho: 5.6e-8 },
  { name: 'nichrome', rho: 1.1e-6 },
];

export const GENERATORS: Generator[] = [
  {
    id: 'gen-resistance',
    title: 'Résistance d’un fil',
    difficulty: 1,
    conceptIds: ['c1-resistivite', 'c0-unites'],
    make(seed) {
      const rng = mulberry32(seed);
      const m = pick(MATERIALS, rng);
      const L = range(rng, 1, 200, 1);
      const d = pick([0.5, 0.8, 1, 1.5, 2, 2.5, 3], rng);
      const S = Math.PI * ((d * 1e-3) / 2) ** 2;
      const R = (m.rho * L) / S;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: this.difficulty,
        conceptIds: this.conceptIds,
        statement: `Un fil de ${m.name} ($\\rho = ${fx(m.rho, 2)}\\ \\Omega\\cdot\\text{m}$) mesure $${L}$ m de long et a un diamètre de $${fx(d)}$ mm. Calcule sa résistance.`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          R,
          'Ω',
          `$R = \\rho\\ell/S \\approx ${fx(R)}\\ \\Omega$.`,
        ),
        hints: [
          'Utilise R = ρℓ/S avec des unités SI.',
          `La section est $S = \\pi r^2$ avec $r = d/2 = ${fx(d / 2)}$ mm.`,
          `$S \\approx ${fx(S)}\\ \\text{m}^2$.`,
        ],
        steps: [
          {
            md: `$S = \\pi (d/2)^2 = \\pi\\times(${fx(d / 2)}\\cdot10^{-3})^2 \\approx ${fx(S)}\\ \\text{m}^2$.`,
          },
          {
            md: `$R = \\rho\\dfrac{\\ell}{S} = ${fx(m.rho, 2)}\\times\\dfrac{${L}}{${fx(S)}} \\approx ${fx(R)}\\ \\Omega$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-impuretes',
    title: 'Résistivité d’un métal impur',
    difficulty: 2,
    conceptIds: ['c1-temperature'],
    make(seed) {
      const rng = mulberry32(seed);
      const sigma0 = range(rng, 5.6, 6.2, 0.01) * 1e5; // Ω⁻¹·cm⁻¹ (cuivre)
      const d1 = range(rng, 0.02, 0.2, 0.01);
      const d2 = range(rng, 0.01, 0.1, 0.01);
      const rho0 = 1e6 / sigma0; // µΩ·cm
      const rho = rho0 + d1 + d2;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Un cuivre a pour conductivité à l’état pur $\\sigma_0 = ${fx(sigma0)}\\ \\Omega^{-1}\\cdot\\text{cm}^{-1}$. Deux impuretés augmentent sa résistivité de $${fx(d1)}$ et $${fx(d2)}\\ \\mu\\Omega\\cdot\\text{cm}$. Quelle est sa résistivité (en µΩ·cm) ?`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          rho,
          'µΩ.cm',
          `$\\rho = 1/\\sigma_0 + \\Delta\\rho \\approx ${fx(rho, 4)}\\ \\mu\\Omega\\cdot\\text{cm}$.`,
          0.01,
        ),
        hints: [
          'ρ = ρ₀ + Σ Δρ.',
          'ρ₀ = 1/σ₀ (en Ω·cm), à convertir en µΩ·cm.',
          `$\\rho_0 \\approx ${fx(rho0, 4)}\\ \\mu\\Omega\\cdot\\text{cm}$.`,
        ],
        steps: [
          {
            md: `$\\rho_0 = 1/\\sigma_0 \\approx ${fx(rho0 * 1e-6, 4)}\\ \\Omega\\cdot\\text{cm} = ${fx(rho0, 4)}\\ \\mu\\Omega\\cdot\\text{cm}$.`,
          },
          {
            md: `$\\rho = \\rho_0 + ${fx(d1)} + ${fx(d2)} \\approx ${fx(rho, 4)}\\ \\mu\\Omega\\cdot\\text{cm}$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-drift',
    title: 'Vitesse de dérive dans une plaquette',
    difficulty: 1,
    conceptIds: ['c1-derive', 'c1-champ'],
    make(seed) {
      const rng = mulberry32(seed);
      const mu = pick([0.135, 0.14, 0.39, 0.048, 0.19], rng);
      const U = range(rng, 0.5, 10, 0.5);
      const ep = range(rng, 1, 10, 0.5); // mm
      const E_ = U / (ep * 1e-3);
      const v = mu * E_;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 1,
        conceptIds: this.conceptIds,
        statement: `Une plaquette semi-conductrice d’épaisseur $${fx(ep)}$ mm est soumise à $${fx(U)}$ V entre ses faces. La mobilité des porteurs vaut $${fx(mu)}\\ \\text{m}^2/(\\text{V·s})$. Calcule leur vitesse de dérive.`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          v,
          'm/s',
          `$E = U/e \\approx ${fx(E_)}$ V/m et $v = \\mu E \\approx ${fx(v)}$ m/s.`,
        ),
        hints: [
          'Calcule d’abord le champ.',
          'E = U/e (e en mètres).',
          `$E \\approx ${fx(E_)}$ V/m ; v = μE.`,
        ],
        steps: [
          {
            md: `$E = \\dfrac{${fx(U)}}{${fx(ep)}\\cdot10^{-3}} \\approx ${fx(E_)}\\ \\text{V/m}$.`,
          },
          { md: `$v = \\mu E \\approx ${fx(v)}\\ \\text{m/s}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-electron-flow',
    title: 'Électrons par seconde dans un fil',
    difficulty: 2,
    conceptIds: ['c1-resistivite', 'c1-champ', 'c0-ohm'],
    make(seed) {
      const rng = mulberry32(seed);
      const L = range(rng, 1, 20, 1);
      const d = pick([1, 2, 3, 4, 5], rng);
      const U = pick([0.05, 0.1, 0.2, 0.5], rng);
      const rhoCm = range(rng, 1.5, 2.3, 0.01) * 1e-6; // Ω·cm
      const S = Math.PI * ((d * 1e-3) / 2) ** 2;
      const I = U / ((rhoCm * 1e-2 * L) / S);
      const x = I / E;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Un fil de cuivre de $${L}$ m de long et $${d}$ mm de diamètre ($\\rho = ${fx(rhoCm, 3)}\\ \\Omega\\cdot\\text{cm}$) est soumis à $${U}$ V. Combien d’électrons traversent sa section par seconde ?`,
        question: {
          ...q(
            `${this.id}-${seed}`,
            this.conceptIds,
            2,
            x,
            's^-1',
            `$x = I/e \\approx ${fx(x)}$ électrons/s.`,
          ),
          answer: { value: x, unit: 's^-1', tolerance: 0.02, unitRequired: false },
        },
        hints: [
          'x = I/e.',
          'I = U/R avec R = ρℓ/S (attention : ρ en Ω·cm).',
          `En SI, $\\rho = ${fx(rhoCm * 1e-2, 3)}\\ \\Omega\\cdot\\text{m}$.`,
        ],
        steps: [
          {
            md: `$R = \\rho\\ell/S \\approx ${fx((rhoCm * 1e-2 * L) / S)}\\ \\Omega$, $I = U/R \\approx ${fx(I)}$ A.`,
          },
          { md: `$x = I/e \\approx ${fx(x)}$ électrons par seconde.` },
        ],
      };
    },
  },
  {
    id: 'gen-ohm-locale',
    title: 'Conductivité d’un conducteur cylindrique',
    difficulty: 2,
    conceptIds: ['c1-resistivite', 'c1-ohm-locale'],
    make(seed) {
      const rng = mulberry32(seed);
      const r = pick([1, 2, 2.5, 4, 5], rng);
      const L = pick([20, 30, 50, 80, 100], rng);
      const U = pick([5, 9, 12, 24], rng);
      const i = pick([0.05, 0.1, 0.2, 0.5], rng);
      const S = Math.PI * (r * 1e-3) ** 2;
      const g = (L * 1e-2) / ((U / i) * S);
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Un conducteur cylindrique de rayon $${r}$ mm et de longueur $${L}$ cm est soumis à $${U}$ V et traversé par $${i}$ A. Calcule sa conductivité.`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          g,
          'S/m',
          `$\\gamma = \\ell/(RS) \\approx ${fx(g)}$ S/m.`,
        ),
        hints: [
          'R = U/i.',
          'γ = ℓ/(RS).',
          `$R = ${fx(U / i)}\\ \\Omega$, $S \\approx ${fx(S)}$ m².`,
        ],
        steps: [
          {
            md: `$R = U/i = ${fx(U / i)}\\ \\Omega$ ; $S = \\pi r^2 \\approx ${fx(S)}\\ \\text{m}^2$.`,
          },
          { md: `$\\gamma = \\dfrac{\\ell}{RS} \\approx ${fx(g)}\\ \\text{S/m}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-capacitor',
    title: 'Condensateur plan',
    difficulty: 1,
    conceptIds: ['c1-condensateur', 'c0-unites'],
    make(seed) {
      const rng = mulberry32(seed);
      const S = pick([100, 400, 900, 2500, 10000], rng); // mm²
      const d = pick([0.1, 0.5, 1, 2, 5], rng); // mm
      const er = pick([1, 2.2, 4, 6, 10], rng);
      const Q = pick([1, 2, 3, 5], rng) * 1e-10;
      const Cap = (EPS0 * er * S * 1e-6) / (d * 1e-3);
      const U = Q / Cap;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 1,
        conceptIds: this.conceptIds,
        statement: `Condensateur plan : armatures de $${S}\\ \\text{mm}^2$ distantes de $${d}$ mm, diélectrique $\\varepsilon_r = ${fx(er)}$. On veut y stocker $Q = ${fx(Q)}$ C. Quelle tension faut-il appliquer ? ($\\varepsilon_0 = 8{,}85\\cdot10^{-12}$ F/m)`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          U,
          'V',
          `$C \\approx ${fx(Cap)}$ F, $U = Q/C \\approx ${fx(U)}$ V.`,
        ),
        hints: [
          'C = ε₀ε_r S/d puis U = Q/C.',
          'S en m² (× 10⁻⁶), d en m (× 10⁻³).',
          `$C \\approx ${fx(Cap)}$ F.`,
        ],
        steps: [
          {
            md: `$C = \\varepsilon_0\\varepsilon_r\\dfrac{S}{d} \\approx ${fx(Cap)}\\ \\text{F}$.`,
          },
          { md: `$U = Q/C \\approx ${fx(U)}\\ \\text{V}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-photon',
    title: 'Photon et gap',
    difficulty: 2,
    conceptIds: ['c2-photon'],
    make(seed) {
      const rng = mulberry32(seed);
      const mat = pick(
        [
          { n: 'silicium', g: 1.12 },
          { n: 'germanium', g: 0.67 },
          { n: 'arséniure de gallium', g: 1.42 },
          { n: 'nitrure de gallium', g: 3.4 },
        ],
        rng,
      );
      const lam = (H * C) / (mat.g * E);
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Le gap du ${mat.n} vaut $E_g = ${fx(mat.g)}$ eV. Quelle est la longueur d’onde maximale d’un photon capable de faire passer un électron de la bande de valence à la bande de conduction ? ($h = 6{,}63\\cdot10^{-34}$ J·s, $c = 3\\cdot10^8$ m/s, $1\\ \\text{eV} = 1{,}6\\cdot10^{-19}$ J)`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          lam,
          'm',
          `$\\lambda_{max} = hc/E_g \\approx ${fx(lam)}$ m.`,
        ),
        hints: ['E = hc/λ ≥ E_g.', 'λ ≤ hc/E_g.', 'Convertis E_g en joules.'],
        steps: [
          {
            md: `$\\lambda_{max} = \\dfrac{hc}{E_g} = \\dfrac{6{,}63\\cdot10^{-34}\\times3\\cdot10^8}{${fx(mat.g)}\\times1{,}6\\cdot10^{-19}} \\approx ${fx(lam)}\\ \\text{m}$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-mass-action',
    title: 'Loi d’action de masse',
    difficulty: 1,
    conceptIds: ['c2-action-masse', 'c2-dopage'],
    make(seed) {
      const rng = mulberry32(seed);
      const ni = pick([1e10, 1.5e10, 8.3e9], rng);
      const typeN = rng() < 0.5;
      const N = pick([1, 2, 5], rng) * 10 ** Math.floor(range(rng, 13, 18, 1));
      const minority = (ni * ni) / N;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 1,
        conceptIds: this.conceptIds,
        statement: `Silicium ($n_i = ${fx(ni)}\\ \\text{cm}^{-3}$) dopé ${typeN ? 'N' : 'P'} avec $${typeN ? 'N_D' : 'N_A'} = ${fx(N)}\\ \\text{cm}^{-3}$ (tous ionisés). Calcule la concentration des porteurs minoritaires (${typeN ? 'trous' : 'électrons'}).`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          minority,
          'cm^-3',
          `$${typeN ? 'p' : 'n'} = n_i^2/${typeN ? 'N_D' : 'N_A'} \\approx ${fx(minority)}\\ \\text{cm}^{-3}$.`,
        ),
        hints: [
          `Les majoritaires valent ${typeN ? 'n ≈ N_D' : 'p ≈ N_A'}.`,
          'np = n_i².',
          `$n_i^2 = ${fx(ni * ni)}$.`,
        ],
        steps: [
          {
            md: `$${typeN ? 'p' : 'n'} = \\dfrac{n_i^2}{${typeN ? 'N_D' : 'N_A'}} = \\dfrac{${fx(ni * ni)}}{${fx(N)}} \\approx ${fx(minority)}\\ \\text{cm}^{-3}$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-doping-n',
    title: 'Conductivité d’un semi-conducteur dopé N',
    difficulty: 2,
    conceptIds: ['c2-conduction-sc', 'c2-dopage', 'c0-unites'],
    make(seed) {
      const rng = mulberry32(seed);
      const ND = pick([1, 2, 5], rng) * 10 ** Math.floor(range(rng, 14, 17, 1)); // cm⁻³
      const mun = pick([0.13, 0.135, 0.12, 0.1], rng); // m²/(V·s), faible/moyen dopage
      const g = ND * 1e6 * E * mun;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Silicium dopé N : $N_D = ${fx(ND)}\\ \\text{cm}^{-3}$, mobilité des électrons $\\mu_n = ${fx(mun)}\\ \\text{m}^2/(\\text{V·s})$. Les trous sont négligeables. Calcule la conductivité (en S/m).`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          g,
          'S/m',
          `$\\gamma \\approx N_De\\mu_n \\approx ${fx(g)}$ S/m (N_D converti en m⁻³).`,
        ),
        hints: [
          'γ ≈ N_D e μ_n.',
          'Unités : μ en m²/(V·s) ⇒ N_D en m⁻³.',
          `$N_D = ${fx(ND * 1e6)}\\ \\text{m}^{-3}$.`,
        ],
        steps: [
          { md: `$N_D = ${fx(ND)}\\ \\text{cm}^{-3} = ${fx(ND * 1e6)}\\ \\text{m}^{-3}$.` },
          { md: `$\\gamma \\approx N_De\\mu_n \\approx ${fx(g)}\\ \\text{S/m}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-atoms',
    title: 'Atomes par cm³',
    difficulty: 1,
    conceptIds: ['c2-denombrement'],
    make(seed) {
      const rng = mulberry32(seed);
      const m = pick(
        [
          { n: 'silicium', rho: 2.33, M: 28.09 },
          { n: 'germanium', rho: 5.32, M: 72.63 },
          { n: 'aluminium', rho: 2.7, M: 26.98 },
          { n: 'cuivre', rho: 8.96, M: 63.55 },
          { n: 'argent', rho: 10.49, M: 107.87 },
        ],
        rng,
      );
      const N = (NA * m.rho) / m.M;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 1,
        conceptIds: this.conceptIds,
        statement: `Combien d’atomes contient 1 cm³ de ${m.n} ? (masse volumique $${fx(m.rho)}\\ \\text{g/cm}^3$, masse molaire $${fx(m.M, 4)}$ g/mol, $\\mathcal{N}_A = 6{,}02\\cdot10^{23}\\ \\text{mol}^{-1}$)`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          N,
          'cm^-3',
          `$N = \\mathcal{N}_A\\rho/M \\approx ${fx(N)}$ cm⁻³.`,
        ),
        hints: [
          'Nombre de moles dans 1 cm³ = ρ/M.',
          'N = 𝒩_A × ρ/M.',
          `$\\rho/M \\approx ${fx(m.rho / m.M)}$ mol/cm³.`,
        ],
        steps: [
          {
            md: `$N = \\dfrac{\\mathcal{N}_A\\rho}{M} = \\dfrac{6{,}02\\cdot10^{23}\\times${fx(m.rho)}}{${fx(m.M, 4)}} \\approx ${fx(N)}\\ \\text{cm}^{-3}$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-atoms-doping',
    title: 'Dopage « 1 atome pour 10ᵏ »',
    difficulty: 3,
    conceptIds: ['c2-denombrement', 'c2-dopage', 'c2-action-masse'],
    make(seed) {
      const rng = mulberry32(seed);
      const k = Math.floor(range(rng, 5, 9, 1));
      const ni = 1e10;
      const Nsi = (NA * 2.33) / 28.09;
      const Ndop = Nsi / 10 ** k;
      const minority = (ni * ni) / Ndop;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 3,
        conceptIds: this.conceptIds,
        statement: `On dope du silicium (2,33 g/cm³, 28,09 g/mol, $n_i = 10^{10}\\ \\text{cm}^{-3}$) au bore, à raison d’un atome de bore pour $10^{${k}}$ atomes de silicium. Calcule la concentration en électrons (minoritaires).`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          3,
          minority,
          'cm^-3',
          `$N_A = N_{Si}/10^{${k}} \\approx ${fx(Ndop)}$ cm⁻³, $n = n_i^2/N_A \\approx ${fx(minority)}$ cm⁻³.`,
        ),
        hints: [
          'Il faut d’abord N_Si (atomes de silicium par cm³).',
          `$N_{Si} = \\mathcal{N}_A\\rho/M \\approx ${fx(Nsi)}$ cm⁻³, puis $N_A = N_{Si}/10^{${k}}$.`,
          'Le bore est accepteur : p ≈ N_A et n = n_i²/N_A.',
        ],
        steps: [
          {
            md: `$N_{Si} \\approx ${fx(Nsi)}\\ \\text{cm}^{-3}$, $N_A \\approx ${fx(Ndop)}\\ \\text{cm}^{-3}$.`,
          },
          { md: `$n = n_i^2/N_A \\approx ${fx(minority)}\\ \\text{cm}^{-3}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-photoconduction',
    title: 'Porteurs créés par éclairement',
    difficulty: 2,
    conceptIds: ['c2-photon', 'c2-conduction-sc'],
    make(seed) {
      const rng = mulberry32(seed);
      const G = pick([1, 2, 5], rng) * 10 ** Math.floor(range(rng, 20, 23, 1));
      const tau = pick([0.5, 1, 2, 10], rng) * 1e-6;
      const n = G * tau; // cm⁻³
      const g = n * 1e6 * E * (0.13 + 0.048);
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Un éclairement crée $${fx(G)}$ paires électron-trou par seconde et par cm³ dans du silicium ; leur durée de vie est $${fx(tau * 1e6)}$ µs. Le dopage est négligeable devant les porteurs créés. Avec $\\mu_n = 0{,}13$ et $\\mu_p = 0{,}048\\ \\text{m}^2/(\\text{V·s})$, calcule la conductivité (en S/m).`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          g,
          'S/m',
          `$n = p = G\\tau \\approx ${fx(n)}$ cm⁻³ ; $\\gamma = ne(\\mu_n+\\mu_p) \\approx ${fx(g)}$ S/m.`,
        ),
        hints: [
          'n = p = G × τ.',
          'γ = ne(μ_n + μ_p) avec n en m⁻³.',
          `$n \\approx ${fx(n)}\\ \\text{cm}^{-3} = ${fx(n * 1e6)}\\ \\text{m}^{-3}$.`,
        ],
        steps: [
          { md: `$n = p = G\\tau \\approx ${fx(n)}\\ \\text{cm}^{-3}$.` },
          { md: `$\\gamma = ne(\\mu_n+\\mu_p) \\approx ${fx(g)}\\ \\text{S/m}$.` },
        ],
      };
    },
  },
  {
    id: 'gen-barrier',
    title: 'Barrière de potentiel d’une jonction',
    difficulty: 2,
    conceptIds: ['c2-jonction'],
    make(seed) {
      const rng = mulberry32(seed);
      const NAc = 10 ** Math.floor(range(rng, 14, 18, 1));
      const NDc = 10 ** Math.floor(range(rng, 14, 18, 1));
      const ni = 1.5e10;
      const V0 = 0.026 * Math.log((NAc * NDc) / (ni * ni));
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 2,
        conceptIds: this.conceptIds,
        statement: `Jonction PN de silicium à l’ambiante : $N_A = ${fx(NAc)}$ et $N_D = ${fx(NDc)}\\ \\text{cm}^{-3}$, $n_i = 1{,}5\\cdot10^{10}\\ \\text{cm}^{-3}$, $k_BT/e = 0{,}026$ V. Calcule la barrière de potentiel $V_0$.`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          2,
          V0,
          'V',
          `$V_0 = 0{,}026\\ln(N_AN_D/n_i^2) \\approx ${fx(V0)}$ V.`,
        ),
        hints: [
          'V₀ = (k_BT/e) ln(N_A N_D / n_i²).',
          `$n_i^2 = 2{,}25\\cdot10^{20}$.`,
          `$N_AN_D/n_i^2 \\approx ${fx((NAc * NDc) / (ni * ni))}$.`,
        ],
        steps: [
          {
            md: `$V_0 = 0{,}026\\,\\ln\\!\\left(\\dfrac{${fx(NAc)}\\times${fx(NDc)}}{2{,}25\\cdot10^{20}}\\right) \\approx ${fx(V0)}\\ \\text{V}$.`,
          },
        ],
      };
    },
  },
  {
    id: 'gen-divider',
    title: 'Diviseur de tension',
    difficulty: 1,
    conceptIds: ['c0-diviseurs'],
    make(seed) {
      const rng = mulberry32(seed);
      const R1 = pick([1, 2.2, 4.7, 10, 22, 47], rng);
      const R2 = pick([1, 2.2, 3.3, 10, 15, 33], rng);
      const Vs = pick([3.3, 5, 9, 12], rng);
      const V2 = (R2 / (R1 + R2)) * Vs;
      return {
        generatorId: this.id,
        seed,
        title: this.title,
        difficulty: 1,
        conceptIds: this.conceptIds,
        statement: `$R_1 = ${fx(R1)}$ kΩ et $R_2 = ${fx(R2)}$ kΩ sont en série sous $${fx(Vs)}$ V. Quelle est la tension aux bornes de $R_2$ (rien n’est branché au point milieu) ?`,
        question: q(
          `${this.id}-${seed}`,
          this.conceptIds,
          1,
          V2,
          'V',
          `$V_2 = \\frac{R_2}{R_1+R_2}V_s \\approx ${fx(V2)}$ V.`,
        ),
        hints: [
          'Les deux résistances sont parcourues par le même courant.',
          'Diviseur de tension.',
          `$V_2 = \\frac{${fx(R2)}}{${fx(R1 + R2)}}\\times${fx(Vs)}$.`,
        ],
        steps: [
          {
            md: `$V_2 = \\dfrac{R_2}{R_1+R_2}V_s = \\dfrac{${fx(R2)}}{${fx(R1 + R2)}}\\times${fx(Vs)} \\approx ${fx(V2)}\\ \\text{V}$.`,
          },
        ],
      };
    },
  },
];

export const generatorById = (id: string) => GENERATORS.find((g) => g.id === id);
