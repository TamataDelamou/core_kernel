import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';
import { Organisation } from '../../../domain/entities/organisation.entity';
import { UniteOperationnelle } from '../../../domain/entities/unite-operationnelle.entity';
import {
  AbonnementProduit,
  StatutAbonnement,
} from '../../../domain/entities/abonnement-produit.entity';
import {
  AbonnementProduitRepository,
  OrganisationRepository,
  UniteOperationnelleRepository,
} from '../../../domain/repositories/org.repositories';
import {
  AbonnementProduitOrmEntity,
  OrganisationOrmEntity,
  UniteOperationnelleOrmEntity,
} from './orm-entities';

function toDomainOrganisation(row: OrganisationOrmEntity): Organisation {
  return Organisation.reconstitute({
    id: row.id,
    nom: row.nom,
    organisationMereId: row.organisationMereId,
    referentiel: {
      paysId: row.paysId,
      uniteAdministrativeId: row.uniteAdministrativeId,
      villeId: row.villeId,
      deviseId: row.deviseId,
      langueId: row.langueId,
      fuseauHoraire: row.fuseauHoraire,
    },
    estActif: row.estActif,
    creeLe: row.creeLe,
    modifieLe: row.modifieLe,
  });
}

function toOrmOrganisation(organisation: Organisation): OrganisationOrmEntity {
  const snapshot = organisation.toSnapshot();
  const row = new OrganisationOrmEntity();
  row.id = snapshot.id;
  row.nom = snapshot.nom;
  row.organisationMereId = snapshot.organisationMereId;
  row.paysId = snapshot.referentiel.paysId;
  row.uniteAdministrativeId = snapshot.referentiel.uniteAdministrativeId;
  row.villeId = snapshot.referentiel.villeId;
  row.deviseId = snapshot.referentiel.deviseId;
  row.langueId = snapshot.referentiel.langueId;
  row.fuseauHoraire = snapshot.referentiel.fuseauHoraire;
  row.estActif = snapshot.estActif;
  row.creeLe = snapshot.creeLe;
  row.modifieLe = snapshot.modifieLe;
  return row;
}

@Injectable()
export class TypeOrmOrganisationRepository
  extends TransactionalRepository<OrganisationOrmEntity>
  implements OrganisationRepository
{
  constructor(
    @InjectRepository(OrganisationOrmEntity) repo: Repository<OrganisationOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<Organisation | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? toDomainOrganisation(row) : null;
  }

  async findByOrganisationMere(organisationMereId: string): Promise<Organisation[]> {
    const rows = await this.repo.find({ where: { organisationMereId } });
    return rows.map(toDomainOrganisation);
  }

  async list(params: { activesUniquement: boolean }): Promise<Organisation[]> {
    const rows = await this.repo.find({
      where: params.activesUniquement ? { estActif: true } : {},
      order: { nom: 'ASC' },
    });
    return rows.map(toDomainOrganisation);
  }

  async save(organisation: Organisation): Promise<void> {
    await this.repo.save(toOrmOrganisation(organisation));
  }

  /**
   * Remonte la chaîne de filiation de `organisationId` jusqu'à la racine (ou jusqu'à
   * `candidateAncestorId`) pour détecter si un rattachement créerait un cycle. Coût borné
   * par la profondeur de l'arbre — négligeable pour une hiérarchie d'organisations clientes,
   * qui ne dépasse jamais quelques niveaux en pratique (maison mère → filiale → sous-filiale).
   */
  async isDescendantOf(candidateAncestorId: string, organisationId: string): Promise<boolean> {
    let current: string | null = organisationId;
    const visited = new Set<string>();

    while (current) {
      if (current === candidateAncestorId) return true;
      if (visited.has(current)) return false; // garde-fou anti-boucle infinie sur données corrompues
      visited.add(current);

      const row: Pick<OrganisationOrmEntity, 'organisationMereId'> | null = await this.repo.findOne({
        where: { id: current },
        select: ['organisationMereId'],
      });
      current = row?.organisationMereId ?? null;
    }

    return false;
  }
}

@Injectable()
export class TypeOrmUniteOperationnelleRepository
  extends TransactionalRepository<UniteOperationnelleOrmEntity>
  implements UniteOperationnelleRepository
{
  constructor(
    @InjectRepository(UniteOperationnelleOrmEntity) repo: Repository<UniteOperationnelleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<UniteOperationnelle | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? UniteOperationnelle.reconstitute(this.toDomainProps(row)) : null;
  }

  async findByOrganisation(organisationId: string): Promise<UniteOperationnelle[]> {
    const rows = await this.repo.find({ where: { organisationId }, order: { nom: 'ASC' } });
    return rows.map((row) => UniteOperationnelle.reconstitute(this.toDomainProps(row)));
  }

  async save(unite: UniteOperationnelle): Promise<void> {
    const snapshot = unite.toSnapshot();
    const row = new UniteOperationnelleOrmEntity();
    row.id = snapshot.id;
    row.organisationId = snapshot.organisationId;
    row.nom = snapshot.nom;
    row.paysId = snapshot.referentiel.paysId;
    row.uniteAdministrativeId = snapshot.referentiel.uniteAdministrativeId;
    row.villeId = snapshot.referentiel.villeId;
    row.deviseId = snapshot.referentiel.deviseId;
    row.langueId = snapshot.referentiel.langueId;
    row.fuseauHoraire = snapshot.referentiel.fuseauHoraire;
    row.estActif = snapshot.estActif;
    row.creeLe = snapshot.creeLe;
    row.modifieLe = snapshot.modifieLe;
    await this.repo.save(row);
  }

  private toDomainProps(row: UniteOperationnelleOrmEntity) {
    return {
      id: row.id,
      organisationId: row.organisationId,
      nom: row.nom,
      referentiel: {
        paysId: row.paysId,
        uniteAdministrativeId: row.uniteAdministrativeId,
        villeId: row.villeId,
        deviseId: row.deviseId,
        langueId: row.langueId,
        fuseauHoraire: row.fuseauHoraire,
      },
      estActif: row.estActif,
      creeLe: row.creeLe,
      modifieLe: row.modifieLe,
    };
  }
}

@Injectable()
export class TypeOrmAbonnementProduitRepository
  extends TransactionalRepository<AbonnementProduitOrmEntity>
  implements AbonnementProduitRepository
{
  constructor(
    @InjectRepository(AbonnementProduitOrmEntity) repo: Repository<AbonnementProduitOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<AbonnementProduit | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row
      ? AbonnementProduit.reconstitute({ ...row, statut: row.statut as StatutAbonnement })
      : null;
  }

  async findByOrganisation(organisationId: string): Promise<AbonnementProduit[]> {
    const rows = await this.repo.find({ where: { organisationId } });
    return rows.map((row) => AbonnementProduit.reconstitute({ ...row, statut: row.statut as StatutAbonnement }));
  }

  async findByOrganisationAndProduit(
    organisationId: string,
    produitId: string,
  ): Promise<AbonnementProduit | null> {
    const row = await this.repo.findOne({ where: { organisationId, produitId } });
    return row
      ? AbonnementProduit.reconstitute({ ...row, statut: row.statut as StatutAbonnement })
      : null;
  }

  async save(abonnement: AbonnementProduit): Promise<void> {
    await this.repo.save(abonnement.toSnapshot());
  }
}
