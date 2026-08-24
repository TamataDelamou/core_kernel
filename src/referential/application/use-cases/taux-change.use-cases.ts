import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TauxChange } from '../../domain/entities/relations.entity';
import {
  DEVISE_REPOSITORY,
  DeviseRepository,
  TAUX_CHANGE_REPOSITORY,
  TauxChangeRepository,
} from '../../domain/repositories/referential.repositories';
import {
  DeviseNotFoundError,
  NoValidExchangeRateError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

export interface SetTauxChangeCommand {
  deviseBaseId: string;
  deviseCibleId: string;
  taux: string; // décimal en chaîne — jamais un `number` JS (précision monétaire)
  validDu: Date;
  validAu?: Date | null;
  source: string;
}

@Injectable()
export class SetTauxChangeUseCase {
  constructor(
    @Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository,
    @Inject(TAUX_CHANGE_REPOSITORY) private readonly tauxChangeRepository: TauxChangeRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: SetTauxChangeCommand): Promise<{ id: string }> {
    const deviseBase = await this.deviseRepository.findById(command.deviseBaseId);
    if (!deviseBase) throw new DeviseNotFoundError();
    const deviseCible = await this.deviseRepository.findById(command.deviseCibleId);
    if (!deviseCible) throw new DeviseNotFoundError();

    const tauxChange = TauxChange.create({
      id: uuidv4(),
      deviseBaseId: command.deviseBaseId,
      deviseCibleId: command.deviseCibleId,
      taux: command.taux,
      validDu: command.validDu,
      validAu: command.validAu ?? null,
      source: command.source,
    });
    await this.tauxChangeRepository.save(tauxChange);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.TAUX_CHANGE_SET,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: {
        id: tauxChange.id,
        deviseBaseId: command.deviseBaseId,
        deviseCibleId: command.deviseCibleId,
        taux: command.taux,
        source: command.source,
      },
    });

    return { id: tauxChange.id };
  }
}

export interface ResolveExchangeRateResult {
  taux: string;
  validDu: Date;
  validAu: Date | null;
  source: string;
}

/**
 * KER-REF-04 : unique point de résolution de taux de change de la plateforme. Ne renvoie
 * JAMAIS de valeur par défaut ou de parité 1:1 supposée — l'absence de taux valide à
 * l'instant demandé est une erreur explicite que l'appelant doit gérer, jamais un silence.
 */
@Injectable()
export class ResolveExchangeRateUseCase {
  constructor(
    @Inject(TAUX_CHANGE_REPOSITORY) private readonly tauxChangeRepository: TauxChangeRepository,
  ) {}

  async execute(params: {
    deviseBaseId: string;
    deviseCibleId: string;
    instant?: Date;
  }): Promise<ResolveExchangeRateResult> {
    const instant = params.instant ?? new Date();

    if (params.deviseBaseId === params.deviseCibleId) {
      return { taux: '1', validDu: instant, validAu: null, source: 'identite' };
    }

    const candidats = await this.tauxChangeRepository.findByPaire(
      params.deviseBaseId,
      params.deviseCibleId,
    );
    const valide = candidats.find((taux) => taux.isValidAt(instant));

    if (!valide) {
      throw new NoValidExchangeRateError(params.deviseBaseId, params.deviseCibleId, instant);
    }

    const snapshot = valide.toSnapshot();
    return {
      taux: snapshot.taux,
      validDu: snapshot.validDu,
      validAu: snapshot.validAu,
      source: snapshot.source,
    };
  }
}
