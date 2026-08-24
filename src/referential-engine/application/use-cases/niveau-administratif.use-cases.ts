import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NiveauAdministratif } from '../../domain/entities/niveau-administratif.entity';
import {
  NIVEAU_ADMINISTRATIF_REPOSITORY,
  NiveauAdministratifRepository,
} from '../../domain/repositories/referential-engine.repositories';
import { NiveauAdministratifRangAlreadyExistsError } from '../../domain/exceptions/referential-engine.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_EVENT_TYPES } from '../../domain/events/referential-engine-event-catalog';

export interface CreateNiveauAdministratifCommand {
  paysId: string;
  rang: number;
  nom: string;
}

@Injectable()
export class CreateNiveauAdministratifUseCase {
  constructor(
    @Inject(NIVEAU_ADMINISTRATIF_REPOSITORY)
    private readonly niveauAdministratifRepository: NiveauAdministratifRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * KER-ADM-01 : c'est CETTE opération, répétée une fois par pays avec des noms différents,
   * qui absorbe la diversité des découpages administratifs sans jamais toucher au schéma
   * PostgreSQL — "Région/Préfecture/Sous-préfecture" pour un pays, "District/Comté" pour un
   * autre ne sont que des lignes différentes dans cette même table.
   */
  async execute(command: CreateNiveauAdministratifCommand): Promise<{ id: string }> {
    const existant = await this.niveauAdministratifRepository.findByPaysAndRang(
      command.paysId,
      command.rang,
    );
    if (existant) {
      throw new NiveauAdministratifRangAlreadyExistsError(command.paysId, command.rang);
    }

    const niveau = NiveauAdministratif.create({ id: uuidv4(), ...command });
    await this.niveauAdministratifRepository.save(niveau);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.NIVEAU_ADMINISTRATIF_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: niveau.id, paysId: command.paysId, rang: command.rang, nom: command.nom },
    });

    return { id: niveau.id };
  }
}

@Injectable()
export class ListNiveauxAdministratifsUseCase {
  constructor(
    @Inject(NIVEAU_ADMINISTRATIF_REPOSITORY)
    private readonly niveauAdministratifRepository: NiveauAdministratifRepository,
  ) {}

  async execute(paysId: string): Promise<NiveauAdministratif[]> {
    return this.niveauAdministratifRepository.findByPays(paysId);
  }
}
