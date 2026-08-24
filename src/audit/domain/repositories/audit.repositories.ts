import { AuditEvenement } from '../entities/audit-evenement.entity';
import { EvenementEnEchec } from '../entities/evenement-en-echec.entity';

export const AUDIT_EVENEMENT_REPOSITORY = Symbol('AUDIT_EVENEMENT_REPOSITORY');

export interface AuditTrailQuery {
  gsgOrgId?: string;
  type?: string;
  depuis?: Date;
  jusqua?: Date;
  page: number;
  tailleParPage: number;
}

export interface AuditTrailPage {
  elements: AuditEvenement[];
  total: number;
  page: number;
  tailleParPage: number;
}

export interface AuditEvenementRepository {
  existsByEvenementId(evenementId: string): Promise<boolean>;
  save(auditEvenement: AuditEvenement): Promise<void>;
  /** KER-AUD-01 : consultation des actions significatives pour une organisation donnée. */
  queryTrail(query: AuditTrailQuery): Promise<AuditTrailPage>;
}

export const DEAD_LETTER_REPOSITORY = Symbol('DEAD_LETTER_REPOSITORY');

export interface DeadLetterRepository {
  findById(id: string): Promise<EvenementEnEchec | null>;
  save(evenementEnEchec: EvenementEnEchec): Promise<void>;
  list(params: { page: number; tailleParPage: number }): Promise<{ elements: EvenementEnEchec[]; total: number }>;
}
