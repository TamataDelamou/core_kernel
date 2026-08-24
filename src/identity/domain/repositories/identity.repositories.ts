import { User } from '../entities/user.entity';
import { Email } from '../../../common/value-objects/email.vo';
import { PhoneE164 } from '../../../common/value-objects/phone-e164.vo';
import {
  ExternalIdentityMapping,
  MfaFactor,
  RefreshToken,
  Role,
  UserRoleAssignment,
} from '../entities/rbac-and-tokens.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findByGsgId(gsgId: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findByPhone(phone: PhoneE164): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: User): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export interface RoleRepository {
  findById(id: string): Promise<Role | null>;
  findByCode(code: string, gsgOrgId: string | null): Promise<Role | null>;
  save(role: Role): Promise<void>;
}

export const USER_ROLE_ASSIGNMENT_REPOSITORY = Symbol('USER_ROLE_ASSIGNMENT_REPOSITORY');

export interface UserRoleAssignmentRepository {
  findByUser(gsgId: string): Promise<UserRoleAssignment[]>;
  save(assignment: UserRoleAssignment): Promise<void>;
  delete(id: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  findById(id: string): Promise<RefreshToken | null>;
  findActiveFamilyMembers(familyId: string): Promise<RefreshToken[]>;
  save(token: RefreshToken): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
}

export const MFA_FACTOR_REPOSITORY = Symbol('MFA_FACTOR_REPOSITORY');

export interface MfaFactorRepository {
  findActiveByUser(gsgId: string): Promise<MfaFactor | null>;
  findById(id: string): Promise<MfaFactor | null>;
  save(factor: MfaFactor): Promise<void>;
}

export const EXTERNAL_IDENTITY_MAPPING_REPOSITORY = Symbol('EXTERNAL_IDENTITY_MAPPING_REPOSITORY');

export interface ExternalIdentityMappingRepository {
  findByProduitAndExternalId(
    produitId: string,
    externalUserId: string,
  ): Promise<ExternalIdentityMapping | null>;
  findByUserAndProduit(gsgId: string, produitId: string): Promise<ExternalIdentityMapping | null>;
  save(mapping: ExternalIdentityMapping): Promise<void>;
}
