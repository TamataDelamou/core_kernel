import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NiveauAdministratif } from '../../../domain/entities/niveau-administratif.entity';
import { NoeudHierarchique } from '../../../domain/entities/noeud-hierarchique.entity';
import { StatutWorkflowEngine } from '../../../domain/entities/workflow';
import { ReferentielRegle } from '../../../domain/entities/referentiel-regle.entity';
import { CorpusVersionne } from '../../../domain/entities/corpus-versionne.entity';
import { CorpusElement } from '../../../domain/entities/corpus-element.entity';
import { StatutCorpusWorkflow } from '../../../domain/entities/corpus-workflow';
import { MetadonneesGouvernance, StatutConfiance } from '../../../domain/entities/gouvernance';
import {
  CompteurVillesRattacheesRepository,
  CorpusElementRepository,
  CorpusVersionneRepository,
  NiveauAdministratifRepository,
  NoeudHierarchiqueRepository,
  ReferentielRegleRepository,
} from '../../../domain/repositories/referential-engine.repositories';
import {
  CompteurVillesRattacheesOrmEntity,
  CorpusElementOrmEntity,
  CorpusVersionneOrmEntity,
  NiveauAdministratifOrmEntity,
  NoeudHierarchiqueOrmEntity,
  ReferentielRegleOrmEntity,
} from './orm-entities';
import { TransactionalRepository } from '../../../../common/kernel-infrastructure/persistence/transactional-repository.base';
import { TransactionContextService } from '../../../../common/kernel-infrastructure/persistence/transaction-context.service';

@Injectable()
export class TypeOrmNiveauAdministratifRepository
  extends TransactionalRepository<NiveauAdministratifOrmEntity>
  implements NiveauAdministratifRepository
{
  constructor(
    @InjectRepository(NiveauAdministratifOrmEntity) repo: Repository<NiveauAdministratifOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<NiveauAdministratif | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? NiveauAdministratif.reconstitute(row) : null;
  }

  async findByPaysAndRang(paysId: string, rang: number): Promise<NiveauAdministratif | null> {
    const row = await this.repo.findOne({ where: { paysId, rang } });
    return row ? NiveauAdministratif.reconstitute(row) : null;
  }

  async findByPays(paysId: string): Promise<NiveauAdministratif[]> {
    const rows = await this.repo.find({ where: { paysId }, order: { rang: 'ASC' } });
    return rows.map((row) => NiveauAdministratif.reconstitute(row));
  }

  async save(niveau: NiveauAdministratif): Promise<void> {
    await this.repo.save(niveau.toSnapshot());
  }
}

@Injectable()
export class TypeOrmNoeudHierarchiqueRepository
  extends TransactionalRepository<NoeudHierarchiqueOrmEntity>
  implements NoeudHierarchiqueRepository
{
  constructor(
    @InjectRepository(NoeudHierarchiqueOrmEntity) repo: Repository<NoeudHierarchiqueOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<NoeudHierarchique | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findChildren(parentId: string): Promise<NoeudHierarchique[]> {
    const rows = await this.repo.find({ where: { parentId }, order: { ordre: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findDescendants(chemin: string): Promise<NoeudHierarchique[]> {
    // Le nœud lui-même vérifie aussi `chemin LIKE chemin || '%'` (préfixe de lui-même) —
    // exclu explicitement par comparaison stricte d'inégalité, jamais par un décalage
    // arbitraire de longueur de chaîne.
    const rows = await this.repo
      .createQueryBuilder('noeud')
      .where('noeud.chemin LIKE :prefix', { prefix: `${chemin}%` })
      .andWhere('noeud.chemin != :chemin', { chemin })
      .orderBy('noeud.chemin', 'ASC')
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async findByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<NoeudHierarchique[]> {
    const rows = await this.repo.find({
      where: { paysId, codeDomaine },
      order: { chemin: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(noeud: NoeudHierarchique): Promise<void> {
    await this.repo.save(noeud.toSnapshot());
  }

  private toDomain(row: NoeudHierarchiqueOrmEntity): NoeudHierarchique {
    return NoeudHierarchique.reconstitute({
      ...row,
      statutWorkflow: row.statutWorkflow as StatutWorkflowEngine,
    });
  }
}

@Injectable()
export class TypeOrmReferentielRegleRepository
  extends TransactionalRepository<ReferentielRegleOrmEntity>
  implements ReferentielRegleRepository
{
  constructor(
    @InjectRepository(ReferentielRegleOrmEntity) repo: Repository<ReferentielRegleOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<ReferentielRegle | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByNoeud(referentielHierarchiqueId: string): Promise<ReferentielRegle[]> {
    const rows = await this.repo.find({ where: { referentielHierarchiqueId } });
    return rows.map((row) => this.toDomain(row));
  }

  async findPublieesEtVerifieesByNoeud(referentielHierarchiqueId: string): Promise<ReferentielRegle[]> {
    const rows = await this.repo
      .createQueryBuilder('regle')
      .where('regle.referentiel_hierarchique_id = :id', { id: referentielHierarchiqueId })
      .andWhere('regle.statut_workflow = :publie', { publie: 'publie' })
      .andWhere('regle.est_actif = true')
      .andWhere('regle.statut_confiance != :aVerifier', { aVerifier: 'A_VERIFIER' })
      .getMany();
    return rows.map((row) => this.toDomain(row));
  }

  async save(regle: ReferentielRegle): Promise<void> {
    const snapshot = regle.toSnapshot();
    const gouvernance = snapshot.gouvernance.toSnapshot();
    await this.repo.save({
      id: snapshot.id,
      referentielHierarchiqueId: snapshot.referentielHierarchiqueId,
      codeDomaine: snapshot.codeDomaine,
      nom: snapshot.nom,
      sigle: snapshot.sigle,
      valeur: snapshot.valeur,
      metadata: snapshot.metadata,
      organismeCertificateur: gouvernance.organismeCertificateur,
      statutConfiance: gouvernance.statutConfiance,
      source: gouvernance.source,
      dateDerniereVerification: gouvernance.dateDerniereVerification,
      statutWorkflow: snapshot.statutWorkflow,
      estActif: snapshot.estActif,
      creeLe: snapshot.creeLe,
      modifieLe: snapshot.modifieLe,
    });
  }

  private toDomain(row: ReferentielRegleOrmEntity): ReferentielRegle {
    return ReferentielRegle.reconstitute({
      id: row.id,
      referentielHierarchiqueId: row.referentielHierarchiqueId,
      codeDomaine: row.codeDomaine,
      nom: row.nom,
      sigle: row.sigle,
      valeur: row.valeur,
      metadata: row.metadata,
      gouvernance: MetadonneesGouvernance.reconstitute({
        organismeCertificateur: row.organismeCertificateur,
        statutConfiance: row.statutConfiance as StatutConfiance,
        source: row.source,
        dateDerniereVerification: row.dateDerniereVerification,
      }),
      statutWorkflow: row.statutWorkflow as StatutWorkflowEngine,
      estActif: row.estActif,
      creeLe: row.creeLe,
      modifieLe: row.modifieLe,
    });
  }
}

@Injectable()
export class TypeOrmCorpusVersionneRepository
  extends TransactionalRepository<CorpusVersionneOrmEntity>
  implements CorpusVersionneRepository
{
  constructor(
    @InjectRepository(CorpusVersionneOrmEntity) repo: Repository<CorpusVersionneOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<CorpusVersionne | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<CorpusVersionne[]> {
    const rows = await this.repo.find({ where: { paysId, codeDomaine }, order: { creeLe: 'DESC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findPublieByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<CorpusVersionne | null> {
    const row = await this.repo.findOne({
      where: { paysId, codeDomaine, statut: 'publie' },
      order: { datePublication: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(corpus: CorpusVersionne): Promise<void> {
    const snapshot = corpus.toSnapshot();
    const gouvernance = snapshot.gouvernance.toSnapshot();
    await this.repo.save({
      id: snapshot.id,
      paysId: snapshot.paysId,
      codeDomaine: snapshot.codeDomaine,
      libelleVersion: snapshot.libelleVersion,
      statut: snapshot.statut,
      datePublication: snapshot.datePublication,
      organismeCertificateur: gouvernance.organismeCertificateur,
      statutConfiance: gouvernance.statutConfiance,
      source: gouvernance.source,
      dateDerniereVerification: gouvernance.dateDerniereVerification,
      creeLe: snapshot.creeLe,
      modifieLe: snapshot.modifieLe,
    });
  }

  private toDomain(row: CorpusVersionneOrmEntity): CorpusVersionne {
    return CorpusVersionne.reconstitute({
      id: row.id,
      paysId: row.paysId,
      codeDomaine: row.codeDomaine,
      libelleVersion: row.libelleVersion,
      statut: row.statut as StatutCorpusWorkflow,
      datePublication: row.datePublication,
      gouvernance: MetadonneesGouvernance.reconstitute({
        organismeCertificateur: row.organismeCertificateur,
        statutConfiance: row.statutConfiance as StatutConfiance,
        source: row.source,
        dateDerniereVerification: row.dateDerniereVerification,
      }),
      creeLe: row.creeLe,
      modifieLe: row.modifieLe,
    });
  }
}

@Injectable()
export class TypeOrmCorpusElementRepository
  extends TransactionalRepository<CorpusElementOrmEntity>
  implements CorpusElementRepository
{
  constructor(
    @InjectRepository(CorpusElementOrmEntity) repo: Repository<CorpusElementOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async findById(id: string): Promise<CorpusElement | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? CorpusElement.reconstitute(row) : null;
  }

  async findByCorpusVersionne(corpusVersionneId: string): Promise<CorpusElement[]> {
    const rows = await this.repo.find({ where: { corpusVersionneId }, order: { ordre: 'ASC' } });
    return rows.map((row) => CorpusElement.reconstitute(row));
  }

  async findChildren(parentId: string): Promise<CorpusElement[]> {
    const rows = await this.repo.find({ where: { parentId }, order: { ordre: 'ASC' } });
    return rows.map((row) => CorpusElement.reconstitute(row));
  }

  async save(element: CorpusElement): Promise<void> {
    await this.repo.save(element.toSnapshot());
  }
}

/**
 * KER-ADM-04, volet villes : upsert atomique via SQL brut (`ON CONFLICT`) plutôt qu'un
 * "lire, incrémenter en mémoire, réécrire" — deux messages Redis traités concurremment sur
 * le même nœud (deux villes créées dans le même nœud à quelques millisecondes d'écart) ne
 * doivent jamais se marcher dessus. `GREATEST(..., 0)` empêche tout compteur négatif même en
 * cas de dérive (ex. `VILLE_MOVED` reçu sans le `VILLE_CREATED` correspondant, cas limite
 * acceptable pour une table d'indexation eventually-consistent, jamais une source de vérité).
 */
@Injectable()
export class TypeOrmCompteurVillesRattacheesRepository
  extends TransactionalRepository<CompteurVillesRattacheesOrmEntity>
  implements CompteurVillesRattacheesRepository
{
  constructor(
    @InjectRepository(CompteurVillesRattacheesOrmEntity) repo: Repository<CompteurVillesRattacheesOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }

  async getCompte(noeudId: string): Promise<number> {
    const row = await this.repo.findOne({ where: { noeudId } });
    return row?.nombreVilles ?? 0;
  }

  async incrementer(noeudId: string): Promise<void> {
    await this.repo.manager.query(
      `INSERT INTO "compteur_villes_rattachees" ("noeud_id", "nombre_villes", "modifie_le")
       VALUES ($1, 1, now())
       ON CONFLICT ("noeud_id") DO UPDATE SET
         "nombre_villes" = "compteur_villes_rattachees"."nombre_villes" + 1,
         "modifie_le" = now()`,
      [noeudId],
    );
  }

  async decrementer(noeudId: string): Promise<void> {
    await this.repo.manager.query(
      `INSERT INTO "compteur_villes_rattachees" ("noeud_id", "nombre_villes", "modifie_le")
       VALUES ($1, 0, now())
       ON CONFLICT ("noeud_id") DO UPDATE SET
         "nombre_villes" = GREATEST("compteur_villes_rattachees"."nombre_villes" - 1, 0),
         "modifie_le" = now()`,
      [noeudId],
    );
  }
}
