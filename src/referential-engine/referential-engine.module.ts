import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CorpusElementOrmEntity,
  CorpusVersionneOrmEntity,
  NiveauAdministratifOrmEntity,
  NoeudHierarchiqueOrmEntity,
  ReferentielRegleOrmEntity,
  CompteurVillesRattacheesOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';
import {
  TypeOrmCorpusElementRepository,
  TypeOrmCorpusVersionneRepository,
  TypeOrmNiveauAdministratifRepository,
  TypeOrmNoeudHierarchiqueRepository,
  TypeOrmReferentielRegleRepository,
  TypeOrmCompteurVillesRattacheesRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';
import {
  CORPUS_ELEMENT_REPOSITORY,
  CORPUS_VERSIONNE_REPOSITORY,
  NIVEAU_ADMINISTRATIF_REPOSITORY,
  NOEUD_HIERARCHIQUE_REPOSITORY,
  REFERENTIEL_REGLE_REPOSITORY,
  COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
} from './domain/repositories/referential-engine.repositories';

import { REFERENTIAL_ENGINE_LOOKUP_PORT } from '../common/kernel-ports/referential-engine-lookup.port';
import { ReferentialEngineLookupAdapter } from './infrastructure/adapters/referential-engine-lookup.adapter';
import { REGLE_LOOKUP_PORT } from '../common/kernel-ports/regle-lookup.port';
import { RegleLookupAdapter } from './infrastructure/adapters/regle-lookup.adapter';
import { CORPUS_LOOKUP_PORT } from '../common/kernel-ports/corpus-lookup.port';
import { CorpusLookupAdapter } from './infrastructure/adapters/corpus-lookup.adapter';

import {
  CreateNiveauAdministratifUseCase,
  ListNiveauxAdministratifsUseCase,
} from './application/use-cases/niveau-administratif.use-cases';
import {
  CreateNoeudUseCase,
  QueryNoeudsUseCase,
  ReattachNoeudUseCase,
  SetNoeudActivationUseCase,
  TransitionNoeudWorkflowUseCase,
  UpdateNoeudUseCase,
} from './application/use-cases/noeud-hierarchique.use-cases';
import {
  CreateReferentielRegleUseCase,
  QueryReglesUseCase,
  SetRegleActivationUseCase,
  TransitionRegleWorkflowUseCase,
  UpdateReferentielRegleUseCase,
} from './application/use-cases/referentiel-regle.use-cases';
import {
  ArchiveCorpusUseCase,
  CreateCorpusVersionneUseCase,
  PublishCorpusUseCase,
  QueryCorpusUseCase,
  UpdateCorpusVersionneUseCase,
} from './application/use-cases/corpus-versionne.use-cases';
import {
  AttachCorpusElementUseCase,
  QueryCorpusElementsUseCase,
  ReattachCorpusElementUseCase,
  UpdateCorpusElementUseCase,
} from './application/use-cases/corpus-element.use-cases';

import { VilleRattacheeConsumerService } from './infrastructure/messaging/ville-rattachee-consumer.service';

import { NiveauAdministratifController } from './interface/http/controllers/niveau-administratif.controller';
import { NoeudHierarchiqueController } from './interface/http/controllers/noeud-hierarchique.controller';
import { ReferentielRegleController } from './interface/http/controllers/referentiel-regle.controller';
import { CorpusVersionneController } from './interface/http/controllers/corpus-versionne.controller';
import { CorpusElementController } from './interface/http/controllers/corpus-element.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Isolation stricte (directive d'implémentation) : ReferentialEngineModule n'importe AUCUN
// module métier (`referential`, `org`, `product`, `identity`, `audit`) — c'est l'inverse de
// ProductModule/AuditModule, qui importaient OrgModule/ReferentialModule pour consommer un
// port. Ici, c'est `referential` qui importera CE module (ReferentialEngineModule) pour
// consommer REFERENTIAL_ENGINE_LOOKUP_PORT — la dépendance ne va que dans un sens, condition
// explicite pour éviter tout cycle entre les deux modules (voir README).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NiveauAdministratifOrmEntity,
      NoeudHierarchiqueOrmEntity,
      ReferentielRegleOrmEntity,
      CorpusVersionneOrmEntity,
      CorpusElementOrmEntity,
      CompteurVillesRattacheesOrmEntity,
    ]),
  ],
  controllers: [
    NiveauAdministratifController,
    NoeudHierarchiqueController,
    ReferentielRegleController,
    CorpusVersionneController,
    CorpusElementController,
  ],
  providers: [
    { provide: NIVEAU_ADMINISTRATIF_REPOSITORY, useClass: TypeOrmNiveauAdministratifRepository },
    { provide: NOEUD_HIERARCHIQUE_REPOSITORY, useClass: TypeOrmNoeudHierarchiqueRepository },
    { provide: REFERENTIEL_REGLE_REPOSITORY, useClass: TypeOrmReferentielRegleRepository },
    { provide: CORPUS_VERSIONNE_REPOSITORY, useClass: TypeOrmCorpusVersionneRepository },
    { provide: CORPUS_ELEMENT_REPOSITORY, useClass: TypeOrmCorpusElementRepository },
    { provide: COMPTEUR_VILLES_RATTACHEES_REPOSITORY, useClass: TypeOrmCompteurVillesRattacheesRepository },

    // Ports exposés aux futurs produits consommateurs (KER-ENG-08) — voir la note d'isolation.
    { provide: REFERENTIAL_ENGINE_LOOKUP_PORT, useClass: ReferentialEngineLookupAdapter },
    { provide: REGLE_LOOKUP_PORT, useClass: RegleLookupAdapter },
    { provide: CORPUS_LOOKUP_PORT, useClass: CorpusLookupAdapter },

    CreateNiveauAdministratifUseCase,
    ListNiveauxAdministratifsUseCase,

    CreateNoeudUseCase,
    UpdateNoeudUseCase,
    TransitionNoeudWorkflowUseCase,
    ReattachNoeudUseCase,
    SetNoeudActivationUseCase,
    QueryNoeudsUseCase,

    CreateReferentielRegleUseCase,
    UpdateReferentielRegleUseCase,
    TransitionRegleWorkflowUseCase,
    SetRegleActivationUseCase,
    QueryReglesUseCase,

    CreateCorpusVersionneUseCase,
    UpdateCorpusVersionneUseCase,
    PublishCorpusUseCase,
    ArchiveCorpusUseCase,
    QueryCorpusUseCase,

    AttachCorpusElementUseCase,
    UpdateCorpusElementUseCase,
    ReattachCorpusElementUseCase,
    QueryCorpusElementsUseCase,

    // Démarre automatiquement (OnModuleInit) la consommation du bus dès le chargement du module.
    VilleRattacheeConsumerService,

    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [REFERENTIAL_ENGINE_LOOKUP_PORT],
})
export class ReferentialEngineModule {}
