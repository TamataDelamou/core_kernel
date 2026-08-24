import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EvenementEnEchec } from '../../domain/entities/evenement-en-echec.entity';
import {
  DEAD_LETTER_REPOSITORY,
  DeadLetterRepository,
} from '../../domain/repositories/audit.repositories';
import {
  DeadLetterEntryAlreadyReplayedError,
  DeadLetterEntryNotFoundError,
} from '../../domain/exceptions/audit.exceptions';
import { redactSensitiveFields } from '../../domain/services/redaction';
import { ProcessStreamEventUseCase, StreamMessage } from './process-stream-event.use-case';

export interface MoveToDeadLetterCommand {
  message: StreamMessage;
  tentatives: number;
  derniereErreur: string;
}

@Injectable()
export class MoveToDeadLetterUseCase {
  constructor(
    @Inject(DEAD_LETTER_REPOSITORY) private readonly deadLetterRepository: DeadLetterRepository,
  ) {}

  async execute(command: MoveToDeadLetterCommand): Promise<void> {
    let chargeUtile: Record<string, unknown>;
    try {
      const parsed = JSON.parse(command.message.chargeUtileBrute) as unknown;
      chargeUtile =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { valeurBrute: command.message.chargeUtileBrute };
    } catch {
      chargeUtile = { valeurBrute: command.message.chargeUtileBrute };
    }

    const entree = EvenementEnEchec.create({
      id: uuidv4(),
      evenementId: command.message.outboxId,
      type: command.message.type,
      gsgOrgId: command.message.gsgOrgId,
      produitSource: command.message.produitSource,
      horodatage: new Date(command.message.horodatage),
      chargeUtile: redactSensitiveFields(chargeUtile),
      tentatives: command.tentatives,
      derniereErreur: command.derniereErreur.slice(0, 2000),
    });

    await this.deadLetterRepository.save(entree);
  }
}

/**
 * Rejeu manuel (opérateur `kernel.admin`) : réinjecte l'événement en échec dans le pipeline
 * de traitement normal via ProcessStreamEventUseCase, en dehors de la boucle de consommation
 * Redis Streams (l'entrée DLQ n'est plus dans le flux — le rejeu est un chemin explicite,
 * jamais automatique : une entrée DLQ signale un problème qui mérite une décision humaine
 * avant nouvelle tentative, pas un retry silencieux supplémentaire).
 */
@Injectable()
export class ReplayDeadLetterUseCase {
  constructor(
    @Inject(DEAD_LETTER_REPOSITORY) private readonly deadLetterRepository: DeadLetterRepository,
    private readonly processStreamEventUseCase: ProcessStreamEventUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const entree = await this.deadLetterRepository.findById(id);
    if (!entree) throw new DeadLetterEntryNotFoundError();

    const snapshot = entree.toSnapshot();
    if (snapshot.rejoueLe !== null) {
      throw new DeadLetterEntryAlreadyReplayedError();
    }

    await this.processStreamEventUseCase.execute({
      outboxId: snapshot.evenementId,
      type: snapshot.type,
      gsgOrgId: snapshot.gsgOrgId,
      horodatage: snapshot.horodatage.toISOString(),
      produitSource: snapshot.produitSource,
      chargeUtileBrute: JSON.stringify(snapshot.chargeUtile),
    });

    entree.markReplayed();
    await this.deadLetterRepository.save(entree);
  }
}
