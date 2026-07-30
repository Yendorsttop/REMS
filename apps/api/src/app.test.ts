import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule, configureOpenApi } from './app.js';
import { Red001Facade } from './app.js';
import { Red001Service } from '@rems/red-001';
import { PrismaExternalIdentityResolver, PrismaService } from '@rems/database';
import { OidcTokenVerifier } from './auth.js';
import {
  InMemoryAuditEventPort,
  InMemoryExecutiveIdentityRepository,
  InMemoryOrganizationRepository,
  StaticAuthorizationPort,
} from '../../../packages/testing/src/index.js';
const permissions = new Set([
  'red001.identity.create',
  'red001.identity.lifecycle',
  'red001.identity.read',
]);
describe('RED-001 REST API', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const service = new Red001Service(
      new InMemoryExecutiveIdentityRepository(),
      new InMemoryOrganizationRepository(),
      new InMemoryAuditEventPort(),
      new StaticAuthorizationPort(new Map([['synthetic-founder', permissions]])),
    );
    app = (
      await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(Red001Facade)
        .useValue(service)
        .overrideProvider(PrismaService)
        .useValue({})
        .overrideProvider(OidcTokenVerifier)
        .useValue({ verify: async () => ({ issuer: 'https://issuer.test', subject: 'founder' }) })
        .overrideProvider(PrismaExternalIdentityResolver)
        .useValue({ resolve: async () => 'synthetic-founder' })
        .compile()
    ).createNestApplication();
    configureOpenApi(app);
    await app.init();
  });
  it('creates and transitions a synthetic executive identity', async () => {
    await request(app.getHttpServer())
      .post('/v1/red-001/identities')
      .set('authorization', 'Bearer controlled-test-token')
      .send({ id: 'synthetic-executive', displayName: 'Synthetic Executive' })
      .expect(201);
    const response = await request(app.getHttpServer())
      .patch('/v1/red-001/identities/synthetic-executive/suspend')
      .set('authorization', 'Bearer controlled-test-token')
      .expect(200);
    expect(response.body.status).toBe('SUSPENDED');
    await app.close();
  });
  it('publishes OpenAPI and rejects absent actor context', async () => {
    const spec = await request(app.getHttpServer()).get('/openapi-json').expect(200);
    expect(spec.body.paths['/v1/red-001/identities']).toBeDefined();
    await request(app.getHttpServer()).get('/v1/red-001/identities').expect(401);
    await app.close();
  });
});
