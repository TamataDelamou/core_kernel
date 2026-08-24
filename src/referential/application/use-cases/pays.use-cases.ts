import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Pays } from '../../domain/entities/pays.entity';
import { PAYS_REPOSITORY, PaysRepository } from '../../domain/repositories/referential.repositories';
import {
  PaysCodeIsoAlreadyExistsError,
  PaysNotFoundError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

export interface CreatePaysCommand {
  codeIso: string;
  nom: string;
  organismeRegionalPrincipal?: string;
  notesSouverainete?: string;
  adresseGabarit?: string;
  fuseauHoraire?: string;
}

@Injectable()
export class CreatePaysUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreatePaysCommand): Promise<{ id: string }> {
    const codeIsoNormalise = command.codeIso.trim().toUpperCase();
    const dejaExistant = await this.paysRepository.existsByCodeIso(codeIsoNormalise);
    if (dejaExistant) {
      throw new PaysCodeIsoAlreadyExistsError(codeIsoNormalise);
    }

    const pays = Pays.create({ id: uuidv4(), ...command, codeIso: codeIsoNormalise });
    await this.paysRepository.save(pays);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.PAYS_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: pays.id, codeIso: pays.codeIso },
    });

    return { id: pays.id };
  }
}

@Injectable()
export class UpdatePaysUseCase {
  constructor(@Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository) {}

  async execute(
    id: string,
    updates: Partial<{
      nom: string;
      organismeRegionalPrincipal: string | null;
      notesSouverainete: string | null;
      adresseGabarit: string | null;
      fuseauHoraire: string | null;
    }>,
  ): Promise<void> {
    const pays = await this.paysRepository.findById(id);
    if (!pays) throw new PaysNotFoundError();
    pays.updateDetails(updates);
    await this.paysRepository.save(pays);
  }
}

/** Transitions du workflow de publication (KER-AUD-04) : brouillon → en_revision → valide → publie. */
@Injectable()
export class TransitionPaysWorkflowUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const pays = await this.get(id);
    pays.submitForReview();
    await this.paysRepository.save(pays);
  }

  async validate(id: string): Promise<void> {
    const pays = await this.get(id);
    pays.validate();
    await this.paysRepository.save(pays);
  }

  async rejectToDraft(id: string): Promise<void> {
    const pays = await this.get(id);
    pays.rejectToDraft();
    await this.paysRepository.save(pays);
  }

  async publish(id: string): Promise<void> {
    const pays = await this.get(id);
    pays.publish();
    await this.paysRepository.save(pays);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.PAYS_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: pays.id, codeIso: pays.codeIso },
    });
  }

  private async get(id: string): Promise<Pays> {
    const pays = await this.paysRepository.findById(id);
    if (!pays) throw new PaysNotFoundError();
    return pays;
  }
}

@Injectable()
export class SetPaysActivationUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  /** KER-ADM-04 : désactivation sans suppression, pour préserver l'intégrité référentielle. */
  async deactivate(id: string): Promise<void> {
    const pays = await this.paysRepository.findById(id);
    if (!pays) throw new PaysNotFoundError();
    pays.deactivate();
    await this.paysRepository.save(pays);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.PAYS_DEACTIVATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: pays.id },
    });
  }

  async reactivate(id: string): Promise<void> {
    const pays = await this.paysRepository.findById(id);
    if (!pays) throw new PaysNotFoundError();
    pays.reactivate();
    await this.paysRepository.save(pays);
  }
}

@Injectable()
export class ListPaysUseCase {
  constructor(@Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository) {}

  /** Par défaut, seules les entrées publiées sont renvoyées (consommation produit standard). */
  async execute(params: { includeNonPublies: boolean }): Promise<Pays[]> {
    return this.paysRepository.list({ publieUniquement: !params.includeNonPublies });
  }
}

@Injectable()
export class GetPaysUseCase {
  constructor(@Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository) {}

  async execute(id: string): Promise<Pays> {
    const pays = await this.paysRepository.findById(id);
    if (!pays) throw new PaysNotFoundError();
    return pays;
  }
}
