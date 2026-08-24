import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Email } from '../../../common/value-objects/email.vo';
import { PhoneE164 } from '../../../common/value-objects/phone-e164.vo';
import { User } from '../../domain/entities/user.entity';
import { ExternalIdentityMapping } from '../../domain/entities/rbac-and-tokens.entity';
import {
  EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
  ExternalIdentityMappingRepository,
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repositories/identity.repositories';
import {
  SUPABASE_SESSION_VERIFIER,
  SupabaseSessionVerifier,
} from '../../domain/services/supabase-session.interface';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { IDENTITY_EVENT_TYPES } from '../../domain/events/identity-event-catalog';
import { AuthenticateUserResult, AuthenticateUserUseCase } from './authenticate-user.use-case';

export interface ExchangeSupabaseSessionCommand {
  supabaseProjectUrl: string;
  supabaseAccessToken: string;
  /** Référence vers le Registre central des produits (section 5 du Cahier) — quel produit échange. */
  produitId: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * KER-ID-02 : "l'intégration à un produit déjà en production se fait par ajout d'une simple
 * table de correspondance (external_user_id ↔ gsg_id), sans suppression ni modification du
 * système d'authentification déjà en place." Ce use-case EST cette intégration, appliquée au
 * modèle d'authentification de référence Supabase : le "système déjà en place" est Supabase
 * Auth natif de chaque produit (signInWithOtp/verifyOtp), et external_user_id = l'UUID
 * `auth.users.id` du projet Supabase concerné.
 *
 * Ordre de résolution d'identité, du plus fort couplage au plus faible :
 *   1. Un mapping existe déjà pour (produitId, supabaseUserId) → SSO immédiat.
 *   2. Aucun mapping, mais un profil GSG ID existant partage l'email ou le téléphone déjà
 *      vérifié par Supabase → rattachement automatique (dédup inter-produits, KER-ID-01).
 *   3. Aucune correspondance → nouveau profil GSG ID provisionné.
 * Dans tous les cas, un mapping est créé/confirmé pour accélérer les connexions suivantes.
 */
@Injectable()
export class SupabaseSessionExchangeUseCase {
  constructor(
    @Inject(SUPABASE_SESSION_VERIFIER) private readonly supabaseSessionVerifier: SupabaseSessionVerifier,
    @Inject(EXTERNAL_IDENTITY_MAPPING_REPOSITORY)
    private readonly externalIdentityMappingRepository: ExternalIdentityMappingRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
  ) {}

  async execute(command: ExchangeSupabaseSessionCommand): Promise<AuthenticateUserResult> {
    const identity = await this.supabaseSessionVerifier.verify(
      command.supabaseProjectUrl,
      command.supabaseAccessToken,
    );

    const mappingExistant = await this.externalIdentityMappingRepository.findByProduitAndExternalId(
      command.produitId,
      identity.supabaseUserId,
    );
    if (mappingExistant) {
      const gsgId = mappingExistant.toSnapshot().gsgId;
      return this.authenticateUserUseCase.completeAuthenticationByGsgId(
        gsgId,
        command.ipAddress,
        command.userAgent,
      );
    }

    const user = await this.resolveOrCreateUser(identity);

    const mapping = ExternalIdentityMapping.create({
      id: uuidv4(),
      gsgId: user.gsgId,
      produitId: command.produitId,
      externalUserId: identity.supabaseUserId,
    });
    await this.externalIdentityMappingRepository.save(mapping);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.SUPABASE_SESSION_EXCHANGED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: user.gsgId, produitId: command.produitId },
    });

    return this.authenticateUserUseCase.completeAuthenticationByGsgId(
      user.gsgId,
      command.ipAddress,
      command.userAgent,
    );
  }

  /**
   * Dédup par identifiant présent sur le jeton Supabase — voir la docstring de
   * `VerifiedSupabaseIdentity` sur pourquoi la seule présence d'une valeur non vide vaut
   * confirmation, en l'absence de claim `*_verified` distincte dans le format Supabase.
   */
  private async resolveOrCreateUser(identity: {
    email: string;
    phone: string;
  }): Promise<User> {
    const email = identity.email ? Email.create(identity.email) : null;
    const phone = identity.phone ? PhoneE164.create(identity.phone) : null;

    if (email) {
      const existant = await this.userRepository.findByEmail(email);
      if (existant) return existant;
    }
    if (phone) {
      const existant = await this.userRepository.findByPhone(phone);
      if (existant) return existant;
    }

    const nouveau = User.registerViaVerifiedExternalIdentity({
      gsgId: uuidv4(),
      email,
      phone,
      nomAffichage: email?.toString() ?? phone?.toString() ?? 'Utilisateur GSG',
      referentiel: {
        paysId: null,
        uniteAdministrativeId: null,
        villeId: null,
        langueId: null,
        deviseId: null,
        fuseauHoraire: null,
      },
    });
    await this.userRepository.save(nouveau);
    return nouveau;
  }
}
