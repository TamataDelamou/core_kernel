import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CONFIGURATION_GLOBALE_ID, ConfigurationGlobale } from '../../../domain/entities/configuration-globale.entity';
import { ConfigurationGlobaleRepository } from '../../../domain/repositories/configuration-globale.repository';
import { ConfigurationGlobaleOrmEntity } from './orm-entities';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';

@Injectable()
export class TypeOrmConfigurationGlobaleRepository
  extends TransactionalRepository<ConfigurationGlobaleOrmEntity>
  implements ConfigurationGlobaleRepository
{
  constructor(
    @InjectRepository(ConfigurationGlobaleOrmEntity) repo: Repository<ConfigurationGlobaleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async get(): Promise<ConfigurationGlobale | null> {
    const row = await this.repo.findOne({ where: { id: CONFIGURATION_GLOBALE_ID } });
    return row ? ConfigurationGlobale.reconstitute(row) : null;
  }

  async save(configuration: ConfigurationGlobale): Promise<void> {
    const snapshot = configuration.toSnapshot();
    await this.repo.save({ id: CONFIGURATION_GLOBALE_ID, ...snapshot });
  }
}
