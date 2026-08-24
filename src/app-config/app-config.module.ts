import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigurationGlobaleOrmEntity } from './infrastructure/persistence/typeorm/orm-entities';
import { TypeOrmConfigurationGlobaleRepository } from './infrastructure/persistence/typeorm/orm-repositories';
import { CONFIGURATION_GLOBALE_REPOSITORY } from './domain/repositories/configuration-globale.repository';

import { ResolveAppConfigUseCase } from './application/use-cases/resolve-app-config.use-case';
import {
  GetConfigurationGlobaleUseCase,
  UpdateConfigurationGlobaleUseCase,
} from './application/use-cases/configuration-globale.use-cases';

import { AppConfigController } from './interface/http/controllers/app-config.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// AppConfigModule est un consommateur pur (comme Audit ou Product Registry) : il importe les
// MODULES identity/org/referential uniquement pour la résolution DI de leurs ports de
// lecture respectifs (USER_REFERENTIAL_LOOKUP_PORT, ORGANISATION_REFERENTIAL_LOOKUP_PORT,
// REFERENTIAL_DEFAULTS_LOOKUP_PORT, ORGANISATION_LOOKUP_PORT) — jamais leur domaine. Aucun
// des trois n'importe AppConfigModule en retour : dépendance à sens unique, sans cycle.
import { IdentityModule } from '../identity/identity.module';
import { OrgModule } from '../org/org.module';
import { ReferentialModule } from '../referential/referential.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigurationGlobaleOrmEntity]),
    IdentityModule,
    OrgModule,
    ReferentialModule,
  ],
  controllers: [AppConfigController],
  providers: [
    { provide: CONFIGURATION_GLOBALE_REPOSITORY, useClass: TypeOrmConfigurationGlobaleRepository },

    ResolveAppConfigUseCase,
    GetConfigurationGlobaleUseCase,
    UpdateConfigurationGlobaleUseCase,

    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AppConfigModule {}
