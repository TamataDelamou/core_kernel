import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventOrmEntity, StatutOutbox } from './outbox-event.orm-entity';
import { TransactionalRepository } from '../persistence/transactional-repository.base';
import { TransactionContextService } from '../persistence/transaction-context.service';

export const OUTBOX_EVENT_REPOSITORY = Symbol('OUTBOX_EVENT_REPOSITORY');

export interface OutboxEventRecord {
  id: string;
  type: string;
  gsgOrgId: string | null;
  horodatage: Date;
  produitSource: string;
  chargeUtile: Record<string, unknown>;
  statut: StatutOutbox;
  tentatives: number;
  derniereErreur: string | null;
  creeLe: Date;
  publieLe: Date | null;
}

/**
 * Port interne (pas un common/kernel-port — seuls OutboxEventPublisherService et
 * OutboxRelayService, tous deux internes à kernel-infrastructure, en ont besoin).
 */
export interface OutboxEventRepository {
  insert(record: Omit<OutboxEventRecord, 'statut' | 'tentatives' | 'derniereErreur' | 'publieLe'>): Promise<void>;
  /** Lot le plus ancien en attente de publication, trié par ordre de création (FIFO). */
  findPendingBatch(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailedAttempt(id: string, erreur: string): Promise<void>;
  /** Bascule vers un statut terminal (visible en ops) les lignes ayant dépassé le nombre maximal de tentatives. */
  markPermanentlyFailed(maxTentatives: number): Promise<number>;
  countByStatut(statut: StatutOutbox): Promise<number>;
}

@Injectable()
export class TypeOrmOutboxEventRepository
  extends TransactionalRepository<OutboxEventOrmEntity>
  implements OutboxEventRepository
{
  constructor(
    @InjectRepository(OutboxEventOrmEntity) repo: Repository<OutboxEventOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async insert(
    record: Omit<OutboxEventRecord, 'statut' | 'tentatives' | 'derniereErreur' | 'publieLe'>,
  ): Promise<void> {
    const row = new OutboxEventOrmEntity();
    row.id = record.id;
    row.type = record.type;
    row.gsgOrgId = record.gsgOrgId;
    row.horodatage = record.horodatage;
    row.produitSource = record.produitSource;
    row.chargeUtile = record.chargeUtile;
    row.statut = 'en_attente';
    row.tentatives = 0;
    row.derniereErreur = null;
    row.creeLe = record.creeLe;
    row.publieLe = null;
    await this.repo.insert(row);
  }

  async findPendingBatch(limit: number): Promise<OutboxEventRecord[]> {
    return this.repo.find({
      where: { statut: 'en_attente' },
      order: { creeLe: 'ASC' },
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.repo.update({ id }, { statut: 'publie', publieLe: new Date() });
  }

  async markFailedAttempt(id: string, erreur: string): Promise<void> {
    await this.repo.increment({ id }, 'tentatives', 1);
    await this.repo.update({ id }, { derniereErreur: erreur.slice(0, 2000) });
  }

  async markPermanentlyFailed(maxTentatives: number): Promise<number> {
    // `tentatives >= maxTentatives` (comparaison à une valeur dynamique) n'est pas exprimable
    // via l'objet `where` simplifié de TypeORM — requête construite explicitement pour cette
    // bascule ciblée, plus lisible ici qu'un opérateur générique MoreThanOrEqual mal nommé.
    const result = await this.repo
      .createQueryBuilder()
      .update(OutboxEventOrmEntity)
      .set({ statut: 'echec' })
      .where('statut = :enAttente', { enAttente: 'en_attente' })
      .andWhere('tentatives >= :max', { max: maxTentatives })
      .execute();
    return result.affected ?? 0;
  }

  async countByStatut(statut: StatutOutbox): Promise<number> {
    return this.repo.count({ where: { statut } });
  }
}
