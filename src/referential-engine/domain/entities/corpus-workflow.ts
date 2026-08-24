/**
 * Schéma littéral de `corpus_versionne` au Cahier (section 8) : "libelle_version / statut /
 * date_publication... brouillon │ publié │ archivé ; date." Trois états, sans "en_revision"
 * ni "valide" — un cycle de vie de CONTENU (on rédige, on publie au bon moment, on archive
 * quand une nouvelle version le remplace), délibérément plus simple que le workflow de
 * gouvernance structurelle à 4 états de `NoeudHierarchique`/`ReferentielRegle`
 * (brouillon → en_revision → valide → publie, KER-ENG-07). Ne PAS fusionner les deux — ce
 * sont deux cycles de vie réellement différents, pas une simplification hâtive.
 */
export type StatutCorpusWorkflow = 'brouillon' | 'publie' | 'archive';

export class CorpusWorkflowTransitionError extends Error {
  constructor(from: StatutCorpusWorkflow, to: StatutCorpusWorkflow) {
    super(`Transition de workflow corpus invalide : "${from}" → "${to}".`);
    this.name = 'CorpusWorkflowTransitionError';
  }
}

const ALLOWED_TRANSITIONS: Record<StatutCorpusWorkflow, StatutCorpusWorkflow[]> = {
  brouillon: ['publie'],
  publie: ['archive'],
  archive: [],
};

export function assertCorpusTransitionAllowed(from: StatutCorpusWorkflow, to: StatutCorpusWorkflow): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new CorpusWorkflowTransitionError(from, to);
  }
}
