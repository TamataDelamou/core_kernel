import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvenementOrmEntity, EvenementEnEchecOrmEntity } from './infrastructure/persistence/typeorm/orm-entities';
import {
  TypeOrmAuditEvenementRepository,
  TypeOrmDeadLetterRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';
import { AUDIT_EVENEMENT_REPOSITORY, DEAD_LETTER_REPOSITORY } from './domain/repositories/audit.repositories';

import { ProcessStreamEventUseCase } from './application/use-cases/process-stream-event.use-case';
import { QueryAuditTrailUseCase } from './application/use-cases/query-audit-trail.use-case';
import { MoveToDeadLetterUseCase, ReplayDeadLetterUseCase } from './application/use-cases/dead-letter.use-cases';

import { RedisStreamsConsumerService } from './infrastructure/messaging/redis-streams-consumer.service';

import { AuditController } from './interface/http/controllers/audit.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// Isolation stricte (même discipline que ProductModule) : AuditModule n'importe JAMAIS de
// classe de domaine ou d'application appartenant à `org`. OrgModule est importé UNIQUEMENT
// pour que le conteneur de dépendances résolve ORGANISATION_LOOKUP_PORT (common/kernel-ports),
// consommé par QueryAuditTrailUseCase pour fermer le contrôle de portée multi-tenant
// (Priorité 2) — jamais pour accéder au domaine ou à l'application d'Org Registry.
import { OrgModule } from '../org/org.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvenementOrmEntity, EvenementEnEchecOrmEntity]), OrgModule],
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_EVENEMENT_REPOSITORY, useClass: TypeOrmAuditEvenementRepository },
    { provide: DEAD_LETTER_REPOSITORY, useClass: TypeOrmDeadLetterRepository },

    ProcessStreamEventUseCase,
    QueryAuditTrailUseCase,
    MoveToDeadLetterUseCase,
    ReplayDeadLetterUseCase,

    // Démarre automatiquement (OnModuleInit) la consommation du bus dès le chargement du module.
    RedisStreamsConsumerService,

    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuditModule {}
