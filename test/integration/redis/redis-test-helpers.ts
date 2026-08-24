import Redis from 'ioredis';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Chaque fichier de test physique doit appeler CETTE fonction en tout premier, avant tout
 * import qui déclencherait la lecture de la configuration (ConfigModule lit process.env au
 * moment du bootstrap de l'application, pas au chargement du fichier — appeler ceci dans un
 * `beforeAll`, avant `Test.createTestingModule(...).compile()`, suffit).
 *
 * Sans cette isolation, plusieurs fichiers de test physiques tournant contre le MÊME Redis
 * réel (le même `docker compose up` que le reste du projet, pas une instance dédiée par
 * fichier) se disputeraient les messages d'un même flux/groupe de consommateurs partagé —
 * un message publié par le test A pourrait être consommé par l'instance applicative du
 * test B. Un suffixe aléatoire par fichier élimine ce risque sans exiger une exécution
 * strictement séquentielle des fichiers.
 */
export function isolateRedisNamespaceForThisFile(): { streamKey: string; consumerGroup: string; suffix: string } {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const streamKey = `gsg.kernel.events.test.${suffix}`;
  const consumerGroup = `audit-consumers-test-${suffix}`;

  process.env.EVENT_BUS_STREAM_PREFIX = streamKey;
  process.env.AUDIT_CONSUMER_GROUP = consumerGroup;

  return { streamKey, consumerGroup, suffix };
}

export function createRawTestRedisClient(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}

/**
 * Attente active bornée — les tests physiques dépendent de boucles asynchrones réelles
 * (polling Redis, timers `setInterval`) dont le délai exact n'est jamais garanti à la
 * milliseconde près. Interroge `check` toutes les `intervalMs` jusqu'à ce qu'elle renvoie une
 * valeur non nulle/non fausse, ou lève une erreur explicite au-delà de `timeoutMs` — jamais un
 * simple `setTimeout` fixe, qui serait soit trop court (test flaky) soit inutilement long
 * (suite lente) selon la charge de la machine qui l'exécute.
 */
export async function waitUntil<T>(
  check: () => Promise<T | null | undefined | false>,
  options: { timeoutMs: number; intervalMs: number; description: string },
): Promise<T> {
  const debut = Date.now();
  while (Date.now() - debut < options.timeoutMs) {
    const resultat = await check();
    if (resultat) return resultat;
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }
  throw new Error(
    `waitUntil expiré après ${options.timeoutMs}ms : ${options.description}`,
  );
}

/**
 * Options TypeORM minimales pour un test physique ciblé — mêmes variables d'environnement
 * que `src/infrastructure/typeorm/data-source.ts` (DB_HOST, DB_PORT...), mais avec seulement
 * les entités réellement nécessaires au fichier de test, plutôt que les huit modules complets
 * du noyau. `synchronize: false` — les tables doivent déjà exister via
 * `npm run migration:run`, jamais de création implicite de schéma en test.
 */
export function testTypeOrmOptions(entities: Function[]): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'gsg_id',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'gsg_id',
    ssl: process.env.DB_SSL === 'true',
    entities,
    synchronize: false,
    logging: false,
  };
}
