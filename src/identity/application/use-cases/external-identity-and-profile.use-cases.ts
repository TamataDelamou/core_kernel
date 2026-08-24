import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  EXTERNAL_IDENTITY_MAPPING_REPOSITORY,
  ExternalIdentityMappingRepository,
  ROLE_REPOSITORY,
  RoleRepository,
  USER_REPOSITORY,
  USER_ROLE_ASSIGNMENT_REPOSITORY,
  UserRepository,
  UserRoleAssignmentRepository,
} from '../../domain/repositories/identity.repositories';
import {
  ExternalIdentityAlreadyLinkedError,
  RoleNotFoundError,
  UserNotFoundError,
  InvalidOrganizationScopeError,
} from '../../domain/exceptions/identity.exceptions';
import {
  ExternalIdentityMapping,
  UserRoleAssignment,
} from '../../domain/entities/rbac-and-tokens.entity';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import {
  ORGANISATION_LOOKUP_PORT,
  OrganisationLookupPort,
} from '../../../common/kernel-ports/organisation-lookup.port';
import { IDENTITY_EVENT_TYPES } from '../../domain/events/identity-event-catalog';
import { ReferentielUtilisateur } from '../../domain/entities/user.entity';

/**
 * KER-ID-02 : intégration à un produit déjà en production par simple ajout d'une table
 * de correspondance (external_user_id ↔ gsg_id), sans toucher au système d'auth existant.
 */
@Injectable()
export class LinkExternalIdentityUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(EXTERNAL_IDENTITY_MAPPING_REPOSITORY)
    private readonly externalIdentityMappingRepository: ExternalIdentityMappingRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(params: { gsgId: string; produitId: string; externalUserId: string }): Promise<void> {
    const user = await this.userRepository.findByGsgId(params.gsgId);
    if (!user) throw new UserNotFoundError();

    const existing = await this.externalIdentityMappingRepository.findByProduitAndExternalId(
      params.produitId,
      params.externalUserId,
    );
    if (existing && existing.toSnapshot().gsgId !== params.gsgId) {
      throw new ExternalIdentityAlreadyLinkedError();
    }

    const mapping = ExternalIdentityMapping.create({
      id: uuidv4(),
      gsgId: params.gsgId,
      produitId: params.produitId,
      externalUserId: params.externalUserId,
    });
    await this.externalIdentityMappingRepository.save(mapping);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.EXTERNAL_IDENTITY_LINKED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: params.gsgId, produitId: params.produitId },
    });
  }
}

/** Mise à jour des références vers le GSG Referential portées par le profil (KER-ID-05). */
@Injectable()
export class UpdateUserReferentielUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(gsgId: string, referentiel: Partial<ReferentielUtilisateur>): Promise<void> {
    const user = await this.userRepository.findByGsgId(gsgId);
    if (!user) throw new UserNotFoundError();

    user.updateReferentiel(referentiel);
    await this.userRepository.save(user);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.REFERENTIEL_UPDATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId, referentiel },
    });
  }
}

/** Attribution d'un rôle à un utilisateur, éventuellement scopée à une organisation (KER-ORG-03). */
@Injectable()
export class AssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(USER_ROLE_ASSIGNMENT_REPOSITORY)
    private readonly userRoleAssignmentRepository: UserRoleAssignmentRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(ORGANISATION_LOOKUP_PORT) private readonly organisationLookupPort: OrganisationLookupPort,
  ) {}

  async execute(params: {
    gsgId: string;
    roleId: string;
    gsgOrgId: string | null;
    assignePar: string;
  }): Promise<void> {
    const user = await this.userRepository.findByGsgId(params.gsgId);
    if (!user) throw new UserNotFoundError();

    const role = await this.roleRepository.findById(params.roleId);
    if (!role) throw new RoleNotFoundError();

    // KER-ORG-03 : ferme le contrôle de portée — un rôle scopé à une organisation ne peut
    // être attribué que si cette organisation existe réellement dans Org Registry et est
    // active. Un rôle global du noyau (gsgOrgId === null) n'est pas concerné par ce contrôle.
    if (params.gsgOrgId !== null) {
      const organisationValide = await this.organisationLookupPort.existsAndActive(params.gsgOrgId);
      if (!organisationValide) {
        throw new InvalidOrganizationScopeError(params.gsgOrgId);
      }
    }

    const assignment = UserRoleAssignment.create({
      id: uuidv4(),
      gsgId: params.gsgId,
      roleId: params.roleId,
      gsgOrgId: params.gsgOrgId,
      assignePar: params.assignePar,
    });
    await this.userRoleAssignmentRepository.save(assignment);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.ROLE_ASSIGNED,
      gsgOrgId: params.gsgOrgId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: params.gsgId, roleId: params.roleId, assignePar: params.assignePar },
    });
  }
}
