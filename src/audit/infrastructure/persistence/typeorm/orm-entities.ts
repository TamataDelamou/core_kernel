import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'audit_evenement' })
export class AuditEvenementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'evenement_id', type: 'uuid' })
  evenementId!: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  type!: string;

  @Index()
  @Column({ name: 'gsg_org_id', type: 'uuid', nullable: true })
  gsgOrgId!: string | null;

  @Column({ name: 'produit_source', type: 'varchar', length: 100 })
  produitSource!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  horodatage!: Date;

  @Column({ name: 'charge_utile', type: 'jsonb' })
  chargeUtile!: Record<string, unknown>;

  @Column({ name: 'traite_le', type: 'timestamptz' })
  traiteLe!: Date;
}

@Entity({ name: 'evenement_en_echec' })
export class EvenementEnEchecOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'evenement_id', type: 'uuid' })
  evenementId!: string;

  @Column({ type: 'varchar', length: 150 })
  type!: string;

  @Column({ name: 'gsg_org_id', type: 'uuid', nullable: true })
  gsgOrgId!: string | null;

  @Column({ name: 'produit_source', type: 'varchar', length: 100 })
  produitSource!: string;

  @Column({ type: 'timestamptz' })
  horodatage!: Date;

  @Column({ name: 'charge_utile', type: 'jsonb' })
  chargeUtile!: Record<string, unknown>;

  @Column({ type: 'int' })
  tentatives!: number;

  @Column({ name: 'derniere_erreur', type: 'text' })
  derniereErreur!: string;

  @Column({ name: 'mis_en_echec_le', type: 'timestamptz' })
  misEnEchecLe!: Date;

  @Column({ name: 'rejoue_le', type: 'timestamptz', nullable: true })
  rejoueLe!: Date | null;
}
