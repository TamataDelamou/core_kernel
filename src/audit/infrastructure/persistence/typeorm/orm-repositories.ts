import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { AuditEvenement } from '../../../domain/entities/audit-evenement.entity';
import { EvenementEnEchec } from '../../../domain/entities/evenement-en-echec.entity';
import {
  AuditEvenementRepository,
  AuditTrailPage,
  AuditTrailQuery,
  DeadLetterRepository,
} from '../../../domain/repositories/audit.repositories';
import { AuditEvenementOrmEntity, EvenementEnEchecOrmEntity } from './orm-entities';

@Injectable()
export class TypeOrmAuditEvenementRepository
  extends TransactionalRepository<AuditEvenementOrmEntity>
  implements AuditEvenementRepository
{
  constructor(
    @InjectRepository(AuditEvenementOrmEntity) repo: Repository<AuditEvenementOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async existsByEvenementId(evenementId: string): Promise<boolean> {
    const count = await this.repo.count({ where: { evenementId } });
    return count > 0;
  }

  async save(auditEvenement: AuditEvenement): Promise<void> {
    const snapshot = auditEvenement.toSnapshot();
    try {
      // `as any` ciblé et documenté : limitation connue de TypeORM — `_QueryDeepPartialEntity`
      // tente de partial-ifier récursivement toute colonne `jsonb` typée `Record<string,
      // unknown>` au lieu de la traiter comme une valeur terminale, ce qui produit un
      // conflit de type purement structurel (jamais un problème d'exécution : chargeUtile
      // est bien un objet JSON sérialisable, exactement ce que la colonne attend).
      await this.repo.insert({ ...snapshot } as any);
    } catch (error) {
      // Contrainte d'unicité sur evenement_id violée = doublon détecté en base au moment de
      // l'écriture (fenêtre de course entre le existsByEvenementId applicatif et l'insertion,
      // possible si deux consommateurs traitent le même message quasi simultanément après un
      // XAUTOCLAIM). Ce n'est pas une erreur : c'est l'idempotence qui fonctionne correctement.
      if (this.isUniqueViolation(error)) return;
      throw error;
    }
  }

  async queryTrail(query: AuditTrailQuery): Promise<AuditTrailPage> {
    const qb = this.repo.createQueryBuilder('audit');

    if (query.gsgOrgId) qb.andWhere('audit.gsg_org_id = :gsgOrgId', { gsgOrgId: query.gsgOrgId });
    if (query.type) qb.andWhere('audit.type = :type', { type: query.type });
    if (query.depuis && query.jusqua) {
      qb.andWhere('audit.horodatage BETWEEN :depuis AND :jusqua', {
        depuis: query.depuis,
        jusqua: query.jusqua,
      });
    } else if (query.depuis) {
      qb.andWhere('audit.horodatage >= :depuis', { depuis: query.depuis });
    } else if (query.jusqua) {
      qb.andWhere('audit.horodatage <= :jusqua', { jusqua: query.jusqua });
    }

    qb.orderBy('audit.horodatage', 'DESC');
    qb.skip((query.page - 1) * query.tailleParPage);
    qb.take(query.tailleParPage);

    const [rows, total] = await qb.getManyAndCount();

    return {
      elements: rows.map((row) => AuditEvenement.reconstitute(row)),
      total,
      page: query.page,
      tailleParPage: query.tailleParPage,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
  }
}

@Injectable()
export class TypeOrmDeadLetterRepository
  extends TransactionalRepository<EvenementEnEchecOrmEntity>
  implements DeadLetterRepository
{
  constructor(
    @InjectRepository(EvenementEnEchecOrmEntity) repo: Repository<EvenementEnEchecOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<EvenementEnEchec | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? EvenementEnEchec.reconstitute(row) : null;
  }

  async save(evenementEnEchec: EvenementEnEchec): Promise<void> {
    await this.repo.save(evenementEnEchec.toSnapshot());
  }

  async list(params: {
    page: number;
    tailleParPage: number;
  }): Promise<{ elements: EvenementEnEchec[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      order: { misEnEchecLe: 'DESC' },
      skip: (params.page - 1) * params.tailleParPage,
      take: params.tailleParPage,
    });
    return { elements: rows.map((row) => EvenementEnEchec.reconstitute(row)), total };
  }
}
