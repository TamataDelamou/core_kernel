export const REGLE_LOOKUP_PORT = Symbol('REGLE_LOOKUP_PORT');

export interface RegleInfo {
  id: string;
  nom: string;
  sigle: string | null;
  valeur: string;
  organismeCertificateur: string;
}

/**
 * Port de lecture exposé par le Referential Engine à tout futur produit consommant des
 * règles métier (taux de TVA, seuils d'agrément — KER-ENG-08). KER-ENG-06 : "aucune donnée
 * 'À vérifier' n'est utilisée en production sans validation explicite" — cette garantie est
 * appliquée ICI, à la frontière du port, pas seulement documentée : l'implémentation ne peut
 * structurellement pas renvoyer une règle dont le statutConfiance vaut A_VERIFIER, ni une
 * règle désactivée. Aucun module du noyau ne consomme encore ce port à ce jour (aucun produit
 * comme EduRéussite ou GlobalStock n'existe encore dans ce dépôt) — il est exposé par
 * anticipation, exactement l'esprit du méta-modèle générique de la section 8.
 */
export interface RegleLookupPort {
  getReglesForNoeud(noeudId: string): Promise<RegleInfo[]>;
}
