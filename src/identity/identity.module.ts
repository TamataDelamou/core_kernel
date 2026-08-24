import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import {
  ExternalIdentityMappingOrmEntity,
  MfaFactorOrmEntity,
  RefreshTokenOrmEntity,
  RoleOrmEntity,
  UserOrmEntity,
  UserRoleAssignmentOrmEntity,
} from './infrastructure/persistence/typeorm/orm-entities';

import {
  TypeOrmExternalIdentityMappingRepository,
  TypeOrmMfaFactorRepository,
  TypeOrmRefreshTokenRepository,
  TypeOrmRoleRepository,
  TypeOrmUserRepository,
  TypeOrmUserRoleAssignmentRepository,
} from './infrastructure/persistence/typeorm/orm-repositories';

import {
  EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
  MFA_FACTOR_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
  USER_ROLE_ASSIGNMENT_REPOSITORY,
} from './domain/repositories/identity.repositories';

import { PASSWORD_HASHER } from './domain/services/password-hasher.interface';
import { Argon2PasswordHasherService } from './infrastructure/security/argon2-password-hasher.service';

import { TOKEN_SERVICE, MFA_SERVICE } from './domain/services/token-and-mfa.interface';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { TotpMfaService } from './infrastructure/security/totp-mfa.service';
import { SUPABASE_SESSION_VERIFIER } from './domain/services/supabase-session.interface';
import { JoseSupabaseSessionVerifier } from './infrastructure/security/supabase-session-verifier.adapter';

import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import {
  ConfirmMfaEnrollmentUseCase,
  StartMfaEnrollmentUseCase,
  VerifyMfaChallengeUseCase,
} from './application/use-cases/mfa.use-cases';
import {
  AssignRoleUseCase,
  LinkExternalIdentityUseCase,
  UpdateUserReferentielUseCase,
} from './application/use-cases/external-identity-and-profile.use-cases';
import { SupabaseSessionExchangeUseCase } from './application/use-cases/supabase-session-exchange.use-case';
import { USER_REFERENTIAL_LOOKUP_PORT } from '../common/kernel-ports/user-referential-lookup.port';
import { UserReferentialLookupAdapter } from './infrastructure/adapters/user-referential-lookup.adapter';

import { AuthController } from './interface/http/controllers/auth.controller';
import { MfaController } from './interface/http/controllers/mfa.controller';
import { UsersController } from './interface/http/controllers/users.controller';
import { ExternalIdentityController } from './interface/http/controllers/external-identity.controller';

import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgModule } from '../org/org.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      RoleOrmEntity,
      UserRoleAssignmentOrmEntity,
      RefreshTokenOrmEntity,
      MfaFactorOrmEntity,
      ExternalIdentityMappingOrmEntity,
    ]),
    // Le module JwtService est utilisé uniquement pour signer/vérifier ; les secrets et TTL
    // réels sont résolus dynamiquement par JwtTokenService/JwtAuthGuard via ConfigService,
    // afin de permettre des clés d'access token et de challenge MFA distinctes du refresh token.
    JwtModule.register({}),
    // Fournit ORGANISATION_LOOKUP_PORT — ferme le contrôle de portée KER-ORG-03 pour
    // AssignRoleUseCase (attribution de rôle scopé à une organisation).
    OrgModule,
  ],
  controllers: [AuthController, MfaController, UsersController, ExternalIdentityController],
  providers: [
    // Repositories (ports → adaptateurs TypeORM)
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: ROLE_REPOSITORY, useClass: TypeOrmRoleRepository },
    { provide: USER_ROLE_ASSIGNMENT_REPOSITORY, useClass: TypeOrmUserRoleAssignmentRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: TypeOrmRefreshTokenRepository },
    { provide: MFA_FACTOR_REPOSITORY, useClass: TypeOrmMfaFactorRepository },
    {
      provide: EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
      useClass: TypeOrmExternalIdentityMappingRepository,
    },

    // Services techniques (ports → adaptateurs infrastructure)
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasherService },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: MFA_SERVICE, useClass: TotpMfaService },
    { provide: SUPABASE_SESSION_VERIFIER, useClass: JoseSupabaseSessionVerifier },
    { provide: USER_REFERENTIAL_LOOKUP_PORT, useClass: UserReferentialLookupAdapter },

    // Use-cases (application)
    RegisterUserUseCase,
    AuthenticateUserUseCase,
    RefreshTokenUseCase,
    StartMfaEnrollmentUseCase,
    ConfirmMfaEnrollmentUseCase,
    VerifyMfaChallengeUseCase,
    LinkExternalIdentityUseCase,
    UpdateUserReferentielUseCase,
    AssignRoleUseCase,
    SupabaseSessionExchangeUseCase,

    // Cross-cutting (guards/interceptors utilisés via décorateurs dans les contrôleurs)
    AuditInterceptor,
    JwtAuthGuard,
    RolesGuard,
  ],
  // EVENT_PUBLISHER n'est plus fourni ici : il vient de KernelInfrastructureModule (@Global,
  // importé une seule fois dans AppModule) et reste injectable partout sans réexport explicite.
  exports: [USER_REPOSITORY, USER_REFERENTIAL_LOOKUP_PORT],
})
export class IdentityModule {}
