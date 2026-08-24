import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { isolateRedisNamespaceForThisFile } from './redis-test-helpers';
import { AppModule } from '../../../src/app.module';
import { TOKEN_SERVICE, TokenService } from '../../../src/identity/domain/services/token-and-mfa.interface';
import { MoveToDeadLetterUseCase } from '../../../src/audit/application/use-cases/dead-letter.use-cases';
import {
  AUDIT_EVENEMENT_REPOSITORY,
  AuditEvenementRepository,
  DEAD_LETTER_REPOSITORY,
  DeadLetterRepository,
} from '../../../src/audit/domain/repositories/audit.repositories';

/**
 * PRÉREQUIS : voir outbox-relay-to-redis.redis-spec.ts. Application COMPLÈTE (les 7 modules
 * du noyau) bootstrapée comme pour un test e2e classique — nécessaire ici puisque l'objet
 * même du test est l'endpoint HTTP, pas un use-case isolé. Seul fichier de cette suite à
 * démarrer l'application entière ; les trois précédents restent volontairement ciblés.
 *
 * Le jeton JWT est émis DIRECTEMENT via TOKEN_SERVICE (résolu depuis le conteneur DI de
 * l'application réelle) plutôt que via un aller-retour register→login : JwtAuthGuard ne
 * consulte jamais la base pour authentifier une requête (vérification de signature et lecture
 * des claims uniquement), un jeton valide signé par le même secret suffit donc, sans exiger
 * un utilisateur réellement enregistré en base pour ce test précis.
 */
describe('[Redis physique/e2e] Rejeu manuel d\'une entrée DLQ via POST /v1/audit/dead-letter/:id/replay', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let deadLetterRepository: DeadLetterRepository;
  let auditEvenementRepository: AuditEvenementRepository;
  let moveToDeadLetterUseCase: MoveToDeadLetterUseCase;
  let jwtAdmin: string;

  beforeAll(async () => {
    isolateRedisNamespaceForThisFile();

    moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const tokenService = moduleFixture.get<TokenService>(TOKEN_SERVICE);
    const { token } = await tokenService.issueAccessToken({
      gsgId: `test-admin-${uuidv4()}`,
      roles: ['kernel.admin'],
      gsgOrgIds: [],
      mfaVerified: true,
    });
    jwtAdmin = token;

    deadLetterRepository = moduleFixture.get(DEAD_LETTER_REPOSITORY);
    auditEvenementRepository = moduleFixture.get(AUDIT_EVENEMENT_REPOSITORY);
    moveToDeadLetterUseCase = moduleFixture.get(MoveToDeadLetterUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejoue une entrée DLQ réelle : la persiste dans audit_evenement et marque l\'entrée comme rejouée', async () => {
    const evenementId = uuidv4();

    // Fabrique une entrée DLQ réelle en base, exactement comme le ferait
    // RedisStreamsConsumerService après épuisement des tentatives — sans dépendre de Redis
    // pour CE fichier, puisque le point sous test est l'endpoint HTTP de rejeu lui-même.
    await moveToDeadLetterUseCase.execute({
      message: {
        outboxId: evenementId,
        type: 'test.redis_physical.dlq_replay',
        gsgOrgId: null,
        horodatage: new Date().toISOString(),
        produitSource: 'test-redis-physical',
        chargeUtileBrute: JSON.stringify({ marqueur: 'rejeu-e2e' }),
      },
      tentatives: 5,
      derniereErreur: 'échec simulé pour préparation du test',
    });

    const { elements } = await deadLetterRepository.list({ page: 1, tailleParPage: 100 });
    const entree = elements.find((e) => e.evenementId === evenementId);
    expect(entree).toBeDefined();
    const entreeId = (entree as NonNullable<typeof entree>).id;

    const reponse = await request(app.getHttpServer())
      .post(`/api/v1/audit/dead-letter/${entreeId}/replay`)
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .send();

    expect(reponse.status).toBe(201);
    expect(reponse.body).toEqual({ success: true });

    const maintenantPersiste = await auditEvenementRepository.existsByEvenementId(evenementId);
    expect(maintenantPersiste).toBe(true);
  });

  it('REFUSE un second rejeu de la MÊME entrée (HTTP 400, jamais un doublon silencieux)', async () => {
    const evenementId = uuidv4();

    await moveToDeadLetterUseCase.execute({
      message: {
        outboxId: evenementId,
        type: 'test.redis_physical.dlq_replay_once',
        gsgOrgId: null,
        horodatage: new Date().toISOString(),
        produitSource: 'test-redis-physical',
        chargeUtileBrute: JSON.stringify({}),
      },
      tentatives: 5,
      derniereErreur: 'échec simulé pour préparation du test',
    });

    const { elements } = await deadLetterRepository.list({ page: 1, tailleParPage: 100 });
    const entree = elements.find((e) => e.evenementId === evenementId);
    const entreeId = (entree as NonNullable<typeof entree>).id;

    const premierRejeu = await request(app.getHttpServer())
      .post(`/api/v1/audit/dead-letter/${entreeId}/replay`)
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .send();
    expect(premierRejeu.status).toBe(201);

    const secondRejeu = await request(app.getHttpServer())
      .post(`/api/v1/audit/dead-letter/${entreeId}/replay`)
      .set('Authorization', `Bearer ${jwtAdmin}`)
      .send();
    expect(secondRejeu.status).toBe(400);
  });

  it('REFUSE le rejeu sans jeton (HTTP 401)', async () => {
    const reponse = await request(app.getHttpServer())
      .post(`/api/v1/audit/dead-letter/${uuidv4()}/replay`)
      .send();
    expect(reponse.status).toBe(401);
  });
});
