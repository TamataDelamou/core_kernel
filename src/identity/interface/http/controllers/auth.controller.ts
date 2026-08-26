import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  ExchangeSupabaseSessionDto,
  LoginDto,
  RefreshTokenDto,
  RegisterUserDto,
  RegisterUserResponseDto,
  VerifyMfaChallengeDto,
} from '../dto/identity.dto';
import { RegisterUserUseCase } from '../../../application/use-cases/register-user.use-case';
import { AuthenticateUserUseCase } from '../../../application/use-cases/authenticate-user.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/refresh-token.use-case';
import { VerifyMfaChallengeUseCase } from '../../../application/use-cases/mfa.use-cases';
import { SupabaseSessionExchangeUseCase } from '../../../application/use-cases/supabase-session-exchange.use-case';
import { AuditAction } from '../../../../common/interceptors/audit.interceptor';
import { AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidMfaCodeError,
  InvalidSupabaseSessionError,
  MfaAlreadyEnabledError,
  UntrustedSupabaseProjectError,
  UserNotFoundError,
} from '../../../domain/exceptions/identity.exceptions';

function clientIp(request: Request): string {
  return (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip ?? 'inconnu';
}

@Controller({ path: 'auth', version: '1' })
@UseInterceptors(AuditInterceptor)
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly verifyMfaChallengeUseCase: VerifyMfaChallengeUseCase,
    private readonly supabaseSessionExchangeUseCase: SupabaseSessionExchangeUseCase,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // OWASP: limite stricte contre l'abus d'inscription
  @AuditAction('user.registered')
  async register(@Body() dto: RegisterUserDto): Promise<RegisterUserResponseDto> {
    try {
      const result = await this.registerUserUseCase.execute(dto);
      return { gsgId: result.gsgId };
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // OWASP ASVS 2.2.1 — limitation du taux de tentatives
  @AuditAction('user.login_attempt')
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    try {
      return await this.authenticateUserUseCase.execute({
        email: dto.email,
        password: dto.password,
        ipAddress: clientIp(request),
        userAgent: request.headers['user-agent'] ?? 'inconnu',
      });
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  @Post('mfa/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @AuditAction('user.mfa_challenge_verified')
  async verifyMfaChallenge(@Body() dto: VerifyMfaChallengeDto, @Req() request: Request) {
    try {
      return await this.verifyMfaChallengeUseCase.execute({
        mfaChallengeToken: dto.mfaChallengeToken,
        code: dto.code,
        ipAddress: clientIp(request),
        userAgent: request.headers['user-agent'] ?? 'inconnu',
      });
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    try {
      return await this.refreshTokenUseCase.execute({
        refreshTokenId: dto.refreshTokenId,
        refreshTokenPlain: dto.refreshTokenPlain,
        ipAddress: clientIp(request),
        userAgent: request.headers['user-agent'] ?? 'inconnu',
      });
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  /**
   * KER-ID-02 : pont d'identité avec le modèle d'authentification de référence — chaque
   * produit GSG authentifie nativement via Supabase Auth (signInWithOtp/verifyOtp), puis
   * échange sa session Supabase contre une session GSG ID via cet endpoint. GSG ID ne génère
   * ni ne vérifie aucun code OTP lui-même.
   */
  @Post('sso/supabase')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @AuditAction('user.supabase_session_exchanged')
  async exchangeSupabaseSession(@Body() dto: ExchangeSupabaseSessionDto, @Req() request: Request) {
    try {
      return await this.supabaseSessionExchangeUseCase.execute({
        supabaseProjectUrl: dto.supabaseProjectUrl,
        supabaseAccessToken: dto.supabaseAccessToken,
        produitId: dto.produitId,
        ipAddress: clientIp(request),
        userAgent: request.headers['user-agent'] ?? 'inconnu',
      });
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  /**
   * Mapping centralisé — avant ce correctif, AUCUNE exception métier n'était mappée sur ce
   * contrôleur : `EmailAlreadyRegisteredError`, `InvalidCredentialsError` et toutes les
   * autres remontaient en 500 générique, découvert uniquement au premier vrai passage de
   * test:e2e (jamais visible dans les tests mockés, qui n'appellent jamais le contrôleur
   * HTTP réel — ils appellent directement les use-cases).
   */
  private mapDomainError(error: unknown): unknown {
    if (error instanceof EmailAlreadyRegisteredError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof InvalidCredentialsError) {
      return new UnauthorizedException(error.message);
    }
    if (error instanceof UserNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof MfaAlreadyEnabledError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof InvalidMfaCodeError) {
      return new UnauthorizedException(error.message);
    }
    if (error instanceof InvalidSupabaseSessionError) {
      return new UnauthorizedException(error.message);
    }
    if (error instanceof UntrustedSupabaseProjectError) {
      return new ForbiddenException(error.message);
    }
    return error;
  }
}
