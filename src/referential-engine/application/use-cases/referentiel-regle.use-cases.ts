import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ReferentielRegle, RegleNotAttachedToTerminalNodeError } from '../../domain/entities/referentiel-regle.entity';
import { MetadonneesGouvernance, StatutConfiance } from '../../domain/entities/gouvernance';
import {
  NOEUD_HIERARCHIQUE_REPOSITORY,
  NoeudHierarchiqueRepository,
  REFERENTIEL_REGLE_REPOSITORY,
  ReferentielRegleRepository,
} from '../../domain/repositories/referential-engine.repositories';
import { ReferentielRegleNotFoundError } from '../../domain/exceptions/referential-engine.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_EVENT_TYPES } from '../../domain/events/referential-engine-event-catalog';

export interface CreateReferentielRegleCommand {
  referentielHierarchiqueId: string;
  nom: string;
  sigle?: string | null;
  valeur: string;
  metadata?: Record<string, unknown> | null;
  organismeCertificateur: string;
  statutConfiance: StatutConfiance;
  source: string;
}

@Injectable()
export class CreateReferentielRegleUseCase {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateReferentielRegleCommand): Promise<{ id: string }> {
    const noeud = await this.noeudRepository.findById(command.referentielHierarchiqueId);
    if (!noeud || !noeud.estNoeudTerminal) {
      throw new RegleNotAttachedToTerminalNodeError();
    }

    const gouvernance = MetadonneesGouvernance.create({
      organismeCertificateur: command.organismeCertificateur,
      statutConfiance: command.statutConfiance,
      source: command.source,
    });

    const regle = ReferentielRegle.create({
      id: uuidv4(),
      referentielHierarchiqueId: command.referentielHierarchiqueId,
      codeDomaine: noeud.codeDomaine,
      nom: command.nom,
      sigle: command.sigle,
      valeur: command.valeur,
      metadata: command.metadata,
      gouvernance,
    });
    await this.regleRepository.save(regle);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.REFERENTIEL_REGLE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: regle.id, referentielHierarchiqueId: command.referentielHierarchiqueId },
    });

    return { id: regle.id };
  }
}

@Injectable()
export class UpdateReferentielRegleUseCase {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
  ) {}

  async updateDetails(
    id: string,
    updates: Partial<{ nom: string; sigle: string | null; valeur: string; metadata: Record<string, unknown> | null }>,
  ): Promise<void> {
    const regle = await this.get(id);
    regle.updateDetails(updates);
    await this.regleRepository.save(regle);
  }

  async updateGouvernance(
    id: string,
    params: { organismeCertificateur: string; statutConfiance: StatutConfiance; source: string },
  ): Promise<void> {
    const regle = await this.get(id);
    regle.updateGouvernance(MetadonneesGouvernance.create(params));
    await this.regleRepository.save(regle);
  }

  private async get(id: string): Promise<ReferentielRegle> {
    const regle = await this.regleRepository.findById(id);
    if (!regle) throw new ReferentielRegleNotFoundError();
    return regle;
  }
}

@Injectable()
export class TransitionRegleWorkflowUseCase {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.submitForReview();
    await this.regleRepository.save(regle);
  }

  async validate(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.validate();
    await this.regleRepository.save(regle);
  }

  async rejectToDraft(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.rejectToDraft();
    await this.regleRepository.save(regle);
  }

  async publish(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.publish();
    await this.regleRepository.save(regle);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.REFERENTIEL_REGLE_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: regle.id, referentielHierarchiqueId: regle.referentielHierarchiqueId },
    });
  }

  private async get(id: string): Promise<ReferentielRegle> {
    const regle = await this.regleRepository.findById(id);
    if (!regle) throw new ReferentielRegleNotFoundError();
    return regle;
  }
}

@Injectable()
export class SetRegleActivationUseCase {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
  ) {}

  async deactivate(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.deactivate();
    await this.regleRepository.save(regle);
  }

  async reactivate(id: string): Promise<void> {
    const regle = await this.get(id);
    regle.reactivate();
    await this.regleRepository.save(regle);
  }

  private async get(id: string): Promise<ReferentielRegle> {
    const regle = await this.regleRepository.findById(id);
    if (!regle) throw new ReferentielRegleNotFoundError();
    return regle;
  }
}

@Injectable()
export class QueryReglesUseCase {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
  ) {}

  async getById(id: string): Promise<ReferentielRegle> {
    const regle = await this.regleRepository.findById(id);
    if (!regle) throw new ReferentielRegleNotFoundError();
    return regle;
  }

  async listByNoeud(referentielHierarchiqueId: string): Promise<ReferentielRegle[]> {
    return this.regleRepository.findByNoeud(referentielHierarchiqueId);
  }
}
