import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'produit_portefeuille' })
export class ProduitPortefeuilleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  nom!: string;

  @Column({ name: 'briques_consommees', type: 'jsonb', default: () => "'[]'" })
  briquesConsommees!: string[];

  @Column({ name: 'est_actif', type: 'boolean', default: true })
  estActif!: boolean;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}

@Entity({ name: 'produit_pays_deploiement' })
@Index(['produitId', 'paysId'], { unique: true })
export class ProduitPaysDeploiementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ name: 'produit_id', type: 'uuid' })
  produitId!: string;

  @Index()
  @Column({ name: 'pays_id', type: 'uuid' })
  paysId!: string;

  @Column({ type: 'varchar', length: 20 })
  statut!: string;

  @Column({ type: 'varchar', length: 100 })
  phase!: string;

  @Column({ name: 'date_statut', type: 'timestamptz' })
  dateStatut!: Date;
}
