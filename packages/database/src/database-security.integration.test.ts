import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseSuite =
  process.env['RUN_DATABASE_SECURITY_INTEGRATION'] === '1' ? describe : describe.skip;

databaseSuite('FIP-005C restricted PostgreSQL roles', () => {
  let application: PrismaClient;
  let reader: PrismaClient;
  const eventId = randomUUID();

  beforeAll(async () => {
    application = new PrismaClient({ datasourceUrl: process.env['APPLICATION_DATABASE_URL'] });
    reader = new PrismaClient({ datasourceUrl: process.env['AUDIT_READER_DATABASE_URL'] });
    await application.$connect();
    await reader.$connect();
  });

  afterAll(async () => {
    await Promise.all([application.$disconnect(), reader.$disconnect()]);
  });

  it('allows the application role to append and read audit events', async () => {
    await application.auditEvent.create({
      data: {
        id: eventId,
        occurredAt: new Date('2026-07-30T00:00:00.000Z'),
        actorId: 'synthetic-ci-actor',
        type: 'synthetic.ci.security-check',
        subjectId: 'synthetic-ci-subject',
        payload: { synthetic: true },
      },
    });
    await expect(application.auditEvent.findUnique({ where: { id: eventId } })).resolves.toEqual(
      expect.objectContaining({ id: eventId }),
    );
    const owners = await application.$queryRaw<Array<{ tableowner: string }>>`
      SELECT tableowner FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'AuditEvent'
    `;
    expect(owners).toEqual([{ tableowner: 'rems_migration_owner' }]);
  });

  it.each([
    ['UPDATE', `UPDATE "AuditEvent" SET "type" = 'forbidden' WHERE "id" = '${eventId}'`],
    ['DELETE', `DELETE FROM "AuditEvent" WHERE "id" = '${eventId}'`],
    ['TRUNCATE', 'TRUNCATE TABLE "AuditEvent"'],
  ])('rejects application-role %s', async (_operation, statement) => {
    await expect(application.$executeRawUnsafe(statement)).rejects.toThrow();
  });

  it('allows the audit reader to read but rejects every write class', async () => {
    await expect(reader.auditEvent.findUnique({ where: { id: eventId } })).resolves.toEqual(
      expect.objectContaining({ id: eventId }),
    );
    await expect(
      reader.$executeRawUnsafe(
        `INSERT INTO "AuditEvent" ("id", "occurredAt", "actorId", "type", "subjectId", "payload") VALUES ('${randomUUID()}', now(), 'synthetic', 'forbidden', 'synthetic', '{}')`,
      ),
    ).rejects.toThrow();
    await expect(
      reader.$executeRawUnsafe('UPDATE "AuditEvent" SET "type" = \'forbidden\''),
    ).rejects.toThrow();
    await expect(reader.$executeRawUnsafe('DELETE FROM "AuditEvent"')).rejects.toThrow();
    await expect(reader.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"')).rejects.toThrow();
  });
});
