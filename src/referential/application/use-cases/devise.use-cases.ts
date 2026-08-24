import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Devise } from '../../domain/entities/devise-et-langue.entity';
import { PaysDevise } from '../../domain/entities/relations.entity';
import {
  DEVISE_REPOSITORY,
  DeviseRepository,
  PAYS_DEVISE_REPOSITORY,
  PAYS_REPOSITORY,
  PaysDeviseRepository,
  PaysRepository,
} from '../../domain/repositories/referential.repositories';
import {
  DeviseCodeIso4217AlreadyExistsError,
  DeviseNotFoundError,
  PaysNotFoundError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

export interface CreateDeviseCommand {
  codeIso4217: string;
  nom: string;
  zoneMonetaire?: string;
  decimales: number;
}

@Injectable()
export class CreateDeviseUseCase {
  constructor(
    @Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateDeviseCommand): Promise<{ id: string }> {
    const codeNormalise = command.codeIso4217.trim().toUpperCase();
    const dejaExistante = await this.deviseRepository.existsByCodeIso4217(codeNormalise);
    if (dejaExistante) {
      throw new DeviseCodeIso4217AlreadyExistsError(codeNormalise);
    }

    const devise = Devise.create({ id: uuidv4(), ...command, codeIso4217: codeNormalise });
    await this.deviseRepository.save(devise);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.DEVISE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: devise.id, codeIso4217: devise.codeIso4217 },
    });

    return { id: devise.id };
  }
}

@Injectable()
export class TransitionDeviseWorkflowUseCase {
  constructor(
    @Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const devise = await this.get(id);
    devise.submitForReview();
    await this.deviseRepository.save(devise);
  }

  async validate(id: string): Promise<void> {
    const devise = await this.get(id);
    devise.validate();
    await this.deviseRepository.save(devise);
  }

  async publish(id: string): Promise<void> {
    const devise = await this.get(id);
    devise.publish();
    await this.deviseRepository.save(devise);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.DEVISE_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: devise.id, codeIso4217: devise.codeIso4217 },
    });
  }

  private async get(id: string): Promise<Devise> {
    const devise = await this.deviseRepository.findById(id);
    if (!devise) throw new DeviseNotFoundError();
    return devise;
  }
}

/**
 * KER-REF-03 : rattache une devise à un pays sur une période donnée. Si la nouvelle relation
 * est marquée `devisePrincipale`, toute relation principale active existante pour ce pays est
 * automatiquement close à la date de début de la nouvelle — un pays n'a jamais deux devises
 * principales actives simultanément, sans empêcher la circulation de devises secondaires
 * (zones UEMOA/XOF, CEMAC/XAF).
 */
@Injectable()
export class AttachDeviseToPaysUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository,
    @Inject(PAYS_DEVISE_REPOSITORY) private readonly paysDeviseRepository: PaysDeviseRepository,
  ) {}

  async execute(params: {
    paysId: string;
    deviseId: string;
    dateDebut: Date;
    dateFin?: Date | null;
    devisePrincipale: boolean;
  }): Promise<{ id: string }> {
    const pays = await this.paysRepository.findById(params.paysId);
    if (!pays) throw new PaysNotFoundError();
    const devise = await this.deviseRepository.findById(params.deviseId);
    if (!devise) throw new DeviseNotFoundError();

    if (params.devisePrincipale) {
      const principaleActuelle = await this.paysDeviseRepository.findPrincipaleActive(
        params.paysId,
        params.dateDebut,
      );
      if (principaleActuelle) {
        principaleActuelle.endCirculation(params.dateDebut);
        await this.paysDeviseRepository.save(principaleActuelle);
      }
    }

    const relation = PaysDevise.create({
      id: uuidv4(),
      paysId: params.paysId,
      deviseId: params.deviseId,
      dateDebut: params.dateDebut,
      dateFin: params.dateFin ?? null,
      devisePrincipale: params.devisePrincipale,
    });
    await this.paysDeviseRepository.save(relation);

    return { id: relation.id };
  }
}

@Injectable()
export class ListDevisesUseCase {
  constructor(@Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository) {}

  async execute(params: { includeNonPubliees: boolean }): Promise<Devise[]> {
    return this.deviseRepository.list({ publieUniquement: !params.includeNonPubliees });
  }
}
