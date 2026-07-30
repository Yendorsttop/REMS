import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule, configureOpenApi } from './app.js';
describe('RED-001 REST API', () => {
  let app: INestApplication;
  beforeEach(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    configureOpenApi(app);
    await app.init();
  });
  it('creates and transitions a synthetic executive identity', async () => {
    await request(app.getHttpServer())
      .post('/v1/red-001/identities')
      .set('x-actor-id', 'synthetic-founder')
      .send({ id: 'synthetic-executive', displayName: 'Synthetic Executive' })
      .expect(201);
    const response = await request(app.getHttpServer())
      .patch('/v1/red-001/identities/synthetic-executive/suspend')
      .set('x-actor-id', 'synthetic-founder')
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
