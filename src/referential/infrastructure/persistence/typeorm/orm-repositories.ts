import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, IsNull, Repository } from 'typeorm';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { Pays } from '../../../domain/entities/pays.entity';
import { Devise, Langue, StatutPaysLangue } from '../../../domain/entities/devise-et-langue.entity';
import { BlocRegional, TypeBlocRegional } from '../../../domain/entities/bloc-regional.entity';
import {
  PaysBlocRegional,
  PaysDevise,
  PaysLangue,
  StatutAdhesionBlocRegional,
  TauxChange,
} from '../../../domain/entities/relations.entity';
import { Ville } from '../../../domain/entities/ville.entity';
import { Locale, Traduction } from '../../../domain/entities/locale-et-traduction.entity';
import { StatutWorkflow } from '../../../domain/entities/workflow';
import {
  BlocRegionalRepository,
  DeviseRepository,
  LangueRepository,
  PaysBlocRegionalRepository,
  PaysDeviseRepository,
  PaysLangueRepository,
  PaysRepository,
  TauxChangeRepository,
  VilleRepository,
  LocaleRepository,
  TraductionRepository,
} from '../../../domain/repositories/referential.repositories';
import {
  BlocRegionalOrmEntity,
  DeviseOrmEntity,
  LangueOrmEntity,
  PaysBlocRegionalOrmEntity,
  PaysDeviseOrmEntity,
  PaysLangueOrmEntity,
  PaysOrmEntity,
  TauxChangeOrmEntity,
  VilleOrmEntity,
  LocaleOrmEntity,
  TraductionOrmEntity,
} from './orm-entities';

@Injectable()
export class TypeOrmPaysRepository extends TransactionalRepository<PaysOrmEntity> implements PaysRepository {
  constructor(
    @InjectRepository(PaysOrmEntity) repo: Repository<PaysOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Pays | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Pays.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async findByCodeIso(codeIso: string): Promise<Pays | null> {
    const row = await this.repo.findOne({ where: { codeIso: codeIso.toUpperCase() } });
    return row ? Pays.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async existsByCodeIso(codeIso: string): Promise<boolean> {
    const count = await this.repo.count({ where: { codeIso: codeIso.toUpperCase() } });
    return count > 0;
  }

  async list(params: { publieUniquement: boolean }): Promise<Pays[]> {
    const rows = await this.repo.find({
      where: params.publieUniquement ? { statutWorkflow: 'publie', estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => Pays.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }));
  }

  async save(pays: Pays): Promise<void> {
    await this.repo.save(pays.toSnapshot());
  }
}

@Injectable()
export class TypeOrmDeviseRepository extends TransactionalRepository<DeviseOrmEntity> implements DeviseRepository {
  constructor(
    @InjectRepository(DeviseOrmEntity) repo: Repository<DeviseOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Devise | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Devise.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async findByCodeIso4217(codeIso4217: string): Promise<Devise | null> {
    const row = await this.repo.findOne({ where: { codeIso4217: codeIso4217.toUpperCase() } });
    return row ? Devise.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async existsByCodeIso4217(codeIso4217: string): Promise<boolean> {
    const count = await this.repo.count({ where: { codeIso4217: codeIso4217.toUpperCase() } });
    return count > 0;
  }

  async list(params: { publieUniquement: boolean }): Promise<Devise[]> {
    const rows = await this.repo.find({
      where: params.publieUniquement ? { statutWorkflow: 'publie', estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => Devise.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }));
  }

  async save(devise: Devise): Promise<void> {
    await this.repo.save(devise.toSnapshot());
  }
}

@Injectable()
export class TypeOrmLangueRepository extends TransactionalRepository<LangueOrmEntity> implements LangueRepository {
  constructor(
    @InjectRepository(LangueOrmEntity) repo: Repository<LangueOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Langue | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Langue.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async findByCodeIso639(codeIso639: string): Promise<Langue | null> {
    const row = await this.repo.findOne({ where: { codeIso639: codeIso639.toLowerCase() } });
    return row ? Langue.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }) : null;
  }

  async existsByCodeIso639(codeIso639: string): Promise<boolean> {
    const count = await this.repo.count({ where: { codeIso639: codeIso639.toLowerCase() } });
    return count > 0;
  }

  async list(params: { publieUniquement: boolean }): Promise<Langue[]> {
    const rows = await this.repo.find({
      where: params.publieUniquement ? { statutWorkflow: 'publie', estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) => Langue.reconstitute({ ...row, statutWorkflow: row.statutWorkflow as StatutWorkflow }));
  }

  async save(langue: Langue): Promise<void> {
    await this.repo.save(langue.toSnapshot());
  }
}

@Injectable()
export class TypeOrmBlocRegionalRepository
  extends TransactionalRepository<BlocRegionalOrmEntity>
  implements BlocRegionalRepository
{
  constructor(
    @InjectRepository(BlocRegionalOrmEntity) repo: Repository<BlocRegionalOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<BlocRegional | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row
      ? BlocRegional.reconstitute({
          ...row,
          type: row.type as TypeBlocRegional,
          statutWorkflow: row.statutWorkflow as StatutWorkflow,
        })
      : null;
  }

  async findByCode(code: string): Promise<BlocRegional | null> {
    const row = await this.repo.findOne({ where: { code: code.toUpperCase() } });
    return row
      ? BlocRegional.reconstitute({
          ...row,
          type: row.type as TypeBlocRegional,
          statutWorkflow: row.statutWorkflow as StatutWorkflow,
        })
      : null;
  }

  async existsByCode(code: string): Promise<boolean> {
    const count = await this.repo.count({ where: { code: code.toUpperCase() } });
    return count > 0;
  }

  async list(params: { publieUniquement: boolean }): Promise<BlocRegional[]> {
    const rows = await this.repo.find({
      where: params.publieUniquement ? { statutWorkflow: 'publie', estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map((row) =>
      BlocRegional.reconstitute({
        ...row,
        type: row.type as TypeBlocRegional,
        statutWorkflow: row.statutWorkflow as StatutWorkflow,
      }),
    );
  }

  async save(blocRegional: BlocRegional): Promise<void> {
    await this.repo.save(blocRegional.toSnapshot());
  }
}

@Injectable()
export class TypeOrmPaysDeviseRepository
  extends TransactionalRepository<PaysDeviseOrmEntity>
  implements PaysDeviseRepository
{
  constructor(
    @InjectRepository(PaysDeviseOrmEntity) repo: Repository<PaysDeviseOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<PaysDevise | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? PaysDevise.reconstitute(row) : null;
  }

  async findByPays(paysId: string): Promise<PaysDevise[]> {
    const rows = await this.repo.find({ where: { paysId } });
    return rows.map((row) => PaysDevise.reconstitute(row));
  }

  async findPrincipaleActive(paysId: string, atDate: Date): Promise<PaysDevise | null> {
    const row = await this.repo.findOne({
      where: [
        { paysId, devisePrincipale: true, dateDebut: LessThanOrEqual(atDate), dateFin: IsNull() },
        {
          paysId,
          devisePrincipale: true,
          dateDebut: LessThanOrEqual(atDate),
          dateFin: MoreThanOrEqual(atDate),
        },
      ],
    });
    return row ? PaysDevise.reconstitute(row) : null;
  }

  async save(relation: PaysDevise): Promise<void> {
    await this.repo.save(relation.toSnapshot());
  }
}

@Injectable()
export class TypeOrmPaysLangueRepository
  extends TransactionalRepository<PaysLangueOrmEntity>
  implements PaysLangueRepository
{
  constructor(
    @InjectRepository(PaysLangueOrmEntity) repo: Repository<PaysLangueOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByPays(paysId: string): Promise<PaysLangue[]> {
    const rows = await this.repo.find({ where: { paysId }, order: { ordre: 'ASC' } });
    return rows.map((row) => PaysLangue.reconstitute({ ...row, statut: row.statut as StatutPaysLangue }));
  }

  async save(relation: PaysLangue): Promise<void> {
    await this.repo.save(relation.toSnapshot());
  }
}

@Injectable()
export class TypeOrmPaysBlocRegionalRepository
  extends TransactionalRepository<PaysBlocRegionalOrmEntity>
  implements PaysBlocRegionalRepository
{
  constructor(
    @InjectRepository(PaysBlocRegionalOrmEntity) repo: Repository<PaysBlocRegionalOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<PaysBlocRegional | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row
      ? PaysBlocRegional.reconstitute({ ...row, statutActuel: row.statutActuel as StatutAdhesionBlocRegional })
      : null;
  }

  async findByPays(paysId: string): Promise<PaysBlocRegional[]> {
    const rows = await this.repo.find({ where: { paysId } });
    return rows.map((row) =>
      PaysBlocRegional.reconstitute({ ...row, statutActuel: row.statutActuel as StatutAdhesionBlocRegional }),
    );
  }

  async findByBlocRegional(blocRegionalId: string): Promise<PaysBlocRegional[]> {
    const rows = await this.repo.find({ where: { blocRegionalId } });
    return rows.map((row) =>
      PaysBlocRegional.reconstitute({ ...row, statutActuel: row.statutActuel as StatutAdhesionBlocRegional }),
    );
  }

  async save(relation: PaysBlocRegional): Promise<void> {
    await this.repo.save(relation.toSnapshot());
  }
}

@Injectable()
export class TypeOrmTauxChangeRepository
  extends TransactionalRepository<TauxChangeOrmEntity>
  implements TauxChangeRepository
{
  constructor(
    @InjectRepository(TauxChangeOrmEntity) repo: Repository<TauxChangeOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<TauxChange | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? TauxChange.reconstitute(row) : null;
  }

  async findByPaire(deviseBaseId: string, deviseCibleId: string): Promise<TauxChange[]> {
    const rows = await this.repo.find({
      where: { deviseBaseId, deviseCibleId },
      order: { validDu: 'DESC' },
    });
    return rows.map((row) => TauxChange.reconstitute(row));
  }

  async save(tauxChange: TauxChange): Promise<void> {
    await this.repo.save(tauxChange.toSnapshot());
  }
}

@Injectable()
export class TypeOrmVilleRepository extends TransactionalRepository<VilleOrmEntity> implements VilleRepository {
  constructor(
    @InjectRepository(VilleOrmEntity) repo: Repository<VilleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Ville | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Ville.reconstitute(row) : null;
  }

  async findByPays(paysId: string): Promise<Ville[]> {
    const rows = await this.repo.find({ where: { paysId }, order: { nom: 'ASC' } });
    return rows.map((row) => Ville.reconstitute(row));
  }

  async save(ville: Ville): Promise<void> {
    await this.repo.save(ville.toSnapshot());
  }
}

@Injectable()
export class TypeOrmLocaleRepository extends TransactionalRepository<LocaleOrmEntity> implements LocaleRepository {
  constructor(
    @InjectRepository(LocaleOrmEntity) repo: Repository<LocaleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Locale | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Locale.reconstitute(row) : null;
  }

  async findByCode(code: string): Promise<Locale | null> {
    const row = await this.repo.findOne({ where: { code } });
    return row ? Locale.reconstitute(row) : null;
  }

  async findParDefaut(): Promise<Locale | null> {
    const row = await this.repo.findOne({ where: { estParDefaut: true } });
    return row ? Locale.reconstitute(row) : null;
  }

  async existsByCode(code: string): Promise<boolean> {
    const count = await this.repo.count({ where: { code } });
    return count > 0;
  }

  async list(params: { activesUniquement: boolean }): Promise<Locale[]> {
    const rows = await this.repo.find({
      where: params.activesUniquement ? { estActif: true } : {},
      order: { code: 'ASC' },
    });
    return rows.map((row) => Locale.reconstitute(row));
  }

  async save(locale: Locale): Promise<void> {
    await this.repo.save(locale.toSnapshot());
  }
}

@Injectable()
export class TypeOrmTraductionRepository
  extends TransactionalRepository<TraductionOrmEntity>
  implements TraductionRepository
{
  constructor(
    @InjectRepository(TraductionOrmEntity) repo: Repository<TraductionOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Traduction | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Traduction.reconstitute(row) : null;
  }

  async findByLocaleAndCle(localeId: string, cle: string): Promise<Traduction | null> {
    const row = await this.repo.findOne({ where: { localeId, cle } });
    return row ? Traduction.reconstitute(row) : null;
  }

  async findByLocale(localeId: string): Promise<Traduction[]> {
    const rows = await this.repo.find({ where: { localeId }, order: { cle: 'ASC' } });
    return rows.map((row) => Traduction.reconstitute(row));
  }

  async save(traduction: Traduction): Promise<void> {
    await this.repo.save(traduction.toSnapshot());
  }
}
