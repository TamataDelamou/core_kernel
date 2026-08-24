import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  BlocRegionalOrmEntity,
  DeviseOrmEntity,
  LangueOrmEntity,
  PaysBlocRegionalOrmEntity,
  PaysDeviseOrmEntity,
  PaysLangueOrmEntity,
  PaysOrmEntity,
  TauxChangeOrmEntity,
  VilleOrmEntity,
  LocaleOrmEntity,
  TraductionOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';

import {
  TypeOrmBlocRegionalRepository,
  TypeOrmDeviseRepository,
  TypeOrmLangueRepository,
  TypeOrmPaysBlocRegionalRepository,
  TypeOrmPaysDeviseRepository,
  TypeOrmPaysLangueRepository,
  TypeOrmPaysRepository,
  TypeOrmTauxChangeRepository,
  TypeOrmVilleRepository,
  TypeOrmLocaleRepository,
  TypeOrmTraductionRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';

import {
  BLOC_REGIONAL_REPOSITORY,
  DEVISE_REPOSITORY,
  LANGUE_REPOSITORY,
  PAYS_BLOC_REGIONAL_REPOSITORY,
  PAYS_DEVISE_REPOSITORY,
  PAYS_LANGUE_REPOSITORY,
  PAYS_REPOSITORY,
  TAUX_CHANGE_REPOSITORY,
  VILLE_REPOSITORY,
  LOCALE_REPOSITORY,
  TRADUCTION_REPOSITORY,
} from './domain/repositories/referential.repositories';

import { CURRENCY_VALIDATION_PORT } from '../common/kernel-ports/currency-validation.port';
import { CurrencyValidationAdapter } from './infrastructure/adapters/currency-validation.adapter';
import { REFERENTIAL_DEFAULTS_LOOKUP_PORT } from '../common/kernel-ports/referential-defaults-lookup.port';
import { ReferentialDefaultsLookupAdapter } from './infrastructure/adapters/referential-defaults-lookup.adapter';

import {
  CreatePaysUseCase,
  GetPaysUseCase,
  ListPaysUseCase,
  SetPaysActivationUseCase,
  TransitionPaysWorkflowUseCase,
  UpdatePaysUseCase,
} from './application/use-cases/pays.use-cases';
import {
  AttachDeviseToPaysUseCase,
  CreateDeviseUseCase,
  ListDevisesUseCase,
  TransitionDeviseWorkflowUseCase,
} from './application/use-cases/devise.use-cases';
import {
  AttachLangueToPaysUseCase,
  CreateLangueUseCase,
  ListLanguesUseCase,
  TransitionLangueWorkflowUseCase,
} from './application/use-cases/langue.use-cases';
import {
  AddPaysToBlocRegionalUseCase,
  CreateBlocRegionalUseCase,
  ListBlocsRegionauxUseCase,
  TransitionBlocRegionalWorkflowUseCase,
  WithdrawPaysFromBlocRegionalUseCase,
} from './application/use-cases/bloc-regional.use-cases';
import {
  ResolveExchangeRateUseCase,
  SetTauxChangeUseCase,
} from './application/use-cases/taux-change.use-cases';
import {
  CreateVilleUseCase,
  ListVillesByPaysUseCase,
  MoveVilleUseCase,
  SetVilleActivationUseCase,
} from './application/use-cases/ville.use-cases';
import {
  CreateLocaleUseCase,
  ListLocalesUseCase,
  SetLocaleActivationUseCase,
  SetLocaleParDefautUseCase,
  UpdateLocaleUseCase,
} from './application/use-cases/locale.use-cases';
import {
  CreateTraductionUseCase,
  ListTraductionsByLocaleUseCase,
  UpdateTraductionUseCase,
} from './application/use-cases/traduction.use-cases';

import { PaysController } from './interface/http/controllers/pays.controller';
import { DeviseController } from './interface/http/controllers/devise.controller';
import { LangueController } from './interface/http/controllers/langue.controller';
import { BlocRegionalController } from './interface/http/controllers/bloc-regional.controller';
import { TauxChangeController } from './interface/http/controllers/taux-change.controller';
import { VilleController } from './interface/http/controllers/ville.controller';
import { LocaleController } from './interface/http/controllers/locale.controller';
import { TraductionController } from './interface/http/controllers/traduction.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// KER-ADM-03 : import du MODULE ReferentialEngineModule uniquement, pour la résolution DI de
// REFERENTIAL_ENGINE_LOOKUP_PORT (validation de ville.referentiel_hierarchique_id) — jamais
// une dépendance à son domaine ou son application. Sens unique : ReferentialEngineModule
// n'importe jamais ReferentialModule en retour (voir sa propre note d'isolation), ce qui
// évite tout cycle entre les deux modules.
import { ReferentialEngineModule } from '../referential-engine/referential-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaysOrmEntity,
      DeviseOrmEntity,
      LangueOrmEntity,
      BlocRegionalOrmEntity,
      PaysDeviseOrmEntity,
      PaysLangueOrmEntity,
      PaysBlocRegionalOrmEntity,
      TauxChangeOrmEntity,
      VilleOrmEntity,
      LocaleOrmEntity,
      TraductionOrmEntity,
    ]),
    ReferentialEngineModule,
  ],
  controllers: [
    PaysController,
    DeviseController,
    LangueController,
    BlocRegionalController,
    TauxChangeController,
    VilleController,
    LocaleController,
    TraductionController,
  ],
  providers: [
    // Repositories (ports → adaptateurs TypeORM)
    { provide: PAYS_REPOSITORY, useClass: TypeOrmPaysRepository },
    { provide: DEVISE_REPOSITORY, useClass: TypeOrmDeviseRepository },
    { provide: LANGUE_REPOSITORY, useClass: TypeOrmLangueRepository },
    { provide: BLOC_REGIONAL_REPOSITORY, useClass: TypeOrmBlocRegionalRepository },
    { provide: PAYS_DEVISE_REPOSITORY, useClass: TypeOrmPaysDeviseRepository },
    { provide: PAYS_LANGUE_REPOSITORY, useClass: TypeOrmPaysLangueRepository },
    { provide: PAYS_BLOC_REGIONAL_REPOSITORY, useClass: TypeOrmPaysBlocRegionalRepository },
    { provide: TAUX_CHANGE_REPOSITORY, useClass: TypeOrmTauxChangeRepository },
    { provide: VILLE_REPOSITORY, useClass: TypeOrmVilleRepository },
    { provide: LOCALE_REPOSITORY, useClass: TypeOrmLocaleRepository },
    { provide: TRADUCTION_REPOSITORY, useClass: TypeOrmTraductionRepository },

    // Port transverse exposé aux autres briques du noyau (interdit l'application d'un prix
    // dans une devise non certifiée — consommé par GSG Product Catalog).
    { provide: CURRENCY_VALIDATION_PORT, useClass: CurrencyValidationAdapter },
    { provide: REFERENTIAL_DEFAULTS_LOOKUP_PORT, useClass: ReferentialDefaultsLookupAdapter },

    // Use-cases
    CreatePaysUseCase,
    UpdatePaysUseCase,
    TransitionPaysWorkflowUseCase,
    SetPaysActivationUseCase,
    ListPaysUseCase,
    GetPaysUseCase,

    CreateDeviseUseCase,
    TransitionDeviseWorkflowUseCase,
    AttachDeviseToPaysUseCase,
    ListDevisesUseCase,

    CreateLangueUseCase,
    TransitionLangueWorkflowUseCase,
    AttachLangueToPaysUseCase,
    ListLanguesUseCase,

    CreateBlocRegionalUseCase,
    TransitionBlocRegionalWorkflowUseCase,
    AddPaysToBlocRegionalUseCase,
    WithdrawPaysFromBlocRegionalUseCase,
    ListBlocsRegionauxUseCase,

    SetTauxChangeUseCase,
    ResolveExchangeRateUseCase,

    CreateVilleUseCase,
    ListVillesByPaysUseCase,
    SetVilleActivationUseCase,
    MoveVilleUseCase,

    CreateLocaleUseCase,
    UpdateLocaleUseCase,
    SetLocaleParDefautUseCase,
    SetLocaleActivationUseCase,
    ListLocalesUseCase,

    CreateTraductionUseCase,
    UpdateTraductionUseCase,
    ListTraductionsByLocaleUseCase,

    // Cross-cutting
    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PAYS_REPOSITORY, DEVISE_REPOSITORY, LANGUE_REPOSITORY, CURRENCY_VALIDATION_PORT, REFERENTIAL_DEFAULTS_LOOKUP_PORT],
})
export class ReferentialModule {}
