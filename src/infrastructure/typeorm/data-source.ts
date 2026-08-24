import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * DataSource unique du noyau, utilisé par le CLI de migrations (`npm run migration:run`).
 * Chaque brique du noyau (GSG ID, GSG Referential, ...) reste responsable de son propre
 * sous-ensemble de tables, mais partage la même base PostgreSQL de service et le même
 * mécanisme de migration explicite (jamais de `synchronize` automatique en production).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'gsg_id',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'gsg_id',
  ssl: process.env.DB_SSL === 'true',
  entities: [
    __dirname + '/../../identity/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../referential/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../org/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../product/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../audit/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../referential-engine/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../product-registry/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../app-config/infrastructure/persistence/typeorm/orm-entities{.ts,.js}',
    __dirname + '/../../common/kernel-infrastructure/outbox/outbox-event.orm-entity{.ts,.js}',
  ],
  migrations: [
    __dirname + '/../../identity/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../referential/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../org/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../product/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../audit/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../referential-engine/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../product-registry/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../app-config/infrastructure/persistence/migrations/*{.ts,.js}',
    __dirname + '/../../common/kernel-infrastructure/persistence/migrations/*{.ts,.js}',
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
