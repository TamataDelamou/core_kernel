import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import configuration, { AppConfiguration } from './config/configuration';
import { validateEnvironment } from './config/validation.schema';
import { IdentityModule } from './identity/identity.module';
import { ReferentialModule } from './referential/referential.module';
import { OrgModule } from './org/org.module';
import { ProductModule } from './product/product.module';
import { AuditModule } from './audit/audit.module';
import { ReferentialEngineModule } from './referential-engine/referential-engine.module';
import { ProductRegistryModule } from './product-registry/product-registry.module';
import { AppConfigModule } from './app-config/app-config.module';
import { KernelInfrastructureModule } from './common/kernel-infrastructure/kernel-infrastructure.module';
import { TransactionInterceptor } from './common/interceptors/transaction.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
      cache: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration>): TypeOrmModuleOptions => ({
        type: 'postgres' as const,
        host: configService.get('database.host', { infer: true }) as string,
        port: configService.get('database.port', { infer: true }) as number,
        username: configService.get('database.username', { infer: true }) as string,
        password: configService.get('database.password', { infer: true }) as string,
        database: configService.get('database.database', { infer: true }) as string,
        ssl: configService.get('database.ssl', { infer: true })
          ? { rejectUnauthorized: true }
          : false,
        autoLoadEntities: true,
        // OWASP / bonne pratique DDD : jamais de synchronize automatique, migrations explicites
        // uniquement (npm run migration:run), y compris en développement, pour ne jamais dériver
        // silencieusement du schéma versionné dans les migrations.
        synchronize: false,
        logging: configService.get('env', { infer: true }) === 'development',
      }),
    }),

    // OWASP ASVS 2.2.1 — limitation de débit globale par défaut ; les endpoints sensibles
    // (register, login, mfa/verify) appliquent en plus une limite dédiée via @Throttle().
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration>) => ({
        throttlers: [
          {
            ttl: (configService.get('throttle.ttlSeconds', { infer: true }) as number) * 1000,
            limit: configService.get('throttle.limit', { infer: true }) as number,
          },
        ],
      }),
    }),

    KernelInfrastructureModule,
    IdentityModule,
    ReferentialModule,
    ReferentialEngineModule,
    OrgModule,
    ProductModule,
    ProductRegistryModule,
    AppConfigModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Ouvre une transaction Postgres pour toute requête d'écriture (voir
    // TransactionInterceptor) — condition de l'atomicité complète Outbox (Priorité 1).
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionInterceptor,
    },
  ],
})
export class AppModule {}
