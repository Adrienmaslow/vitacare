/**
 * Aide contextuelle « Explique-moi » — réponses pré-écrites et vérifiées (aucune IA).
 * Une future intégration d'assistant IA passera par un backend sécurisé (voir docs/ARCHITECTURE.md).
 */
export interface ConceptExplanation {
  otherWords: string;
  analogy: string;
  simpleExample: string;
  commonMistake: string;
}

export const EXPLANATIONS: Record<string, ConceptExplanation> = {
  'c0-unites': {
    otherWords:
      'Convertir, c’est réécrire la même grandeur avec une autre unité : la valeur physique ne change pas, seul le nombre change.',
    analogy:
      'Comme changer des euros en centimes : 2 € = 200 c. Pour une surface, on change d’unité deux fois (longueur × longueur).',
    simpleExample: '1 cm = 10⁻² m, donc 1 cm² = 10⁻⁴ m² et 1 cm³ = 10⁻⁶ m³.',
    commonMistake: 'Convertir mm² en m² avec 10⁻³ au lieu de 10⁻⁶.',
  },
  'c0-ohm': {
    otherWords:
      'La tension aux bornes d’une résistance est proportionnelle au courant qui la traverse ; R est le coefficient.',
    analogy:
      'Un tuyau étroit : pour faire passer plus d’eau (courant), il faut plus de pression (tension).',
    simpleExample: '1 kΩ traversée par 1 mA : 1 V.',
    commonMistake: 'Oublier de convertir les mA en A ou les kΩ en Ω.',
  },
  'c0-kirchhoff': {
    otherWords:
      'Nœuds : rien ne se perd. Mailles : en faisant un tour complet, on revient au même potentiel.',
    analogy: 'Un carrefour routier : autant de voitures sortent qu’il en entre.',
    simpleExample: '3 A entrent, 1 A sort par une branche : 2 A sortent par l’autre.',
    commonMistake: 'Mélanger le sens de parcours de la maille et le sens des flèches de tension.',
  },
  'c0-diviseurs': {
    otherWords: 'Deux résistances en série se partagent la tension au prorata de leur valeur.',
    analogy:
      'Deux marches d’escalier de hauteurs différentes : la plus haute « consomme » plus de dénivelé.',
    simpleExample: 'Deux résistances égales : chacune prend la moitié de la tension.',
    commonMistake: 'Appliquer la formule alors qu’une charge tire du courant au point milieu.',
  },
  'c0-sources': {
    otherWords:
      'Une source impose soit une tension, soit un courant ; une source dépendante le fait en fonction d’une autre grandeur du circuit.',
    analogy: 'Un robinet réglé à la main (indépendant) ou par un capteur (dépendant).',
    simpleExample: 'i₂ = 5·i₁ : source de courant commandée par un courant.',
    commonMistake: 'Éteindre une source dépendante lors d’une superposition.',
  },
  'c0-transfo': {
    otherWords:
      'Un générateur de tension avec sa résistance interne équivaut, vu de l’extérieur, à un générateur de courant avec la même résistance en parallèle.',
    analogy: 'Deux descriptions différentes d’une même boîte noire.',
    simpleExample: '10 V en série avec 50 Ω ⇔ 0,2 A en parallèle avec 50 Ω.',
    commonMistake: 'Changer la valeur de la résistance pendant la transformation.',
  },
  'c0-noeuds-mailles': {
    otherWords: 'On met le circuit en équations de façon systématique, sans chercher d’astuce.',
    analogy: 'Une recette : si on suit les étapes, ça marche toujours.',
    simpleExample: 'Deux nœuds inconnus ⇒ deux équations ⇒ deux potentiels.',
    commonMistake: 'Écrire une équation pour le nœud de masse (sa tension est connue : 0 V).',
  },
  'c0-superposition-millman': {
    otherWords:
      'Superposition : on additionne les effets de chaque source seule. Millman : le potentiel d’un nœud est une moyenne pondérée par les conductances.',
    analogy: 'Plusieurs haut-parleurs : le son total est la somme des sons de chacun.',
    simpleExample: 'Nœud relié à 10 V et à 0 V par deux résistances égales : 5 V.',
    commonMistake: 'Remplacer une source de courant par un fil au lieu d’un circuit ouvert.',
  },
  'c0-thevenin-norton': {
    otherWords: 'Tout circuit linéaire vu de deux bornes se résume à une source et une résistance.',
    analogy:
      'Une prise électrique : peu importe la centrale derrière, on voit une tension et une résistance interne.',
    simpleExample: 'V_Th = tension mesurée à vide ; R_Th = V_Th / I_court-circuit.',
    commonMistake: 'Calculer V_Th avec la charge encore branchée.',
  },
  'c0-aop': {
    otherWords:
      'Avec une contre-réaction, l’AOP règle sa sortie pour que ses deux entrées soient au même potentiel, sans consommer de courant en entrée.',
    analogy:
      'Un thermostat très réactif qui ajuste le chauffage pour annuler l’écart avec la consigne.',
    simpleExample: 'Suiveur : V_out = V_in, gain 1.',
    commonMistake: 'Utiliser V⁺ = V⁻ alors que l’AOP est saturé (pas de contre-réaction).',
  },
  'c1-convention': {
    otherWords:
      'Pour un dipôle qui reçoit de l’énergie, on oriente tension et courant en sens opposés ; alors u = +Ri.',
    analogy:
      'L’eau descend la pente : le courant va du haut potentiel vers le bas potentiel dans le récepteur.',
    simpleExample: 'Résistance alimentée par une pile : u_R = +R·i.',
    commonMistake: 'Confondre sens des électrons et sens conventionnel du courant.',
  },
  'c1-champ': {
    otherWords:
      'Une tension appliquée sur une longueur crée un champ ; le champ pousse les charges.',
    analogy: 'La tension est une pente totale, le champ est la pente par mètre.',
    simpleExample: '1 V sur 4 mm : 250 V/m.',
    commonMistake: 'Laisser la longueur en mm.',
  },
  'c1-derive': {
    otherWords:
      'Les électrons s’agitent très vite dans tous les sens, mais n’avancent en moyenne que très lentement dans la direction imposée par le champ.',
    analogy: 'Une foule qui piétine dans tous les sens mais avance lentement vers une sortie.',
    simpleExample: 'Fil de cuivre de 10 m sous 10 V : environ 5 mm/s.',
    commonMistake:
      'Croire que les électrons vont à la vitesse de la lumière (c’est le signal qui se propage vite).',
  },
  'c1-densite': {
    otherWords:
      'La densité de courant dit combien d’ampères passent à travers chaque m² de section.',
    analogy: 'Le débit d’une rivière par mètre carré de section.',
    simpleExample: '2 A sur 1 mm² : 2·10⁶ A/m².',
    commonMistake: 'Confondre ρ_m (densité de charge) et ρ (résistivité).',
  },
  'c1-ohm-locale': {
    otherWords:
      'En chaque point du conducteur, la densité de courant est proportionnelle au champ : c’est la loi d’Ohm vue de l’intérieur.',
    analogy:
      'Plus la pente est forte (champ), plus le débit par m² (j) est grand ; γ dit si le terrain est glissant.',
    simpleExample: 'γ = 10⁶ S/m et E = 1 V/m : j = 10⁶ A/m².',
    commonMistake: 'Écrire γ en S·m au lieu de S/m.',
  },
  'c1-resistivite': {
    otherWords: 'La résistance dépend de ce dont est fait le fil (ρ) et de sa forme (ℓ/S).',
    analogy:
      'Un couloir long et étroit est plus difficile à traverser qu’un couloir court et large.',
    simpleExample: 'Doubler la longueur double R ; doubler le diamètre divise R par 4.',
    commonMistake: 'Utiliser le diamètre au lieu du rayon dans S = πr².',
  },
  'c1-temperature': {
    otherWords:
      'La chaleur et les impuretés ajoutent des obstacles sur le chemin des électrons d’un métal.',
    analogy: 'Un couloir où les gens s’agitent (chaleur) ou où l’on pose des chaises (impuretés).',
    simpleExample: 'Cuivre commercial : 1,675 + 0,17 = 1,845 µΩ·cm.',
    commonMistake:
      'Penser que tous les matériaux résistent plus quand ils chauffent (faux pour les isolants et semi-conducteurs).',
  },
  'c1-composants': {
    otherWords:
      'Un composant passif ne fait que consommer ou stocker ; un composant actif peut amplifier grâce à une alimentation.',
    analogy: 'Un tuyau (passif) contre une pompe (actif).',
    simpleExample: 'Résistance = passif ; transistor = actif.',
    commonMistake: 'Oublier l’effet de la charge sur un pont diviseur.',
  },
  'c1-condensateur': {
    otherWords:
      'Deux plaques séparées par un isolant accumulent des charges opposées ; C mesure combien de charges par volt.',
    analogy:
      'Un réservoir d’eau : la capacité dit combien de litres on stocke par mètre de hauteur.',
    simpleExample: '10 µF sous 5 V : 50 µC.',
    commonMistake: 'Convertir les mm² en m² avec 10⁻³.',
  },
  'c1-condensateur-usages': {
    otherWords:
      'Le condensateur laisse passer les variations rapides et bloque le continu : on s’en sert pour filtrer, découpler, mémoriser.',
    analogy: 'Un amortisseur qui lisse les à-coups.',
    simpleExample: 'R = 1 kΩ, C = 100 nF : f_c ≈ 1,6 kHz.',
    commonMistake: 'Confondre pulsation ω et fréquence f.',
  },
  'c2-atome': {
    otherWords:
      'Ce sont les électrons de la dernière couche (valence) qui font la chimie et l’électronique.',
    analogy: 'Les mains d’un atome : le silicium en a 4 pour se lier à ses voisins.',
    simpleExample: 'Si : 14 électrons = 2 + 8 + 4.',
    commonMistake: 'Confondre nombre total d’électrons et électrons de valence.',
  },
  'c2-cristal': {
    otherWords: 'Chaque atome de silicium partage un électron avec chacun de ses 4 voisins.',
    analogy: 'Des personnes qui se tiennent par les mains dans les quatre directions.',
    simpleExample: '4 liaisons covalentes par atome, structure tétraédrique.',
    commonMistake: 'Parler de liaison ionique pour Si–Si.',
  },
  'c2-denombrement': {
    otherWords: 'On passe de la masse d’un cm³ au nombre de moles, puis au nombre d’atomes.',
    analogy: 'Compter des grains de riz en pesant le paquet et en connaissant la masse d’un grain.',
    simpleExample: 'Silicium : ≈ 5·10²² atomes par cm³.',
    commonMistake: 'Mélanger kg/m³ et g/cm³.',
  },
  'c2-thermique': {
    otherWords: 'La température mesure l’agitation moyenne des atomes.',
    analogy: 'Une salle de danse : plus il fait chaud, plus les gens bougent.',
    simpleExample: 'À 300 K, ⟨E_c⟩ ≈ 6·10⁻²¹ J par atome.',
    commonMistake: 'Utiliser des °C au lieu de kelvins.',
  },
  'c2-bandes': {
    otherWords:
      'Les électrons ne peuvent avoir que certaines énergies, regroupées en bandes ; entre les bandes, un fossé interdit (le gap).',
    analogy:
      'Un parking à deux étages : en bas (valence) tout est plein, en haut (conduction) on peut circuler, mais il faut monter la rampe (le gap).',
    simpleExample: 'Silicium : gap 1,12 eV ; isolant : plusieurs eV ; métal : pas de gap.',
    commonMistake: 'Croire qu’une bande pleine conduit.',
  },
  'c2-photon': {
    otherWords:
      'Un photon peut donner son énergie à un électron ; si elle dépasse le gap, l’électron devient libre.',
    analogy: 'Un ticket d’entrée : il faut au moins le prix du gap.',
    simpleExample: 'Silicium : toute lumière visible suffit (λ < 1,1 µm).',
    commonMistake: 'Oublier que l’énergie DIMINUE quand λ augmente.',
  },
  'c2-intrinseque': {
    otherWords:
      'Dans un semi-conducteur pur, chaque électron libéré laisse un trou : autant de l’un que de l’autre.',
    analogy: 'Une salle de cinéma : chaque spectateur qui se lève laisse un siège vide.',
    simpleExample: 'Silicium à l’ambiante : n = p = n_i ≈ 10¹⁰ cm⁻³.',
    commonMistake: 'Oublier le facteur ½ dans l’exponentielle de n_i.',
  },
  'c2-dopage': {
    otherWords:
      'On remplace quelques atomes de silicium par des atomes ayant un électron de plus (N) ou de moins (P).',
    analogy:
      'Ajouter quelques invités avec un cadeau en trop (N) ou avec une main libre à remplir (P).',
    simpleExample: 'Phosphore ⇒ N ; bore ⇒ P.',
    commonMistake: 'Croire qu’un matériau dopé N est chargé négativement.',
  },
  'c2-action-masse': {
    otherWords:
      'À l’équilibre, le produit n × p est fixé par le matériau et la température : si l’un augmente, l’autre baisse.',
    analogy: 'Une balançoire : plus d’électrons, moins de trous.',
    simpleExample: 'n_i = 10¹⁰, N_D = 10¹⁶ ⇒ p = 10⁴ cm⁻³.',
    commonMistake: 'Mélanger cm⁻³ et m⁻³ dans n_i²/N.',
  },
  'c2-conduction-sc': {
    otherWords:
      'Électrons et trous bougent en sens opposés, mais comme leurs charges sont opposées, leurs courants s’ajoutent.',
    analogy:
      'Deux files de voitures en sens inverse qui transportent des colis opposés : le transfert total s’additionne.',
    simpleExample: 'Type N : γ ≈ N_D e μ_n.',
    commonMistake: 'Écrire n μ_n − p μ_p.',
  },
  'c2-diffusion': {
    otherWords:
      'Sans champ, les porteurs s’étalent quand même des zones concentrées vers les zones peu concentrées.',
    analogy: 'Une goutte d’encre qui s’étale dans un verre d’eau calme.',
    simpleExample: 'μ = 1000 cm²/(V·s), k_BT/q = 25 mV ⇒ D = 25 cm²/s.',
    commonMistake: 'Oublier le signe − de la loi de Fick.',
  },
  'c2-jonction': {
    otherWords:
      'Au contact, électrons et trous se recombinent près de l’interface ; les ions fixes qui restent créent un champ qui stoppe le phénomène.',
    analogy:
      'Deux foules qui se rencontrent : au milieu, une zone vide se forme et un « mur » empêche d’aller plus loin.',
    simpleExample: 'Si, N_A = 10¹⁶, N_D = 10¹⁷ cm⁻³ : V₀ ≈ 0,76 V.',
    commonMistake: 'Penser que la ZCE contient encore des porteurs mobiles.',
  },
  'c2-polarisation': {
    otherWords:
      'Une tension dans le bon sens abaisse la barrière (ça conduit) ; dans l’autre sens, elle la rehausse (ça bloque).',
    analogy: 'Un portillon : poussé dans un sens il s’ouvre, dans l’autre il se verrouille.',
    simpleExample: 'P au + et N au − : passante.',
    commonMistake: 'Croire que le courant inverse est rigoureusement nul.',
  },
};
