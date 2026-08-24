/**
 * Workflow local à GSG Product Catalog (KER-PRD). Volontairement distinct du workflow de
 * publication de GSG Referential (`referential/domain/entities/workflow.ts`, brouillon →
 * en_revision → valide → publie) : l'isolation stricte entre briques du noyau interdit à ce
 * module d'importer du code interne à `referential` (voir directive de développement), et le
 * cycle de vie d'un catalogue/produit/offre n'est de toute façon pas identique — il se
 * termine par un état ARCHIVE que le référentiel géographique ne connaît pas.
 *
 * Cycle : BROUILLON → VALIDE → PUBLIE → ARCHIVE (terminal). Un retour VALIDE → BROUILLON
 * reste possible (rejet avant publication) ; aucune sortie n'existe depuis ARCHIVE.
 */
export type StatutCatalogWorkflow = 'brouillon' | 'valide' | 'publie' | 'archive';

export class CatalogWorkflowTransitionError extends Error {
  constructor(from: StatutCatalogWorkflow, to: StatutCatalogWorkflow) {
    super(`Transition de cycle de vie invalide : "${from}" → "${to}".`);
    this.name = 'CatalogWorkflowTransitionError';
  }
}

const ALLOWED_TRANSITIONS: Record<StatutCatalogWorkflow, StatutCatalogWorkflow[]> = {
  brouillon: ['valide'],
  valide: ['publie', 'brouillon'],
  publie: ['archive'],
  archive: [],
};

export function assertCatalogTransitionAllowed(
  from: StatutCatalogWorkflow,
  to: StatutCatalogWorkflow,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new CatalogWorkflowTransitionError(from, to);
  }
}
