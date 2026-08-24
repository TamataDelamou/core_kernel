import { Catalogue } from '../entities/catalogue.entity';
import { Produit } from '../entities/produit.entity';
import { Offre } from '../entities/offre.entity';
import { Feature, OffreEntitlement } from '../entities/feature.entity';
import { GrilleTarifaire } from '../entities/grille-tarifaire.entity';

export const CATALOGUE_REPOSITORY = Symbol('CATALOGUE_REPOSITORY');
export interface CatalogueRepository {
  findById(id: string): Promise<Catalogue | null>;
  findByOrganisationScope(organisationId: string): Promise<Catalogue | null>;
  list(params: { publiesUniquement: boolean }): Promise<Catalogue[]>;
  save(catalogue: Catalogue): Promise<void>;
}

export const PRODUIT_REPOSITORY = Symbol('PRODUIT_REPOSITORY');
export interface ProduitRepository {
  findById(id: string): Promise<Produit | null>;
  findByCatalogueAndCode(catalogueId: string, code: string): Promise<Produit | null>;
  findByCatalogue(catalogueId: string): Promise<Produit[]>;
  save(produit: Produit): Promise<void>;
}

export const OFFRE_REPOSITORY = Symbol('OFFRE_REPOSITORY');
export interface OffreRepository {
  findById(id: string): Promise<Offre | null>;
  findByProduitAndCode(produitId: string, code: string): Promise<Offre | null>;
  findByProduit(produitId: string): Promise<Offre[]>;
  save(offre: Offre): Promise<void>;
}

export const FEATURE_REPOSITORY = Symbol('FEATURE_REPOSITORY');
export interface FeatureRepository {
  findById(id: string): Promise<Feature | null>;
  findByCode(code: string): Promise<Feature | null>;
  list(params: { activesUniquement: boolean }): Promise<Feature[]>;
  save(feature: Feature): Promise<void>;
}

export const OFFRE_ENTITLEMENT_REPOSITORY = Symbol('OFFRE_ENTITLEMENT_REPOSITORY');
export interface OffreEntitlementRepository {
  findByOffre(offreId: string): Promise<OffreEntitlement[]>;
  findByOffreAndFeature(offreId: string, featureId: string): Promise<OffreEntitlement | null>;
  save(entitlement: OffreEntitlement): Promise<void>;
}

export const GRILLE_TARIFAIRE_REPOSITORY = Symbol('GRILLE_TARIFAIRE_REPOSITORY');
export interface GrilleTarifaireRepository {
  findById(id: string): Promise<GrilleTarifaire | null>;
  findByOffre(offreId: string): Promise<GrilleTarifaire[]>;
  /** Grilles publiées pour une offre et une devise données — sert au contrôle de chevauchement. */
  findPublieesByOffreEtDevise(offreId: string, deviseId: string): Promise<GrilleTarifaire[]>;
  findLatestVersion(offreId: string): Promise<GrilleTarifaire | null>;
  save(grilleTarifaire: GrilleTarifaire): Promise<void>;
}
