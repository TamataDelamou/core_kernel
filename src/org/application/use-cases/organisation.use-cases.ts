import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Organisation, ReferentielOrganisation } from '../../domain/entities/organisation.entity';
import {
  ORGANISATION_REPOSITORY,
  OrganisationRepository,
} from '../../domain/repositories/org.repositories';
import {
  CircularParentingError,
  OrganisationNotFoundError,
} from '../../domain/exceptions/org.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { ORG_EVENT_TYPES } from '../../domain/events/org-event-catalog';

export interface CreateOrganisationCommand {
  nom: string;
  organisationMereId?: string | null;
  referentiel: ReferentielOrganisation;
}

@Injectable()
export class CreateOrganisationUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * KER-ORG-01 : attribue un gsg_org_id global. KER-ORG-02 : c'est là toute l'intégration
   * nécessaire côté produit existant — celui-ci stocke cet identifiant dans son propre champ
   * de référence, sans qu'Org Registry n'ait besoin de modéliser de table de correspondance.
   */
  async execute(command: CreateOrganisationCommand): Promise<{ id: string }> {
    if (command.organisationMereId) {
      const mere = await this.organisationRepository.findById(command.organisationMereId);
      if (!mere) throw new OrganisationNotFoundError();
    }

    const organisation = Organisation.create({ id: uuidv4(), ...command });
    await this.organisationRepository.save(organisation);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ORGANISATION_CREATED,
      gsgOrgId: organisation.id,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id: organisation.id, organisationMereId: organisation.organisationMereId },
    });

    return { id: organisation.id };
  }
}

@Injectable()
export class UpdateOrganisationUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
  ) {}

  async execute(id: string, updates: Partial<{ nom: string }>): Promise<void> {
    const organisation = await this.organisationRepository.findById(id);
    if (!organisation) throw new OrganisationNotFoundError();
    organisation.updateDetails(updates);
    await this.organisationRepository.save(organisation);
  }
}

/**
 * KER-ORG-04 : met à jour le référentiel propre à une organisation (ou une filiale),
 * indépendamment de celui de sa maison mère — c'est le mécanisme qui permet à une
 * organisation d'ouvrir une agence dans un autre pays sans modification de code.
 */
@Injectable()
export class UpdateOrganisationReferentielUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(id: string, referentiel: Partial<ReferentielOrganisation>): Promise<void> {
    const organisation = await this.organisationRepository.findById(id);
    if (!organisation) throw new OrganisationNotFoundError();

    organisation.updateReferentiel(referentiel);
    await this.organisationRepository.save(organisation);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ORGANISATION_REFERENTIEL_UPDATED,
      gsgOrgId: id,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id, referentiel },
    });
  }
}

@Injectable()
export class ReattachOrganisationUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * Rattache une organisation à une nouvelle maison mère (ou la détache si `null`).
   * Refuse explicitement toute opération qui créerait un cycle dans l'arbre de filiation
   * (ex. rattacher une maison mère comme filiale de sa propre filiale).
   */
  async execute(organisationId: string, nouvelleOrganisationMereId: string | null): Promise<void> {
    const organisation = await this.organisationRepository.findById(organisationId);
    if (!organisation) throw new OrganisationNotFoundError();

    if (nouvelleOrganisationMereId) {
      const cible = await this.organisationRepository.findById(nouvelleOrganisationMereId);
      if (!cible) throw new OrganisationNotFoundError();

      const creeraitUnCycle = await this.organisationRepository.isDescendantOf(
        organisationId,
        nouvelleOrganisationMereId,
      );
      if (creeraitUnCycle) {
        throw new CircularParentingError();
      }
    }

    organisation.reattachToParent(nouvelleOrganisationMereId);
    await this.organisationRepository.save(organisation);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ORGANISATION_REATTACHED,
      gsgOrgId: organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id: organisationId, organisationMereId: nouvelleOrganisationMereId },
    });
  }
}

@Injectable()
export class SetOrganisationActivationUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async deactivate(id: string): Promise<void> {
    const organisation = await this.organisationRepository.findById(id);
    if (!organisation) throw new OrganisationNotFoundError();
    organisation.deactivate();
    await this.organisationRepository.save(organisation);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.ORGANISATION_DEACTIVATED,
      gsgOrgId: id,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id },
    });
  }

  async reactivate(id: string): Promise<void> {
    const organisation = await this.organisationRepository.findById(id);
    if (!organisation) throw new OrganisationNotFoundError();
    organisation.reactivate();
    await this.organisationRepository.save(organisation);
  }
}

@Injectable()
export class GetOrganisationUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
  ) {}

  async execute(id: string): Promise<Organisation> {
    const organisation = await this.organisationRepository.findById(id);
    if (!organisation) throw new OrganisationNotFoundError();
    return organisation;
  }
}

@Injectable()
export class ListOrganisationsUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
  ) {}

  async execute(params: { includeInactives: boolean }): Promise<Organisation[]> {
    return this.organisationRepository.list({ activesUniquement: !params.includeInactives });
  }
}

@Injectable()
export class ListFilialesUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
  ) {}

  async execute(organisationMereId: string): Promise<Organisation[]> {
    return this.organisationRepository.findByOrganisationMere(organisationMereId);
  }
}
