import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

/**
 * Test e2e représentatif du parcours d'authentification complet exposé par GSG ID.
 *
 * PRÉREQUIS : ce test nécessite une instance PostgreSQL et Redis réelles et migrées
 * (voir README section 4 — `docker compose up -d` puis `npm run migration:run`), ainsi
 * qu'un fichier `.env` valide. Il n'est PAS exécuté par `npm run test` (tests unitaires/
 * intégration avec mocks) mais par `npm run test:e2e`, volontairement séparé car il dépend
 * de services externes — cohérent avec KER-ARC-03 (le noyau ne doit jamais bloquer un
 * produit, mais ses propres tests e2e dépendent légitimement de son infrastructure réelle).
 */
describe('Auth (e2e) — parcours register → login → refresh', () => {
  let app: INestApplication;
  const emailUnique = `e2e-${Date.now()}@example.com`;
  const password = 'MotDePasseTresRobuste123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // 'api' seul — enableVersioning() ajoute déjà le segment /v1. Voir configuration.ts pour
    // l'explication complète du bug de double-versionnement que ceci corrige.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('inscrit un nouvel utilisateur et renvoie un gsgId (KER-ID-05/06)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: emailUnique,
        password,
        nomAffichage: 'Utilisateur E2E',
        phone: '+224620000000',
      })
      .expect(201);

    expect(response.body.gsgId).toBeDefined();
    expect(typeof response.body.gsgId).toBe('string');
  });

  it('refuse une inscription en double sur le même email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailUnique, password, nomAffichage: 'Doublon' })
      .expect(400);
  });

  it('refuse un payload avec un champ non déclaré (whitelist stricte — OWASP)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `autre-${Date.now()}@example.com`,
        password,
        nomAffichage: 'Test',
        champInconnu: 'devrait être rejeté',
      })
      .expect(400);
  });

  it('authentifie l\'utilisateur et renvoie une paire de jetons', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailUnique, password })
      .expect(201);

    expect(response.body.status).toBe('authenticated');
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it('refuse un mot de passe incorrect avec un message générique (anti-énumération)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailUnique, password: 'mauvais-mot-de-passe-123' })
      .expect(401);

    expect(response.body.message).toBe('Identifiants invalides.');
  });

  it('refuse l\'accès à /users/me sans jeton', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('autorise /users/me avec un access token valide et expose le référentiel (KER-ID-05)', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailUnique, password })
      .expect(201);

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(emailUnique.toLowerCase());
    expect(meResponse.body.referentiel).toBeDefined();
  });
});
