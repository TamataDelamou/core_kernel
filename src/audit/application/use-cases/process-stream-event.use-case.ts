import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditEvenement } from '../../domain/entities/audit-evenement.entity';
import {
  AUDIT_EVENEMENT_REPOSITORY,
  AuditEvenementRepository,
} from '../../domain/repositories/audit.repositories';
import { redactSensitiveFields } from '../../domain/services/redaction';
import { InvalidStreamMessageError } from '../../domain/exceptions/audit.exceptions';

export interface StreamMessage {
  /** Identifiant de la ligne outbox d'origine (champ "outboxId" du message Redis), utilisé pour la déduplication. */
  outboxId: string;
  type: string;
  gsgOrgId: string | null;
  horodatage: string;
  produitSource: string;
  chargeUtileBrute: string; // JSON sérialisé tel que reçu du message Redis Streams
}

@Injectable()
export class ProcessStreamEventUseCase {
  constructor(
    @Inject(AUDIT_EVENEMENT_REPOSITORY) private readonly auditEvenementRepository: AuditEvenementRepository,
  ) {}

  /**
   * Idempotent par construction : si `outboxId` a déjà été traité (redélivrance après un
   * XAUTOCLAIM suite au crash d'un autre consommateur, par exemple), l'enregistrement n'est
   * jamais dupliqué. Retourne sans erreur dans ce cas — un doublon détecté n'est pas un échec
   * de traitement, c'est le comportement correct attendu du at-least-once delivery.
   */
  async execute(message: StreamMessage): Promise<void> {
    if (!message.outboxId || !message.type) {
      throw new InvalidStreamMessageError('champs "outboxId" ou "type" absents.');
    }

    const dejaTraite = await this.auditEvenementRepository.existsByEvenementId(message.outboxId);
    if (dejaTraite) {
      return;
    }

    let chargeUtile: Record<string, unknown>;
    try {
      const parsed = JSON.parse(message.chargeUtileBrute) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('la charge utile désérialisée n\'est pas un objet JSON.');
      }
      chargeUtile = parsed as Record<string, unknown>;
    } catch (error) {
      throw new InvalidStreamMessageError(
        `charge utile JSON invalide (${error instanceof Error ? error.message : String(error)}).`,
      );
    }

    const auditEvenement = AuditEvenement.create({
      id: uuidv4(),
      evenementId: message.outboxId,
      type: message.type,
      gsgOrgId: message.gsgOrgId,
      produitSource: message.produitSource,
      horodatage: new Date(message.horodatage),
      chargeUtile: redactSensitiveFields(chargeUtile),
    });

    await this.auditEvenementRepository.save(auditEvenement);
  }
}
