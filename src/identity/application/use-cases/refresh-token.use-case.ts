import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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
import { TOKEN_SERVICE, TokenService } from '../../domain/services/token-and-mfa.interface';
import {
  RefreshToken,
  RefreshTokenAlreadyUsedError,
} from '../../domain/entities/rbac-and-tokens.entity';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { InvalidCredentialsError } from '../../domain/exceptions/identity.exceptions';

export interface RefreshTokenCommand {
  refreshTokenPlain: string;
  refreshTokenId: string;
  ipAddress: string;
  userAgent: string;
}

export interface RefreshTokenResult {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
}

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly userRoleAssignmentRepository: UserRoleAssignmentRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const existingToken = await this.refreshTokenRepository.findById(command.refreshTokenId);
    if (!existingToken) {
      throw new InvalidCredentialsError();
    }

    const providedHash = this.tokenService.hashRefreshToken(command.refreshTokenPlain);
    if (providedHash !== existingToken.toSnapshot().tokenHash) {
      throw new InvalidCredentialsError();
    }

    try {
      existingToken.assertValidAndConsume();
    } catch (error) {
      if (error instanceof RefreshTokenAlreadyUsedError) {
        // OWASP ASVS 3.3.1 — un jeton déjà consommé et présenté à nouveau signale un vol
        // probable : toute la famille de rotation est révoquée immédiatement.
        await this.refreshTokenRepository.revokeFamily(existingToken.familyId);
      }
      throw error;
    }
    await this.refreshTokenRepository.save(existingToken);

    const user = await this.userRepository.findByGsgId(existingToken.gsgId);
    if (!user) throw new InvalidCredentialsError();
    user.assertCanAuthenticate();

    const assignments = await this.userRoleAssignmentRepository.findByUser(user.gsgId);
    const roleEntities = await Promise.all(
      assignments.map((a) => this.roleRepository.findById(a.toSnapshot().roleId)),
    );
    const roles = roleEntities
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.code);
    const gsgOrgIds = [
      ...new Set(
        assignments
          .map((a) => a.toSnapshot().gsgOrgId)
          .filter((gsgOrgId): gsgOrgId is string => gsgOrgId !== null),
      ),
    ];

    const { token: accessToken, expiresInSeconds } = await this.tokenService.issueAccessToken({
      gsgId: user.gsgId,
      roles,
      gsgOrgIds,
      mfaVerified: user.mfaActive,
    });

    const newRefreshTokenPlain = this.tokenService.generateRefreshTokenPlain();
    const newRefreshToken = RefreshToken.issue({
      id: uuidv4(),
      gsgId: user.gsgId,
      tokenHash: this.tokenService.hashRefreshToken(newRefreshTokenPlain),
      familyId: existingToken.familyId, // même lignée — permet la révocation en cascade en cas de rejeu futur
      emisLe: new Date(),
      expireLe: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipEmission: command.ipAddress,
      userAgent: command.userAgent,
    });
    await this.refreshTokenRepository.save(newRefreshToken);

    return {
      accessToken,
      accessTokenExpiresInSeconds: expiresInSeconds,
      refreshToken: newRefreshTokenPlain,
    };
  }
}
