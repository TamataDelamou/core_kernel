import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Traduction } from '../../domain/entities/locale-et-traduction.entity';
import {
  LOCALE_REPOSITORY,
  LocaleRepository,
  TRADUCTION_REPOSITORY,
  TraductionRepository,
} from '../../domain/repositories/referential.repositories';
import {
  LocaleNotFoundError,
  TraductionKeyAlreadyExistsError,
  TraductionNotFoundError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

export interface CreateTraductionCommand {
  localeId: string;
  cle: string;
  valeur: string;
}

@Injectable()
export class CreateTraductionUseCase {
  constructor(
    @Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository,
    @Inject(TRADUCTION_REPOSITORY) private readonly traductionRepository: TraductionRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateTraductionCommand): Promise<{ id: string }> {
    const locale = await this.localeRepository.findById(command.localeId);
    if (!locale) throw new LocaleNotFoundError();

    const existante = await this.traductionRepository.findByLocaleAndCle(command.localeId, command.cle);
    if (existante) {
      throw new TraductionKeyAlreadyExistsError(command.cle, command.localeId);
    }

    const traduction = Traduction.create({ id: uuidv4(), ...command });
    await this.traductionRepository.save(traduction);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.TRADUCTION_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: traduction.id, localeId: command.localeId, cle: command.cle },
    });

    return { id: traduction.id };
  }
}

@Injectable()
export class UpdateTraductionUseCase {
  constructor(
    @Inject(TRADUCTION_REPOSITORY) private readonly traductionRepository: TraductionRepository,
  ) {}

  async execute(id: string, valeur: string): Promise<void> {
    const traduction = await this.traductionRepository.findById(id);
    if (!traduction) throw new TraductionNotFoundError();
    traduction.updateValeur(valeur);
    await this.traductionRepository.save(traduction);
  }
}

@Injectable()
export class ListTraductionsByLocaleUseCase {
  constructor(
    @Inject(TRADUCTION_REPOSITORY) private readonly traductionRepository: TraductionRepository,
  ) {}

  async execute(localeId: string): Promise<Traduction[]> {
    return this.traductionRepository.findByLocale(localeId);
  }
}
