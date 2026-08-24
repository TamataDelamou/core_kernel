import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TransactionManager } from '../../kernel-ports/transaction-manager.port';
import { TransactionContextService } from './transaction-context.service';

@Injectable()
export class TypeOrmTransactionManager implements TransactionManager {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionContext: TransactionContextService,
  ) {}

  async runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      this.transactionContext.run(manager, () => work(manager)),
    );
  }
}
