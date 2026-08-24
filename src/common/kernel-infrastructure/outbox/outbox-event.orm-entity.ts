import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type StatutOutbox = 'en_attente' | 'publie' | 'echec';

/**
 * Table partagée du noyau (KER-VIS-05 : un seul mécanisme, jamais dupliqué par module).
 * Toute écriture passant par le port EVENT_PUBLISHER (common/kernel-ports) — quel que soit
 * le module appelant — insère une ligne ici plutôt que de publier directement vers Redis.
 * L'insertion se fait dans la même base Postgres que l'entité métier qui vient d'être
 * sauvegardée, ce qui réduit considérablement la fenêtre de double-écriture (Postgres+Redis
 * indépendants aujourd'hui) à une fenêtre bien plus étroite (deux instructions séquentielles
 * contre la même base) — l'atomicité complète (même transaction que l'entité métier) reste
 * un chantier de retrofit documenté séparément (voir README, TransactionManager).
 */
@Entity({ name: 'evenement_outbox' })
export class OutboxEventOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  type!: string;

  @Index()
  @Column({ name: 'gsg_org_id', type: 'uuid', nullable: true })
  gsgOrgId!: string | null;

  @Column({ name: 'horodatage', type: 'timestamptz' })
  horodatage!: Date;

  @Column({ name: 'produit_source', type: 'varchar', length: 100 })
  produitSource!: string;

  @Column({ name: 'charge_utile', type: 'jsonb' })
  chargeUtile!: Record<string, unknown>;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'en_attente' })
  statut!: StatutOutbox;

  @Column({ type: 'int', default: 0 })
  tentatives!: number;

  @Column({ name: 'derniere_erreur', type: 'text', nullable: true })
  derniereErreur!: string | null;

  @Column({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'publie_le', type: 'timestamptz', nullable: true })
  publieLe!: Date | null;
}
