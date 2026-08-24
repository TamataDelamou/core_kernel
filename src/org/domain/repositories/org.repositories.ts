import { Organisation } from '../entities/organisation.entity';
import { UniteOperationnelle } from '../entities/unite-operationnelle.entity';
import { AbonnementProduit } from '../entities/abonnement-produit.entity';

export const ORGANISATION_REPOSITORY = Symbol('ORGANISATION_REPOSITORY');
export interface OrganisationRepository {
  findById(id: string): Promise<Organisation | null>;
  findByOrganisationMere(organisationMereId: string): Promise<Organisation[]>;
  list(params: { activesUniquement: boolean }): Promise<Organisation[]>;
  save(organisation: Organisation): Promise<void>;
  /** Détecte un cycle dans la chaîne de filiation avant tout rattachement (intégrité de l'arbre). */
  isDescendantOf(candidateAncestorId: string, organisationId: string): Promise<boolean>;
}

export const UNITE_OPERATIONNELLE_REPOSITORY = Symbol('UNITE_OPERATIONNELLE_REPOSITORY');
export interface UniteOperationnelleRepository {
  findById(id: string): Promise<UniteOperationnelle | null>;
  findByOrganisation(organisationId: string): Promise<UniteOperationnelle[]>;
  save(unite: UniteOperationnelle): Promise<void>;
}

export const ABONNEMENT_PRODUIT_REPOSITORY = Symbol('ABONNEMENT_PRODUIT_REPOSITORY');
export interface AbonnementProduitRepository {
  findById(id: string): Promise<AbonnementProduit | null>;
  findByOrganisation(organisationId: string): Promise<AbonnementProduit[]>;
  findByOrganisationAndProduit(organisationId: string, produitId: string): Promise<AbonnementProduit | null>;
  save(abonnement: AbonnementProduit): Promise<void>;
}
