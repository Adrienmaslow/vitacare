import type { Chapter, Concept, Course } from '@/types';

export const COURSE: Course = {
  id: 'atome-puce',
  title: 'De l’atome à la puce',
  program: 'ECE Paris — ING2, semestre 3 — Département d’électronique',
  chapterIds: ['c0', 'c1', 'c2'],
};

export const DOCS = {
  cours0: { title: 'Cours 0 : Révisions ING1', authors: 'Thierry MINOT (co-auteurs : Maxime SCHNEIDER, Neil ROSTAND)', pages: 36 },
  cours1: { title: 'Cours 1 : Conducteurs et composants', authors: 'Maxime SCHNEIDER (co-auteurs : Thierry MINOT, Neil ROSTAND)', pages: 53 },
  cours2: { title: 'Cours 2 : Semi-conducteurs et jonction PN', authors: 'Maxime SCHNEIDER (co-auteurs : Thierry MINOT, Neil ROSTAND)', pages: 44 },
  livret: { title: 'Livret d’exercices — De l’atome à la puce (TD1–TD2)', authors: 'Département d’électronique, ECE', pages: 18 },
} as const;

export const CHAPTERS: Chapter[] = [
  {
    id: 'c0',
    courseId: 'atome-puce',
    number: 0,
    title: 'Révisions ING1',
    shortTitle: 'Cours 0',
    summary:
      'Sources, loi d’Ohm, lois de Kirchhoff, diviseurs, méthodes d’analyse, grands théorèmes et AOP idéal.',
    whyItMatters:
      'Les TD1 et TD2 utilisent surtout la loi d’Ohm, les conventions et les conversions d’unités. Le reste du cours 0 sert dans les chapitres suivants (diodes, transistors).',
    objectives: [
      'Écrire la loi d’Ohm avec le bon signe selon les conventions.',
      'Appliquer les lois des nœuds et des mailles.',
      'Utiliser les diviseurs de tension et de courant.',
      'Connaître les méthodes et théorèmes d’analyse de circuits (nœuds, mailles, Millman, Thévenin, Norton).',
      'Reconnaître les montages fondamentaux de l’AOP idéal.',
    ],
    prerequisiteChapterIds: [],
    lessonIds: ['c0-l0', 'c0-l2', 'c0-l3', 'c0-l4', 'c0-l1', 'c0-l5', 'c0-l6', 'c0-l7', 'c0-l8'],
    tds: [],
    status: 'active',
    source: { doc: 'cours0', pages: '1-36' },
  },
  {
    id: 'c1',
    courseId: 'atome-puce',
    number: 1,
    title: 'Conducteurs et composants',
    shortTitle: 'Cours 1',
    summary:
      'Convention récepteur, conduction (vitesse de dérive, densité de courant, loi d’Ohm locale), résistivité, résistances et condensateurs.',
    whyItMatters:
      'Comprendre d’où vient la résistance d’un fil et comment un condensateur stocke des charges : c’est tout le TD1.',
    objectives: [
      'Relier tension, champ électrique et mouvement des électrons.',
      'Calculer une vitesse de dérive et une densité de courant.',
      'Utiliser R = ρℓ/S avec les bonnes unités.',
      'Expliquer l’effet de la température et des impuretés sur la résistivité.',
      'Calculer la capacité d’un condensateur plan et la charge stockée.',
    ],
    prerequisiteChapterIds: ['c0'],
    lessonIds: ['c1-l1', 'c1-l2', 'c1-l3', 'c1-l4', 'c1-l5', 'c1-l6', 'c1-l7'],
    tds: ['TD1'],
    status: 'active',
    source: { doc: 'cours1', pages: '1-53' },
  },
  {
    id: 'c2',
    courseId: 'atome-puce',
    number: 2,
    title: 'Semi-conducteurs et jonction PN',
    shortTitle: 'Cours 2',
    summary:
      'Atome et cristal de silicium, bandes d’énergie, porteurs intrinsèques, dopage N et P, loi d’action de masse, courants de conduction et de diffusion, jonction PN.',
    whyItMatters:
      'C’est la physique de toutes les puces : le TD2 en applique chaque étape, et la jonction PN prépare la diode du cours 3.',
    objectives: [
      'Décrire les bandes d’énergie d’un isolant, d’un semi-conducteur et d’un conducteur.',
      'Distinguer électrons et trous, porteurs majoritaires et minoritaires.',
      'Calculer n et p avec la loi d’action de masse.',
      'Calculer la conductivité d’un semi-conducteur dopé.',
      'Expliquer la zone de charge d’espace et l’effet d’une polarisation.',
    ],
    prerequisiteChapterIds: ['c1'],
    lessonIds: [
      'c2-l1',
      'c2-l2',
      'c2-l3',
      'c2-l4',
      'c2-l5',
      'c2-l6',
      'c2-l7',
      'c2-l8',
      'c2-l9',
      'c2-l10',
    ],
    tds: ['TD2'],
    status: 'active',
    source: { doc: 'cours2', pages: '1-44' },
  },
];

/** Chapitres futurs : la structure est prête, le contenu n'est pas encore intégré. */
export const PLANNED_CHAPTERS = [
  { number: 3, title: 'Les diodes (TD3, TD4)' },
  { number: 4, title: 'Polarisation du BJT (TD5)' },
  { number: 5, title: 'Le BJT en régime dynamique (TD6)' },
  { number: 6, title: 'Le PCB' },
  { number: 7, title: 'Le transistor FET (TD7, TD8)' },
  { number: 8, title: 'La logique CMOS (TD9, TD10)' },
  { number: 9, title: 'Les mémoires (TD11 : révisions)' },
];

export const CONCEPTS: Concept[] = [
  // ---- Cours 0
  { id: 'c0-unites', chapterId: 'c0', title: 'Unités, préfixes et conversions', summary: 'Préfixes SI, puissances de 10, conversions cm ↔ m, mm² ↔ m².', prerequisiteIds: [], tdRelevance: 'indispensable' },
  { id: 'c0-sources', chapterId: 'c0', title: 'Sources indépendantes et dépendantes', summary: 'Sources de tension et de courant, sources commandées.', prerequisiteIds: [], tdRelevance: 'culture' },
  { id: 'c0-transfo', chapterId: 'c0', title: 'Transformation de sources (MET ↔ MEN)', summary: 'Modèle équivalent de Thévenin et de Norton d’une source.', prerequisiteIds: ['c0-sources', 'c0-ohm'], tdRelevance: 'culture' },
  { id: 'c0-ohm', chapterId: 'c0', title: 'Loi d’Ohm et conventions', summary: 'U = RI, signe selon le sens du courant, 2ᵉ formulation I = (V_A − V_B)/R.', prerequisiteIds: [], tdRelevance: 'indispensable' },
  { id: 'c0-kirchhoff', chapterId: 'c0', title: 'Lois de Kirchhoff', summary: 'Loi des nœuds et loi des mailles.', prerequisiteIds: ['c0-ohm'], tdRelevance: 'utile' },
  { id: 'c0-diviseurs', chapterId: 'c0', title: 'Diviseurs de tension et de courant', summary: 'Formules et conditions d’application.', prerequisiteIds: ['c0-ohm', 'c0-kirchhoff'], tdRelevance: 'utile' },
  { id: 'c0-noeuds-mailles', chapterId: 'c0', title: 'Méthodes des nœuds et des mailles', summary: 'Mise en équations systématique d’un circuit.', prerequisiteIds: ['c0-kirchhoff'], tdRelevance: 'culture' },
  { id: 'c0-superposition-millman', chapterId: 'c0', title: 'Superposition et Millman', summary: 'Sommer les effets des sources ; potentiel d’un nœud.', prerequisiteIds: ['c0-noeuds-mailles'], tdRelevance: 'culture' },
  { id: 'c0-thevenin-norton', chapterId: 'c0', title: 'Théorèmes de Thévenin et Norton', summary: 'Remplacer un circuit linéaire par un générateur équivalent.', prerequisiteIds: ['c0-transfo', 'c0-noeuds-mailles'], tdRelevance: 'culture' },
  { id: 'c0-aop', chapterId: 'c0', title: 'Amplificateur opérationnel idéal', summary: 'Modèle idéal, régime linéaire, montages fondamentaux.', prerequisiteIds: ['c0-ohm', 'c0-kirchhoff'], tdRelevance: 'culture' },
  // ---- Cours 1
  { id: 'c1-convention', chapterId: 'c1', title: 'Convention récepteur', summary: 'Pour un récepteur, tension et courant fléchés en sens opposés : u = +Ri.', prerequisiteIds: ['c0-ohm'], tdRelevance: 'utile' },
  { id: 'c1-champ', chapterId: 'c1', title: 'Champ électrique et courant', summary: 'Une ddp crée un champ E = u/ℓ ; F = qE ; i = dq/dt.', prerequisiteIds: ['c1-convention'], tdRelevance: 'indispensable' },
  { id: 'c1-derive', chapterId: 'c1', title: 'Vitesse de dérive et mobilité', summary: 'Modèle de Drude, v = −μE, μ = eτ/m.', prerequisiteIds: ['c1-champ'], tdRelevance: 'indispensable' },
  { id: 'c1-densite', chapterId: 'c1', title: 'Densité de courant', summary: 'j = −nev = ρ_m v ; i = ∬ j·dS.', prerequisiteIds: ['c1-derive'], tdRelevance: 'indispensable' },
  { id: 'c1-ohm-locale', chapterId: 'c1', title: 'Loi d’Ohm locale et conductivité', summary: 'j = γE avec γ = ne²τ/m.', prerequisiteIds: ['c1-densite'], tdRelevance: 'indispensable' },
  { id: 'c1-resistivite', chapterId: 'c1', title: 'Résistance et résistivité', summary: 'R = ρℓ/S, ρ = 1/γ, influence de la géométrie et du matériau.', prerequisiteIds: ['c1-ohm-locale', 'c0-unites'], tdRelevance: 'indispensable' },
  { id: 'c1-temperature', chapterId: 'c1', title: 'Température et impuretés', summary: 'Loi de Matthiessen, ρ = ρ₀ + Δρ.', prerequisiteIds: ['c1-resistivite'], tdRelevance: 'indispensable' },
  { id: 'c1-composants', chapterId: 'c1', title: 'Composants et usages de la résistance', summary: 'Passif/actif, diviseur, tirage, potentiomètre, suiveur, modèle réel.', prerequisiteIds: ['c1-resistivite', 'c0-diviseurs'], tdRelevance: 'culture' },
  { id: 'c1-condensateur', chapterId: 'c1', title: 'Condensateur et capacité', summary: 'C = q/u, i = C du/dt, C = ε₀ε_r S/d.', prerequisiteIds: ['c1-champ', 'c0-unites'], tdRelevance: 'indispensable' },
  { id: 'c1-condensateur-usages', chapterId: 'c1', title: 'Applications du condensateur', summary: 'Découplage, liaison, filtrage, échantillonnage, anti-rebond, modèle réel.', prerequisiteIds: ['c1-condensateur'], tdRelevance: 'culture' },
  // ---- Cours 2
  { id: 'c2-atome', chapterId: 'c2', title: 'Structure de l’atome', summary: 'Noyau, nucléons, couches K/L/M, électrons de valence.', prerequisiteIds: [], tdRelevance: 'utile' },
  { id: 'c2-cristal', chapterId: 'c2', title: 'Cristal de silicium', summary: 'Liaisons covalentes, règle de l’octet, structure tétraédrique.', prerequisiteIds: ['c2-atome'], tdRelevance: 'utile' },
  { id: 'c2-denombrement', chapterId: 'c2', title: 'Nombre d’atomes par unité de volume', summary: 'N = 𝒩_A·ρ/M : de la masse volumique au nombre d’atomes.', prerequisiteIds: ['c0-unites'], tdRelevance: 'indispensable' },
  { id: 'c2-thermique', chapterId: 'c2', title: 'Énergie thermique', summary: 'Équipartition, ⟨E_c⟩ = 3/2 k_B T ; effet de T sur conducteur et SC.', prerequisiteIds: ['c2-cristal'], tdRelevance: 'utile' },
  { id: 'c2-bandes', chapterId: 'c2', title: 'Bandes d’énergie', summary: 'Bande de valence, de conduction, gap, niveau de Fermi.', prerequisiteIds: ['c2-atome'], tdRelevance: 'indispensable' },
  { id: 'c2-photon', chapterId: 'c2', title: 'Photons et franchissement du gap', summary: 'E = hc/λ ≥ E_g ; photorésistance, photoconduction.', prerequisiteIds: ['c2-bandes'], tdRelevance: 'indispensable' },
  { id: 'c2-intrinseque', chapterId: 'c2', title: 'Semi-conducteur intrinsèque', summary: 'Électrons et trous, n = p = n_i, n_i(T).', prerequisiteIds: ['c2-bandes', 'c2-thermique'], tdRelevance: 'indispensable' },
  { id: 'c2-dopage', chapterId: 'c2', title: 'Dopage N et P', summary: 'Donneurs (colonne 15), accepteurs (colonne 13), majoritaires/minoritaires.', prerequisiteIds: ['c2-intrinseque'], tdRelevance: 'indispensable' },
  { id: 'c2-action-masse', chapterId: 'c2', title: 'Loi d’action de masse', summary: 'np = n_i² ; n ≈ N_D ou p ≈ N_A.', prerequisiteIds: ['c2-dopage'], tdRelevance: 'indispensable' },
  { id: 'c2-conduction-sc', chapterId: 'c2', title: 'Conductivité d’un semi-conducteur', summary: 'γ = e(nμ_n + pμ_p), mobilité et dopage.', prerequisiteIds: ['c2-action-masse', 'c1-ohm-locale'], tdRelevance: 'indispensable' },
  { id: 'c2-diffusion', chapterId: 'c2', title: 'Courant de diffusion', summary: 'Loi de Fick, relation d’Einstein D = μk_BT/q.', prerequisiteIds: ['c2-conduction-sc'], tdRelevance: 'utile' },
  { id: 'c2-jonction', chapterId: 'c2', title: 'Jonction PN à l’équilibre', summary: 'Diffusion, zone de charge d’espace, barrière V₀.', prerequisiteIds: ['c2-diffusion', 'c2-action-masse'], tdRelevance: 'utile' },
  { id: 'c2-polarisation', chapterId: 'c2', title: 'Polarisation de la jonction', summary: 'Directe (passante), inverse (bloquante), courant I_S, relation de Shockley.', prerequisiteIds: ['c2-jonction'], tdRelevance: 'utile' },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id);
export const conceptById = (id: string) => CONCEPTS.find((c) => c.id === id);
export const conceptsOfChapter = (chapterId: string) =>
  CONCEPTS.filter((c) => c.chapterId === chapterId);
