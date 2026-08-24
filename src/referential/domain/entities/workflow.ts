/**
 * KER-AUD-04 : toute modification du référentiel structurel partagé (pays, devise, langue,
 * bloc régional) suit le workflow Brouillon → Révision → Validation → Publication, journalisée
 * dans l'audit centralisé. KER-ENG-07 précise que ce workflow est porté par un back-office
 * transversal commun à tous les produits GSG, pas par un module ad hoc de chaque produit.
 *
 * Seules les entités au statut "publie" sont résolues par défaut pour les produits
 * consommateurs (AppConfig, etc.) ; les statuts intermédiaires restent visibles uniquement
 * via les endpoints de back-office (rôle kernel.admin).
 */
export type StatutWorkflow = 'brouillon' | 'en_revision' | 'valide' | 'publie';

export class WorkflowTransitionError extends Error {
  constructor(from: StatutWorkflow, to: StatutWorkflow) {
    super(`Transition de workflow invalide : "${from}" → "${to}".`);
    this.name = 'WorkflowTransitionError';
  }
}

const ALLOWED_TRANSITIONS: Record<StatutWorkflow, StatutWorkflow[]> = {
  brouillon: ['en_revision'],
  en_revision: ['valide', 'brouillon'], // un retour en brouillon reste possible en cas de rejet
  valide: ['publie', 'en_revision'],
  publie: [], // état terminal ; toute évolution ultérieure repart d'un nouveau brouillon de modification
};

export function assertTransitionAllowed(from: StatutWorkflow, to: StatutWorkflow): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new WorkflowTransitionError(from, to);
  }
}
