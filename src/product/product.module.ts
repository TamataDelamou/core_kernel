import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CatalogueOrmEntity,
  FeatureOrmEntity,
  GrilleTarifaireOrmEntity,
  OffreEntitlementOrmEntity,
  OffreOrmEntity,
  ProduitOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';

import {
  TypeOrmCatalogueRepository,
  TypeOrmFeatureRepository,
  TypeOrmGrilleTarifaireRepository,
  TypeOrmOffreEntitlementRepository,
  TypeOrmOffreRepository,
  TypeOrmProduitRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';

import {
  CATALOGUE_REPOSITORY,
  FEATURE_REPOSITORY,
  GRILLE_TARIFAIRE_REPOSITORY,
  OFFRE_ENTITLEMENT_REPOSITORY,
  OFFRE_REPOSITORY,
  PRODUIT_REPOSITORY,
} from './domain/repositories/product.repositories';

import {
  AssertOrganisationCanAccessCatalogueUseCase,
  CreateCatalogueUseCase,
  GetCatalogueUseCase,
  ListCataloguesUseCase,
  TransitionCatalogueWorkflowUseCase,
  UpdateCatalogueUseCase,
} from './application/use-cases/catalogue.use-cases';
import {
  CreateProduitUseCase,
  ListProduitsByCatalogueUseCase,
  TransitionProduitWorkflowUseCase,
  UpdateProduitUseCase,
} from './application/use-cases/produit.use-cases';
import {
  CreateOffreUseCase,
  ListOffresByProduitUseCase,
  TransitionOffreWorkflowUseCase,
  UpdateOffreUseCase,
} from './application/use-cases/offre.use-cases';
import {
  AttachEntitlementToOffreUseCase,
  CreateFeatureUseCase,
  ListEntitlementsByOffreUseCase,
  ListFeaturesUseCase,
} from './application/use-cases/feature.use-cases';
import {
  CreateGrilleTarifaireUseCase,
  ResolveActivePriceUseCase,
  TransitionGrilleTarifaireWorkflowUseCase,
} from './application/use-cases/grille-tarifaire.use-cases';

import { CatalogueController } from './interface/http/controllers/catalogue.controller';
import { ProduitController } from './interface/http/controllers/produit.controller';
import { OffreController } from './interface/http/controllers/offre.controller';
import { FeatureController } from './interface/http/controllers/feature.controller';
import { GrilleTarifaireController } from './interface/http/controllers/grille-tarifaire.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Isolation stricte (directive de développement) : ProductModule n'importe JAMAIS de classe
// de domaine, de repository, d'entité ORM ni de use-case appartenant à `identity`,
// `referential` ou `org`. Les deux seules dépendances inter-modules ci-dessous sont des
// imports de MODULE NestJS, exclusivement pour que le conteneur de dépendances résolve les
// providers `ORGANISATION_LOOKUP_PORT` et `CURRENCY_VALIDATION_PORT` — des ports déclarés
// dans `common/kernel-ports/`, jamais du code métier propre à ces modules. Aucun fichier de
// `product/` ne référence `org/domain`, `org/application`, `referential/domain` ou
// `referential/application` : seul `product.module.ts` connaît l'existence de ces modules,
// et uniquement pour le câblage DI — exactement le même schéma que `identity.module.ts`
// import de `OrgModule` déjà établi dans ce projet.
import { OrgModule } from '../org/org.module';
import { ReferentialModule } from '../referential/referential.module';
import { ProductRegistryModule } from '../product-registry/product-registry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogueOrmEntity,
      ProduitOrmEntity,
      OffreOrmEntity,
      FeatureOrmEntity,
      OffreEntitlementOrmEntity,
      GrilleTarifaireOrmEntity,
    ]),
    OrgModule,
    ReferentialModule,
    ProductRegistryModule,
  ],
  controllers: [
    CatalogueController,
    ProduitController,
    OffreController,
    FeatureController,
    GrilleTarifaireController,
  ],
  providers: [
    // Repositories (ports → adaptateurs TypeORM)
    { provide: CATALOGUE_REPOSITORY, useClass: TypeOrmCatalogueRepository },
    { provide: PRODUIT_REPOSITORY, useClass: TypeOrmProduitRepository },
    { provide: OFFRE_REPOSITORY, useClass: TypeOrmOffreRepository },
    { provide: FEATURE_REPOSITORY, useClass: TypeOrmFeatureRepository },
    { provide: OFFRE_ENTITLEMENT_REPOSITORY, useClass: TypeOrmOffreEntitlementRepository },
    { provide: GRILLE_TARIFAIRE_REPOSITORY, useClass: TypeOrmGrilleTarifaireRepository },

    // Use-cases
    CreateCatalogueUseCase,
    UpdateCatalogueUseCase,
    TransitionCatalogueWorkflowUseCase,
    GetCatalogueUseCase,
    ListCataloguesUseCase,
    AssertOrganisationCanAccessCatalogueUseCase,

    CreateProduitUseCase,
    UpdateProduitUseCase,
    TransitionProduitWorkflowUseCase,
    ListProduitsByCatalogueUseCase,

    CreateOffreUseCase,
    UpdateOffreUseCase,
    TransitionOffreWorkflowUseCase,
    ListOffresByProduitUseCase,

    CreateFeatureUseCase,
    ListFeaturesUseCase,
    AttachEntitlementToOffreUseCase,
    ListEntitlementsByOffreUseCase,

    CreateGrilleTarifaireUseCase,
    TransitionGrilleTarifaireWorkflowUseCase,
    ResolveActivePriceUseCase,

    // Cross-cutting
    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class ProductModule {}
