import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Email } from '../../../common/value-objects/email.vo';
import { InvalidCredentialsError } from '../../domain/exceptions/identity.exceptions';
import { PASSWORD_HASHER, PasswordHasher } from '../../domain/services/password-hasher.interface';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
  ROLE_REPOSITORY,
  RoleRepository,
  USER_REPOSITORY,
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  UserRepository,
  UserRoleAssignmentRepository,
} from '../../domain/repositories/identity.repositories';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { IDENTITY_EVENT_TYPES } from '../../domain/events/identity-event-catalog';
import { TOKEN_SERVICE, TokenService } from '../../domain/services/token-and-mfa.interface';
import { RefreshToken } from '../../domain/entities/rbac-and-tokens.entity';
import { User } from '../../domain/entities/user.entity';

export interface AuthenticateUserCommand {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export type AuthenticateUserResult =
  | {
      status: 'authenticated';
      accessToken: string;
      accessTokenExpiresInSeconds: number;
      refreshToken: string;
    }
  | { status: 'mfa_required'; mfaChallengeToken: string };

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // valeur par défaut ; alignée sur JWT_REFRESH_TTL_SECONDS

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly userRoleAssignmentRepository: UserRoleAssignmentRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<AuthenticateUserResult> {
    const email = Email.create(command.email);
    const user = await this.userRepository.findByEmail(email);

    // OWASP: on exécute toujours une vérification Argon2, même sans utilisateur trouvé,
    // pour uniformiser le temps de réponse et empêcher l'énumération de comptes par timing.
    const passwordHashForComparison = user?.passwordHash ?? (await this.dummyHash());
    const passwordMatches = await this.passwordHasher.verify(
      command.password,
      passwordHashForComparison,
    );

    if (!user || !passwordMatches) {
      if (user) {
        user.assertCanAuthenticate(); // laisse remonter UserAccountLockedError / UserAccountInactiveError
        user.registerFailedAuthentication();
        await this.userRepository.save(user);
        await this.publishAuthFailed(user.gsgId, command.ipAddress);
      }
      throw new InvalidCredentialsError();
    }

    user.assertCanAuthenticate();

    if (user.mfaActive) {
      const mfaChallengeToken = await this.tokenService.issueMfaChallengeToken(user.gsgId);
      return { status: 'mfa_required', mfaChallengeToken };
    }

    return this.completeAuthentication(user, command.ipAddress, command.userAgent);
  }

  /** Point d'entrée utilisé par VerifyMfaUseCase une fois le second facteur validé. */
  async completeAuthenticationByGsgId(
    gsgId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<Extract<AuthenticateUserResult, { status: 'authenticated' }>> {
    const user = await this.userRepository.findByGsgId(gsgId);
    if (!user) throw new InvalidCredentialsError();
    return this.completeAuthentication(user, ipAddress, userAgent);
  }

  private async completeAuthentication(
    user: User,
    ipAddress: string,
    userAgent: string,
  ): Promise<Extract<AuthenticateUserResult, { status: 'authenticated' }>> {
    const { roles, gsgOrgIds } = await this.resolveRolesAndScopes(user.gsgId);

    const { token: accessToken, expiresInSeconds } = await this.tokenService.issueAccessToken({
      gsgId: user.gsgId,
      roles,
      gsgOrgIds,
      mfaVerified: true,
    });

    const refreshTokenPlain = this.tokenService.generateRefreshTokenPlain();
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshTokenPlain);

    const refreshToken = RefreshToken.issue({
      id: uuidv4(),
      gsgId: user.gsgId,
      tokenHash: refreshTokenHash,
      familyId: uuidv4(),
      emisLe: new Date(),
      expireLe: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipEmission: ipAddress,
      userAgent,
    });
    await this.refreshTokenRepository.save(refreshToken);

    user.registerSuccessfulAuthentication();
    await this.userRepository.save(user);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.USER_AUTHENTICATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: user.gsgId, ip: ipAddress },
    });

    return {
      status: 'authenticated',
      accessToken,
      accessTokenExpiresInSeconds: expiresInSeconds,
      refreshToken: refreshTokenPlain,
    };
  }

  /**
   * Résout à la fois les codes de rôle ET les organisations pour lesquelles l'utilisateur
   * détient au moins un rôle scopé (KER-ORG-03) — nécessaire pour que des consommateurs comme
   * GET /v1/audit/trail puissent fermer le contrôle de portée d'un `org.owner` sans avoir à
   * interroger GSG ID à chaque requête : l'information voyage directement dans le jeton.
   */
  private async resolveRolesAndScopes(gsgId: string): Promise<{ roles: string[]; gsgOrgIds: string[] }> {
    const assignments = await this.userRoleAssignmentRepository.findByUser(gsgId);
    const roleEntities = await Promise.all(
      assignments.map((assignment) => this.roleRepository.findById(assignment.toSnapshot().roleId)),
    );

    const roles = roleEntities
      .filter((role): role is NonNullable<typeof role> => role !== null)
      .map((role) => role.code);

    const gsgOrgIds = [
      ...new Set(
        assignments
          .map((assignment) => assignment.toSnapshot().gsgOrgId)
          .filter((gsgOrgId): gsgOrgId is string => gsgOrgId !== null),
      ),
    ];

    return { roles, gsgOrgIds };
  }

  private async publishAuthFailed(gsgId: string, ipAddress: string): Promise<void> {
    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.USER_AUTHENTICATION_FAILED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId, ip: ipAddress },
    });
  }

  private async dummyHash(): Promise<string> {
    return this.passwordHasher.hash('dummy-constant-time-comparison-value');
  }
}
