/**
 * KER-INH-01 : "La résolution des paramètres régionaux suit un ordre de priorité strict :
 * Utilisateur → Organisation/Agence → Pays → Global. Le premier niveau où un paramètre est
 * explicitement défini l'emporte." Ordre retenu ici (précision de la directive d'exécution,
 * plus fin que le regroupement "Organisation/Agence" du Cahier) : Utilisateur → Agence/Unité
 * → Organisation → Pays → Configuration Globale — une agence l'emporte sur le défaut de son
 * organisation mère, jamais l'inverse.
 *
 * KER-INH-02 : "Un paramètre non défini à un niveau n'est jamais traité comme une valeur
 * arbitraire codée en dur ; la résolution doit remonter la chaîne d'héritage jusqu'à trouver
 * une valeur explicite, y compris jusqu'au niveau Global." C'est exactement ce que fait
 * `resolveChamp` : `null`/`undefined` à un niveau signifie "non défini ICI", jamais "vide
 * partout" — la boucle continue vers le niveau suivant plutôt que de s'arrêter.
 */
export type ChampHeritable = 'deviseId' | 'langueId' | 'fuseauHoraire' | 'formatDate' | 'formatNombre' | 'adresseGabarit';

export interface NiveauReferentielPartiel {
  deviseId?: string | null;
  langueId?: string | null;
  fuseauHoraire?: string | null;
  formatDate?: string | null;
  formatNombre?: string | null;
  adresseGabarit?: string | null;
}

/**
 * Renvoie la première valeur explicitement définie pour `champ`, en parcourant `niveaux`
 * dans l'ordre fourni par l'appelant (du plus spécifique au plus général). `null` si aucun
 * niveau — y compris le dernier (Global) — ne définit ce champ.
 */
export function resolveChamp(niveaux: readonly NiveauReferentielPartiel[], champ: ChampHeritable): string | null {
  for (const niveau of niveaux) {
    const valeur = niveau[champ];
    if (valeur !== null && valeur !== undefined) return valeur;
  }
  return null;
}

export interface ChampsResolus {
  deviseId: string | null;
  langueId: string | null;
  fuseauHoraire: string | null;
  formatDate: string | null;
  formatNombre: string | null;
  adresseGabarit: string | null;
}

const TOUS_LES_CHAMPS: ChampHeritable[] = [
  'deviseId',
  'langueId',
  'fuseauHoraire',
  'formatDate',
  'formatNombre',
  'adresseGabarit',
];

/** Résout les 6 champs héritables en une seule passe, dans l'ordre de niveaux fourni. */
export function resolveTousLesChamps(niveaux: readonly NiveauReferentielPartiel[]): ChampsResolus {
  const resultat = {} as ChampsResolus;
  for (const champ of TOUS_LES_CHAMPS) {
    resultat[champ] = resolveChamp(niveaux, champ);
  }
  return resultat;
}
