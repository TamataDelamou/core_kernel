import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AbonnementProduitOrmEntity,
  OrganisationOrmEntity,
  UniteOperationnelleOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';

import {
  TypeOrmAbonnementProduitRepository,
  TypeOrmOrganisationRepository,
  TypeOrmUniteOperationnelleRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';

import {
  ABONNEMENT_PRODUIT_REPOSITORY,
  ORGANISATION_REPOSITORY,
  UNITE_OPERATIONNELLE_REPOSITORY,
} from './domain/repositories/org.repositories';

import { ORGANISATION_LOOKUP_PORT } from '../common/kernel-ports/organisation-lookup.port';
import { OrganisationLookupAdapter } from './infrastructure/adapters/organisation-lookup.adapter';
import { ORGANISATION_REFERENTIAL_LOOKUP_PORT } from '../common/kernel-ports/organisation-referential-lookup.port';
import { OrganisationReferentialLookupAdapter } from './infrastructure/adapters/organisation-referential-lookup.adapter';
// KER-PROD-01 : import du MODULE ProductRegistryModule uniquement, pour la résolution DI de
// PRODUCT_LOOKUP_PORT (validation de AbonnementProduit.produitId) — jamais une dépendance à
// son domaine ou son application. Sens unique, comme les autres consommateurs de ce port.
import { ProductRegistryModule } from '../product-registry/product-registry.module';

import {
  CreateOrganisationUseCase,
  GetOrganisationUseCase,
  ListFilialesUseCase,
  ListOrganisationsUseCase,
  ReattachOrganisationUseCase,
  SetOrganisationActivationUseCase,
  UpdateOrganisationReferentielUseCase,
  UpdateOrganisationUseCase,
} from './application/use-cases/organisation.use-cases';
import {
  CreateUniteOperationnelleUseCase,
  ListUnitesByOrganisationUseCase,
  SetUniteOperationnelleActivationUseCase,
  UpdateUniteOperationnelleReferentielUseCase,
} from './application/use-cases/unite-operationnelle.use-cases';
import {
  ListAbonnementsByOrganisationUseCase,
  SubscribeToProduitUseCase,
  TransitionAbonnementUseCase,
} from './application/use-cases/abonnement.use-cases';

import { OrganisationController } from './interface/http/controllers/organisation.controller';
import { UniteOperationnelleController } from './interface/http/controllers/unite-operationnelle.controller';
import { AbonnementController } from './interface/http/controllers/abonnement.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganisationOrmEntity, UniteOperationnelleOrmEntity, AbonnementProduitOrmEntity]),
    ProductRegistryModule,
  ],
  controllers: [OrganisationController, UniteOperationnelleController, AbonnementController],
  providers: [
    // Repositories (ports → adaptateurs TypeORM)
    { provide: ORGANISATION_REPOSITORY, useClass: TypeOrmOrganisationRepository },
    { provide: UNITE_OPERATIONNELLE_REPOSITORY, useClass: TypeOrmUniteOperationnelleRepository },
    { provide: ABONNEMENT_PRODUIT_REPOSITORY, useClass: TypeOrmAbonnementProduitRepository },

    // Port transverse exposé aux autres briques du noyau (ferme le contrôle de portée KER-ORG-03
    // côté GSG ID — voir identity/application/use-cases/external-identity-and-profile.use-cases.ts).
    { provide: ORGANISATION_LOOKUP_PORT, useClass: OrganisationLookupAdapter },
    { provide: ORGANISATION_REFERENTIAL_LOOKUP_PORT, useClass: OrganisationReferentialLookupAdapter },

    // Use-cases
    CreateOrganisationUseCase,
    UpdateOrganisationUseCase,
    UpdateOrganisationReferentielUseCase,
    ReattachOrganisationUseCase,
    SetOrganisationActivationUseCase,
    GetOrganisationUseCase,
    ListOrganisationsUseCase,
    ListFilialesUseCase,

    CreateUniteOperationnelleUseCase,
    UpdateUniteOperationnelleReferentielUseCase,
    ListUnitesByOrganisationUseCase,
    SetUniteOperationnelleActivationUseCase,

    SubscribeToProduitUseCase,
    TransitionAbonnementUseCase,
    ListAbonnementsByOrganisationUseCase,

    // Cross-cutting
    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [ORGANISATION_LOOKUP_PORT, ORGANISATION_REPOSITORY, ORGANISATION_REFERENTIAL_LOOKUP_PORT],
})
export class OrgModule {}
