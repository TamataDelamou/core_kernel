import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UniteOperationnelle } from '../../domain/entities/unite-operationnelle.entity';
import { ReferentielOrganisation } from '../../domain/entities/organisation.entity';
import {
  ORGANISATION_REPOSITORY,
  OrganisationRepository,
  UNITE_OPERATIONNELLE_REPOSITORY,
  UniteOperationnelleRepository,
} from '../../domain/repositories/org.repositories';
import {
  OrganisationNotFoundError,
  UniteOperationnelleNotFoundError,
} from '../../domain/exceptions/org.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { ORG_EVENT_TYPES } from '../../domain/events/org-event-catalog';

@Injectable()
export class CreateUniteOperationnelleUseCase {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(UNITE_OPERATIONNELLE_REPOSITORY)
    private readonly uniteOperationnelleRepository: UniteOperationnelleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(params: {
    organisationId: string;
    nom: string;
    referentiel: ReferentielOrganisation;
  }): Promise<{ id: string }> {
    const organisation = await this.organisationRepository.findById(params.organisationId);
    if (!organisation) throw new OrganisationNotFoundError();

    const unite = UniteOperationnelle.create({ id: uuidv4(), ...params });
    await this.uniteOperationnelleRepository.save(unite);

    await this.eventPublisher.publish({
      type: ORG_EVENT_TYPES.UNITE_OPERATIONNELLE_CREATED,
      gsgOrgId: params.organisationId,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-org-registry',
      chargeUtile: { id: unite.id, organisationId: params.organisationId, nom: params.nom },
    });

    return { id: unite.id };
  }
}

@Injectable()
export class UpdateUniteOperationnelleReferentielUseCase {
  constructor(
    @Inject(UNITE_OPERATIONNELLE_REPOSITORY)
    private readonly uniteOperationnelleRepository: UniteOperationnelleRepository,
  ) {}

  async execute(id: string, referentiel: Partial<ReferentielOrganisation>): Promise<void> {
    const unite = await this.uniteOperationnelleRepository.findById(id);
    if (!unite) throw new UniteOperationnelleNotFoundError();
    unite.updateReferentiel(referentiel);
    await this.uniteOperationnelleRepository.save(unite);
  }
}

@Injectable()
export class ListUnitesByOrganisationUseCase {
  constructor(
    @Inject(UNITE_OPERATIONNELLE_REPOSITORY)
    private readonly uniteOperationnelleRepository: UniteOperationnelleRepository,
  ) {}

  async execute(organisationId: string): Promise<UniteOperationnelle[]> {
    return this.uniteOperationnelleRepository.findByOrganisation(organisationId);
  }
}

@Injectable()
export class SetUniteOperationnelleActivationUseCase {
  constructor(
    @Inject(UNITE_OPERATIONNELLE_REPOSITORY)
    private readonly uniteOperationnelleRepository: UniteOperationnelleRepository,
  ) {}

  async deactivate(id: string): Promise<void> {
    const unite = await this.uniteOperationnelleRepository.findById(id);
    if (!unite) throw new UniteOperationnelleNotFoundError();
    unite.deactivate();
    await this.uniteOperationnelleRepository.save(unite);
  }

  async reactivate(id: string): Promise<void> {
    const unite = await this.uniteOperationnelleRepository.findById(id);
    if (!unite) throw new UniteOperationnelleNotFoundError();
    unite.reactivate();
    await this.uniteOperationnelleRepository.save(unite);
  }
}
