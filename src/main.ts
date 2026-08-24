import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfiguration } from './config/configuration';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Aucune information sensible (stack trace) n'est journalisée en production par le logger par défaut.
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService<AppConfiguration>);
  const port = configService.get('port', { infer: true }) as number;
  const globalPrefix = configService.get('apiGlobalPrefix', { infer: true }) as string;

  // OWASP: en-têtes de sécurité HTTP standards (CSP, HSTS, X-Content-Type-Options, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // OWASP: rejet strict des payloads non conformes (whitelist + forbidNonWhitelisted).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      disableErrorMessages: configService.get('env', { infer: true }) === 'production',
    }),
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => callback(null, true), // À restreindre à une allowlist explicite en production (KER-ARC-02).
    credentials: true,
  });

  await app.listen(port);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Échec du démarrage de GSG ID :', error);
  process.exit(1);
});
