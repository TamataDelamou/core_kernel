/**
 * Workflow de publication du noyau (KER-AUD-04, KER-ENG-07) : brouillon → en_revision →
 * valide → publie. Copie DÉLIBÉRÉE de `referential/domain/entities/workflow.ts`, jamais un
 * import : la directive d'implémentation de ce module interdit toute dépendance directe au
 * domaine de `referential` ou `org`. Les deux fichiers doivent rester synchronisés
 * manuellement si la politique de transitions évolue — un coût assumé en échange d'une
 * isolation de module réellement étanche, cohérent avec le choix déjà fait pour
 * `product/domain/entities/catalog-workflow.ts` (qui, lui, diverge par un état ARCHIVE
 * supplémentaire propre au cycle de vie commercial — ce module-ci reste fidèle aux 4 états
 * exacts du workflow KER-AUD-04, sans ajout).
 */
export type StatutWorkflowEngine = 'brouillon' | 'en_revision' | 'valide' | 'publie';

export class WorkflowEngineTransitionError extends Error {
  constructor(from: StatutWorkflowEngine, to: StatutWorkflowEngine) {
    super(`Transition de workflow invalide : "${from}" → "${to}".`);
    this.name = 'WorkflowEngineTransitionError';
  }
}

const ALLOWED_TRANSITIONS: Record<StatutWorkflowEngine, StatutWorkflowEngine[]> = {
  brouillon: ['en_revision'],
  en_revision: ['valide', 'brouillon'],
  valide: ['publie', 'en_revision'],
  publie: [],
};

export function assertEngineTransitionAllowed(
  from: StatutWorkflowEngine,
  to: StatutWorkflowEngine,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new WorkflowEngineTransitionError(from, to);
  }
}
