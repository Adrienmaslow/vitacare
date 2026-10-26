/** Contenus pédagogiques de culture financière (généraux, sans barème daté). */
export interface Lesson {
  slug: string;
  title: string;
  minutes: number;
  points: string[];
}

export const LESSONS: Lesson[] = [
  { slug: "budget", title: "Construire un budget qui tient", minutes: 3, points: ["Commence par tes revenus certains, pas par ceux espérés.", "Paie d'abord tes charges fixes (loyer, téléphone, assurance), puis l'épargne, puis le reste.", "Un budget n'est pas une punition : prévois une enveloppe plaisir réaliste.", "Compare chaque mois le prévu et le réel, puis ajuste."] },
  { slug: "epargne-precaution", title: "L'épargne de précaution", minutes: 2, points: ["C'est une réserve pour les imprévus : réparation, facture médicale, perte de job.", "Objectif courant : l'équivalent d'un mois de dépenses, à construire progressivement.", "Place-la sur un support disponible immédiatement (livret réglementé par exemple).", "Même 10 € par mois créent l'habitude."] },
  { slug: "decouvert", title: "Comprendre le découvert", minutes: 3, points: ["Un découvert est un crédit : il coûte des agios et parfois des frais de rejet.", "Le découvert autorisé a un plafond et une durée fixés par ta convention de compte.", "Au-delà, les frais augmentent fortement : anticiper vaut mieux que subir.", "Si tu es régulièrement à découvert, parle-en à ta banque ou au service social de ton établissement."] },
  { slug: "frais-bancaires", title: "Les frais bancaires", minutes: 2, points: ["Lis la plaquette tarifaire : carte, tenue de compte, retraits, incidents.", "Les offres jeunes et les banques en ligne ont souvent des frais réduits.", "Les frais d'incident (rejet, commission d'intervention) sont plafonnés par la loi pour certains publics.", "Compare au moins une fois par an."] },
  { slug: "fiche-de-paie", title: "Lire sa fiche de paie", minutes: 3, points: ["Le salaire brut moins les cotisations salariales donne le net avant impôt.", "Le prélèvement à la source est ensuite retenu, selon ton taux.", "Vérifie les heures, le taux horaire et les congés payés.", "Conserve tes bulletins : ils servent pour tes droits (retraite, chômage, aides)."] },
  { slug: "impots", title: "Impôts : les bases", minutes: 3, points: ["Tu peux être rattaché au foyer fiscal de tes parents ou déclarer seul.", "Certains salaires d'étudiants bénéficient d'une exonération sous conditions : vérifie le plafond de l'année sur impots.gouv.fr.", "Déclarer ses revenus est obligatoire même si tu ne paies pas d'impôt.", "Ta situation fiscale peut influencer certaines aides."] },
  { slug: "aides", title: "Les aides : réflexes utiles", minutes: 2, points: ["Utilise les simulateurs officiels avant de conclure que tu n'as droit à rien.", "Prépare tes justificatifs à l'avance.", "Note les dates limites : certaines campagnes sont annuelles.", "Signale tout changement de situation pour éviter les rappels d'indus."] },
  { slug: "contrats", title: "Contrats : CDD, intérim, freelance", minutes: 3, points: ["CDD et intérim sont des contrats salariés avec bulletin de paie.", "Le CESU est souvent utilisé pour le babysitting ou les cours chez des particuliers.", "En micro-entreprise, tu déclares ton chiffre d'affaires et paies des cotisations proportionnelles.", "Un statut indépendant n'ouvre pas les mêmes droits qu'un contrat salarié."] },
  { slug: "arnaques", title: "Repérer les arnaques financières", minutes: 3, points: ["Méfie-toi des « jobs » qui demandent de recevoir et renvoyer de l'argent : c'est souvent du blanchiment (« mule »).", "Ta banque ne te demandera jamais tes codes par téléphone ou SMS.", "Un rendement garanti très élevé est un signal d'alerte.", "En cas de doute, raccroche et rappelle via le numéro officiel."] },
];

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export const QUIZ: QuizQuestion[] = [
  { q: "Quelle dépense payer en priorité en début de mois ?", options: ["Les sorties", "Le loyer et les charges fixes", "Le shopping"], answer: 1, explanation: "Les charges fixes sont incompressibles : les payer d'abord évite les mauvaises surprises." },
  { q: "Un découvert autorisé, c'est…", options: ["De l'argent gratuit", "Un crédit qui coûte des agios", "Un bonus de la banque"], answer: 1, explanation: "Même autorisé, le découvert génère des intérêts débiteurs." },
  { q: "L'épargne de précaution sert à…", options: ["Investir en bourse", "Absorber un imprévu", "Payer ses vacances"], answer: 1, explanation: "Elle doit rester disponible immédiatement pour faire face aux imprévus." },
  { q: "On te propose 300 € pour recevoir un virement et le renvoyer. C'est…", options: ["Un job facile", "Probablement une arnaque de type « mule »", "Une aide de l'État"], answer: 1, explanation: "Ces schémas servent au blanchiment et peuvent engager ta responsabilité pénale." },
  { q: "Un abonnement à 9,99 €/mois coûte par an environ…", options: ["60 €", "120 €", "200 €"], answer: 1, explanation: "9,99 × 12 = 119,88 € : penser en coût annuel aide à décider." },
];

export const CHEAP_MEALS = [
  { name: "Dahl de lentilles corail et riz", tip: "Légumineuses sèches : très économiques et riches en protéines." },
  { name: "Pâtes complètes, sauce tomate maison et pois chiches", tip: "Prépare la sauce en grande quantité et congèle-la." },
  { name: "Omelette aux légumes de saison", tip: "Les légumes de saison sont moins chers et plus savoureux." },
  { name: "Chili sin carne", tip: "Haricots rouges, maïs, tomates : un plat complet pour plusieurs repas." },
  { name: "Soupe de légumes et tartines", tip: "Idéal pour utiliser les restes et limiter le gaspillage." },
  { name: "Curry de pommes de terre et épinards", tip: "Les surgelés nature sont une bonne option bon marché." },
];
