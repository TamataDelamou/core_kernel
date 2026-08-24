import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { Email } from '../../../../common/value-objects/email.vo';
import { PhoneE164 } from '../../../../common/value-objects/phone-e164.vo';
import { User } from '../../../domain/entities/user.entity';
import {
  ExternalIdentityMapping,
  MfaFactor,
  RefreshToken,
  Role,
  UserRoleAssignment,
} from '../../../domain/entities/rbac-and-tokens.entity';
import {
  ExternalIdentityMappingRepository,
  MfaFactorRepository,
  RefreshTokenRepository,
  RoleRepository,
  UserRepository,
  UserRoleAssignmentRepository,
} from '../../../domain/repositories/identity.repositories';
import {
  ExternalIdentityMappingOrmEntity,
  MfaFactorOrmEntity,
  RefreshTokenOrmEntity,
  RoleOrmEntity,
  UserOrmEntity,
  UserRoleAssignmentOrmEntity,
} from './orm-entities';

function toDomainUser(row: UserOrmEntity): User {
  return User.reconstitute({
    gsgId: row.gsgId,
    email: row.email ? Email.create(row.email) : null,
    emailVerifie: row.emailVerifie,
    phone: row.phone ? PhoneE164.create(row.phone) : null,
    phoneVerifie: row.phoneVerifie,
    passwordHash: row.passwordHash,
    nomAffichage: row.nomAffichage,
    statut: row.statut as User['statut'],
    mfaActive: row.mfaActive,
    referentiel: {
      paysId: row.paysId,
      uniteAdministrativeId: row.uniteAdministrativeId,
      villeId: row.villeId,
      langueId: row.langueId,
      deviseId: row.deviseId,
      fuseauHoraire: row.fuseauHoraire,
    },
    creeLe: row.creeLe,
    modifieLe: row.modifieLe,
    dernierAuthLe: row.dernierAuthLe,
    tentativesEchoueesConsecutives: row.tentativesEchoueesConsecutives,
    verrouilleJusqua: row.verrouilleJusqua,
  });
}

function toOrmUser(user: User): UserOrmEntity {
  const snapshot = user.toSnapshot();
  const row = new UserOrmEntity();
  row.gsgId = snapshot.gsgId;
  row.email = snapshot.email ? snapshot.email.toString() : null;
  row.emailVerifie = snapshot.emailVerifie;
  row.phone = snapshot.phone ? snapshot.phone.toString() : null;
  row.phoneVerifie = snapshot.phoneVerifie;
  row.passwordHash = snapshot.passwordHash;
  row.nomAffichage = snapshot.nomAffichage;
  row.statut = snapshot.statut;
  row.mfaActive = snapshot.mfaActive;
  row.paysId = snapshot.referentiel.paysId;
  row.uniteAdministrativeId = snapshot.referentiel.uniteAdministrativeId;
  row.villeId = snapshot.referentiel.villeId;
  row.langueId = snapshot.referentiel.langueId;
  row.deviseId = snapshot.referentiel.deviseId;
  row.fuseauHoraire = snapshot.referentiel.fuseauHoraire;
  row.creeLe = snapshot.creeLe;
  row.modifieLe = snapshot.modifieLe;
  row.dernierAuthLe = snapshot.dernierAuthLe;
  row.tentativesEchoueesConsecutives = snapshot.tentativesEchoueesConsecutives;
  row.verrouilleJusqua = snapshot.verrouilleJusqua;
  return row;
}

@Injectable()
export class TypeOrmUserRepository extends TransactionalRepository<UserOrmEntity> implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity) repo: Repository<UserOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByGsgId(gsgId: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { gsgId } });
    return row ? toDomainUser(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email: email.toString() } });
    return row ? toDomainUser(row) : null;
  }

  async findByPhone(phone: PhoneE164): Promise<User | null> {
    const row = await this.repo.findOne({ where: { phone: phone.toString() } });
    return row ? toDomainUser(row) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.repo.count({ where: { email: email.toString() } });
    return count > 0;
  }

  async save(user: User): Promise<void> {
    await this.repo.save(toOrmUser(user));
  }
}

@Injectable()
export class TypeOrmRoleRepository extends TransactionalRepository<RoleOrmEntity> implements RoleRepository {
  constructor(
    @InjectRepository(RoleOrmEntity) repo: Repository<RoleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Role | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Role.reconstitute(row) : null;
  }

  async findByCode(code: string, gsgOrgId: string | null): Promise<Role | null> {
    const row = await this.repo.findOne({ where: { code, gsgOrgId: gsgOrgId ?? undefined } });
    return row ? Role.reconstitute(row) : null;
  }

  async save(role: Role): Promise<void> {
    await this.repo.save(role.toSnapshot());
  }
}

@Injectable()
export class TypeOrmUserRoleAssignmentRepository
  extends TransactionalRepository<UserRoleAssignmentOrmEntity>
  implements UserRoleAssignmentRepository
{
  constructor(
    @InjectRepository(UserRoleAssignmentOrmEntity) repo: Repository<UserRoleAssignmentOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByUser(gsgId: string): Promise<UserRoleAssignment[]> {
    const rows = await this.repo.find({ where: { gsgId } });
    return rows.map((row) => UserRoleAssignment.reconstitute(row));
  }

  async save(assignment: UserRoleAssignment): Promise<void> {
    await this.repo.save(assignment.toSnapshot());
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}

@Injectable()
export class TypeOrmRefreshTokenRepository
  extends TransactionalRepository<RefreshTokenOrmEntity>
  implements RefreshTokenRepository
{
  constructor(
    @InjectRepository(RefreshTokenOrmEntity) repo: Repository<RefreshTokenOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<RefreshToken | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? RefreshToken.reconstitute(row) : null;
  }

  async findActiveFamilyMembers(familyId: string): Promise<RefreshToken[]> {
    const rows = await this.repo.find({ where: { familyId } });
    return rows.map((row) => RefreshToken.reconstitute(row));
  }

  async save(token: RefreshToken): Promise<void> {
    await this.repo.save(token.toSnapshot());
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update({ familyId }, { revoqueLe: new Date() });
  }
}

@Injectable()
export class TypeOrmMfaFactorRepository
  extends TransactionalRepository<MfaFactorOrmEntity>
  implements MfaFactorRepository
{
  constructor(
    @InjectRepository(MfaFactorOrmEntity) repo: Repository<MfaFactorOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findActiveByUser(gsgId: string): Promise<MfaFactor | null> {
    const row = await this.repo.findOne({ where: { gsgId, statut: 'actif' } });
    return row ? MfaFactor.reconstitute(row as MfaFactorOrmEntity & { type: 'totp' }) : null;
  }

  async findById(id: string): Promise<MfaFactor | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? MfaFactor.reconstitute(row as MfaFactorOrmEntity & { type: 'totp' }) : null;
  }

  async save(factor: MfaFactor): Promise<void> {
    await this.repo.save(factor.toSnapshot());
  }
}

@Injectable()
export class TypeOrmExternalIdentityMappingRepository
  extends TransactionalRepository<ExternalIdentityMappingOrmEntity>
  implements ExternalIdentityMappingRepository
{
  constructor(
    @InjectRepository(ExternalIdentityMappingOrmEntity) repo: Repository<ExternalIdentityMappingOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findByProduitAndExternalId(
    produitId: string,
    externalUserId: string,
  ): Promise<ExternalIdentityMapping | null> {
    const row = await this.repo.findOne({ where: { produitId, externalUserId } });
    return row ? ExternalIdentityMapping.reconstitute(row) : null;
  }

  async findByUserAndProduit(gsgId: string, produitId: string): Promise<ExternalIdentityMapping | null> {
    const row = await this.repo.findOne({ where: { gsgId, produitId } });
    return row ? ExternalIdentityMapping.reconstitute(row) : null;
  }

  async save(mapping: ExternalIdentityMapping): Promise<void> {
    await this.repo.save(mapping.toSnapshot());
  }
}
