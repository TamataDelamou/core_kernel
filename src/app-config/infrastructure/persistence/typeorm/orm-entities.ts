import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'configuration_globale' })
export class ConfigurationGlobaleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'devise_id', type: 'uuid', nullable: true })
  deviseId!: string | null;

  @Column({ name: 'langue_id', type: 'uuid', nullable: true })
  langueId!: string | null;

  @Column({ name: 'fuseau_horaire', type: 'varchar', length: 100 })
  fuseauHoraire!: string;

  @Column({ name: 'format_date', type: 'varchar', length: 50 })
  formatDate!: string;

  @Column({ name: 'format_nombre', type: 'varchar', length: 50 })
  formatNombre!: string;

  @Column({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
