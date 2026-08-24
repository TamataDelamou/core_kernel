import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  MFA_FACTOR_REPOSITORY,
  MfaFactorRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/identity.repositories';
import { MFA_SERVICE, MfaService, TOKEN_SERVICE, TokenService } from '../../domain/services/token-and-mfa.interface';
import { MfaFactor } from '../../domain/entities/rbac-and-tokens.entity';
import {
  InvalidMfaCodeError,
  MfaAlreadyEnabledError,
  UserNotFoundError,
} from '../../domain/exceptions/identity.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { IDENTITY_EVENT_TYPES } from '../../domain/events/identity-event-catalog';
import {
  AuthenticateUserResult,
  AuthenticateUserUseCase,
} from './authenticate-user.use-case';

export interface StartMfaEnrollmentResult {
  factorId: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

@Injectable()
export class StartMfaEnrollmentUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MFA_FACTOR_REPOSITORY) private readonly mfaFactorRepository: MfaFactorRepository,
    @Inject(MFA_SERVICE) private readonly mfaService: MfaService,
  ) {}

  async execute(gsgId: string): Promise<StartMfaEnrollmentResult> {
    const user = await this.userRepository.findByGsgId(gsgId);
    if (!user) throw new UserNotFoundError();
    if (user.mfaActive) throw new MfaAlreadyEnabledError();

    // Le libellé du compte affiché dans l'app d'authentification (Google Authenticator, etc.)
    // utilise l'email si disponible, sinon le téléphone (compte WhatsApp-only), sinon le gsgId.
    const accountLabel = user.email?.toString() ?? user.phone?.toString() ?? user.gsgId;
    const generated = await this.mfaService.generateTotpSecret(accountLabel);
    const recoveryCodes = this.mfaService.generateRecoveryCodes(10);
    const recoveryCodesHashes = recoveryCodes.map((code) => this.mfaService.hashRecoveryCode(code));

    const factor = MfaFactor.createPending({
      id: uuidv4(),
      gsgId,
      secretChiffre: this.mfaService.encryptSecret(generated.secretBase32),
      codesRecuperationHashes: recoveryCodesHashes,
    });
    await this.mfaFactorRepository.save(factor);

    return {
      factorId: factor.id,
      otpauthUrl: generated.otpauthUrl,
      qrCodeDataUrl: generated.qrCodeDataUrl,
      recoveryCodes, // affichés une seule fois en clair à l'utilisateur — jamais journalisés
    };
  }
}

@Injectable()
export class ConfirmMfaEnrollmentUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MFA_FACTOR_REPOSITORY) private readonly mfaFactorRepository: MfaFactorRepository,
    @Inject(MFA_SERVICE) private readonly mfaService: MfaService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(gsgId: string, factorId: string, code: string): Promise<void> {
    const factor = await this.mfaFactorRepository.findById(factorId);
    if (!factor) throw new InvalidMfaCodeError();

    const secret = this.mfaService.decryptSecret(factor.secretChiffre);
    const isValid = this.mfaService.verifyTotpCode(secret, code);
    if (!isValid) throw new InvalidMfaCodeError();

    factor.activate();
    await this.mfaFactorRepository.save(factor);

    const user = await this.userRepository.findByGsgId(gsgId);
    if (!user) throw new UserNotFoundError();
    user.enableMfa();
    await this.userRepository.save(user);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.MFA_ENABLED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId },
    });
  }
}

@Injectable()
export class VerifyMfaChallengeUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MFA_FACTOR_REPOSITORY) private readonly mfaFactorRepository: MfaFactorRepository,
    @Inject(MFA_SERVICE) private readonly mfaService: MfaService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
  ) {}

  /** Valide le code TOTP (ou un code de récupération) présenté après un login MFA_REQUIRED. */
  async execute(params: {
    mfaChallengeToken: string;
    code: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<Extract<AuthenticateUserResult, { status: 'authenticated' }>> {
    const { gsgId } = await this.tokenService.verifyMfaChallengeToken(params.mfaChallengeToken);

    const factor = await this.mfaFactorRepository.findActiveByUser(gsgId);
    if (!factor) throw new InvalidMfaCodeError();

    const secret = this.mfaService.decryptSecret(factor.secretChiffre);
    let isValid = this.mfaService.verifyTotpCode(secret, params.code);

    if (!isValid) {
      const codeHash = this.mfaService.hashRecoveryCode(params.code);
      if (factor.codesRecuperationHashes.includes(codeHash)) {
        isValid = true;
        factor.consumeRecoveryCode(codeHash);
        await this.mfaFactorRepository.save(factor);
      }
    }

    if (!isValid) throw new InvalidMfaCodeError();

    return this.authenticateUserUseCase.completeAuthenticationByGsgId(
      gsgId,
      params.ipAddress,
      params.userAgent,
    );
  }
}
