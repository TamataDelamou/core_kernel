export const CORPUS_LOOKUP_PORT = Symbol('CORPUS_LOOKUP_PORT');

export interface CorpusElementInfo {
  id: string;
  parentId: string | null;
  nom: string;
  valeurOuCoefficient: string | null;
  ordre: number;
}

export interface CorpusVersionneInfo {
  id: string;
  libelleVersion: string;
  organismeCertificateur: string;
  elements: CorpusElementInfo[];
}

/**
 * Port de lecture exposé par le Referential Engine pour le contenu versionné (programmes
 * scolaires, directives réglementaires — KER-ENG-08). Ne renvoie jamais un corpus au statut
 * `brouillon` : seul un corpus `publie` (voir corpus-workflow.ts) est visible via ce port —
 * un produit consommateur ne doit jamais afficher un contenu en cours de rédaction.
 */
export interface CorpusLookupPort {
  getCorpusPublie(paysId: string, codeDomaine: string): Promise<CorpusVersionneInfo | null>;
}
