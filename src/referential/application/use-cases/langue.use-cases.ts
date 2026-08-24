import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Langue, StatutPaysLangue } from '../../domain/entities/devise-et-langue.entity';
import { PaysLangue } from '../../domain/entities/relations.entity';
import {
  LANGUE_REPOSITORY,
  LangueRepository,
  PAYS_LANGUE_REPOSITORY,
  PAYS_REPOSITORY,
  PaysLangueRepository,
  PaysRepository,
} from '../../domain/repositories/referential.repositories';
import {
  LangueCodeIso639AlreadyExistsError,
  LangueNotFoundError,
  PaysNotFoundError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

@Injectable()
export class CreateLangueUseCase {
  constructor(
    @Inject(LANGUE_REPOSITORY) private readonly langueRepository: LangueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: { codeIso639: string; nom: string }): Promise<{ id: string }> {
    const codeNormalise = command.codeIso639.trim().toLowerCase();
    const dejaExistante = await this.langueRepository.existsByCodeIso639(codeNormalise);
    if (dejaExistante) {
      throw new LangueCodeIso639AlreadyExistsError(codeNormalise);
    }

    const langue = Langue.create({ id: uuidv4(), ...command, codeIso639: codeNormalise });
    await this.langueRepository.save(langue);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.LANGUE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: langue.id, codeIso639: langue.codeIso639 },
    });

    return { id: langue.id };
  }
}

@Injectable()
export class TransitionLangueWorkflowUseCase {
  constructor(
    @Inject(LANGUE_REPOSITORY) private readonly langueRepository: LangueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const langue = await this.get(id);
    langue.submitForReview();
    await this.langueRepository.save(langue);
  }

  async validate(id: string): Promise<void> {
    const langue = await this.get(id);
    langue.validate();
    await this.langueRepository.save(langue);
  }

  async publish(id: string): Promise<void> {
    const langue = await this.get(id);
    langue.publish();
    await this.langueRepository.save(langue);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.LANGUE_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: langue.id, codeIso639: langue.codeIso639 },
    });
  }

  private async get(id: string): Promise<Langue> {
    const langue = await this.langueRepository.findById(id);
    if (!langue) throw new LangueNotFoundError();
    return langue;
  }
}

/** KER-REF-06 : rattache une langue à un pays avec un statut (officielle, nationale...) et un ordre. */
@Injectable()
export class AttachLangueToPaysUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(LANGUE_REPOSITORY) private readonly langueRepository: LangueRepository,
    @Inject(PAYS_LANGUE_REPOSITORY) private readonly paysLangueRepository: PaysLangueRepository,
  ) {}

  async execute(params: {
    paysId: string;
    langueId: string;
    statut: StatutPaysLangue;
    ordre: number;
  }): Promise<{ id: string }> {
    const pays = await this.paysRepository.findById(params.paysId);
    if (!pays) throw new PaysNotFoundError();
    const langue = await this.langueRepository.findById(params.langueId);
    if (!langue) throw new LangueNotFoundError();

    const relation = PaysLangue.create({ id: uuidv4(), ...params });
    await this.paysLangueRepository.save(relation);

    return { id: relation.id };
  }
}

@Injectable()
export class ListLanguesUseCase {
  constructor(@Inject(LANGUE_REPOSITORY) private readonly langueRepository: LangueRepository) {}

  async execute(params: { includeNonPubliees: boolean }): Promise<Langue[]> {
    return this.langueRepository.list({ publieUniquement: !params.includeNonPubliees });
  }
}
