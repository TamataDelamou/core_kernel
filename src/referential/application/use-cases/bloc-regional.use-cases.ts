import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BlocRegional, TypeBlocRegional } from '../../domain/entities/bloc-regional.entity';
import { PaysBlocRegional } from '../../domain/entities/relations.entity';
import {
  BLOC_REGIONAL_REPOSITORY,
  BlocRegionalRepository,
  PAYS_BLOC_REGIONAL_REPOSITORY,
  PAYS_REPOSITORY,
  PaysBlocRegionalRepository,
  PaysRepository,
} from '../../domain/repositories/referential.repositories';
import {
  BlocRegionalCodeAlreadyExistsError,
  BlocRegionalNotFoundError,
  PaysBlocRegionalNotFoundError,
  PaysNotFoundError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

@Injectable()
export class CreateBlocRegionalUseCase {
  constructor(
    @Inject(BLOC_REGIONAL_REPOSITORY) private readonly blocRegionalRepository: BlocRegionalRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: { code: string; nom: string; type: TypeBlocRegional }): Promise<{ id: string }> {
    const codeNormalise = command.code.trim().toUpperCase();
    const dejaExistant = await this.blocRegionalRepository.existsByCode(codeNormalise);
    if (dejaExistant) {
      throw new BlocRegionalCodeAlreadyExistsError(codeNormalise);
    }

    const blocRegional = BlocRegional.create({ id: uuidv4(), ...command, code: codeNormalise });
    await this.blocRegionalRepository.save(blocRegional);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.BLOC_REGIONAL_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: blocRegional.id, code: blocRegional.code },
    });

    return { id: blocRegional.id };
  }
}

@Injectable()
export class TransitionBlocRegionalWorkflowUseCase {
  constructor(
    @Inject(BLOC_REGIONAL_REPOSITORY) private readonly blocRegionalRepository: BlocRegionalRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const bloc = await this.get(id);
    bloc.submitForReview();
    await this.blocRegionalRepository.save(bloc);
  }

  async validate(id: string): Promise<void> {
    const bloc = await this.get(id);
    bloc.validate();
    await this.blocRegionalRepository.save(bloc);
  }

  async publish(id: string): Promise<void> {
    const bloc = await this.get(id);
    bloc.publish();
    await this.blocRegionalRepository.save(bloc);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.BLOC_REGIONAL_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: bloc.id, code: bloc.code },
    });
  }

  private async get(id: string): Promise<BlocRegional> {
    const bloc = await this.blocRegionalRepository.findById(id);
    if (!bloc) throw new BlocRegionalNotFoundError();
    return bloc;
  }
}

@Injectable()
export class AddPaysToBlocRegionalUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(BLOC_REGIONAL_REPOSITORY) private readonly blocRegionalRepository: BlocRegionalRepository,
    @Inject(PAYS_BLOC_REGIONAL_REPOSITORY)
    private readonly paysBlocRegionalRepository: PaysBlocRegionalRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(params: { paysId: string; blocRegionalId: string; dateAdhesion: Date }): Promise<{ id: string }> {
    const pays = await this.paysRepository.findById(params.paysId);
    if (!pays) throw new PaysNotFoundError();
    const bloc = await this.blocRegionalRepository.findById(params.blocRegionalId);
    if (!bloc) throw new BlocRegionalNotFoundError();

    const relation = PaysBlocRegional.create({ id: uuidv4(), ...params });
    await this.paysBlocRegionalRepository.save(relation);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.PAYS_BLOC_REGIONAL_ADHESION,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { paysId: params.paysId, blocRegionalId: params.blocRegionalId },
    });

    return { id: relation.id };
  }
}

/**
 * KER-REF-07 : retrait effectif d'un pays d'un bloc régional (cas d'école : Mali, Burkina
 * Faso, Niger — CEDEAO, 29 janvier 2025). La relation n'est jamais supprimée, seulement
 * clôturée par une date de retrait et un changement de statut.
 */
@Injectable()
export class WithdrawPaysFromBlocRegionalUseCase {
  constructor(
    @Inject(PAYS_BLOC_REGIONAL_REPOSITORY)
    private readonly paysBlocRegionalRepository: PaysBlocRegionalRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(relationId: string, dateRetrait: Date): Promise<void> {
    const relation = await this.paysBlocRegionalRepository.findById(relationId);
    if (!relation) throw new PaysBlocRegionalNotFoundError();

    relation.withdraw(dateRetrait);
    await this.paysBlocRegionalRepository.save(relation);

    const snapshot = relation.toSnapshot();
    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.PAYS_BLOC_REGIONAL_RETRAIT,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: {
        paysId: snapshot.paysId,
        blocRegionalId: snapshot.blocRegionalId,
        dateRetrait: dateRetrait.toISOString(),
      },
    });
  }
}

@Injectable()
export class ListBlocsRegionauxUseCase {
  constructor(
    @Inject(BLOC_REGIONAL_REPOSITORY) private readonly blocRegionalRepository: BlocRegionalRepository,
  ) {}

  async execute(params: { includeNonPublies: boolean }): Promise<BlocRegional[]> {
    return this.blocRegionalRepository.list({ publieUniquement: !params.includeNonPublies });
  }
}
