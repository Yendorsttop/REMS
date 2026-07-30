import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseSuite =
  process.env['RUN_DATABASE_SECURITY_INTEGRATION'] === '1' ? describe : describe.skip;

databaseSuite('FIP-005C restricted PostgreSQL roles', () => {
  let application: PrismaClient;
  let reader: PrismaClient;
  let migrationOwner: PrismaClient;
  const eventId = randomUUID();
  const linkedExecutiveId = `security-link-${randomUUID().slice(0, 8)}`;
  const linkedSubject = `subject-${randomUUID()}`;

  beforeAll(async () => {
    application = new PrismaClient({ datasourceUrl: process.env['APPLICATION_DATABASE_URL'] });
    reader = new PrismaClient({ datasourceUrl: process.env['AUDIT_READER_DATABASE_URL'] });
    migrationOwner = new PrismaClient({ datasourceUrl: process.env['MIGRATION_DATABASE_URL'] });
    await Promise.all([application.$connect(), reader.$connect(), migrationOwner.$connect()]);
    await migrationOwner.$executeRaw`
      INSERT INTO "ExecutiveIdentity" (id, "displayName", "updatedAt")
      VALUES (${linkedExecutiveId}, 'Synthetic Security Link', now())`;
    await migrationOwner.$executeRaw`
      INSERT INTO "ExternalIdentityLink" (id, issuer, subject, "executiveId", "updatedAt")
      VALUES (${randomUUID()}::uuid, 'https://security.test', ${linkedSubject}, ${linkedExecutiveId}, now())`;
  });

  afterAll(async () => {
    await migrationOwner.$executeRaw`DELETE FROM "ExternalIdentityLink" WHERE "executiveId" = ${linkedExecutiveId}`;
    await migrationOwner.$executeRaw`DELETE FROM "ExecutiveIdentity" WHERE id = ${linkedExecutiveId}`;
    await Promise.all([
      application.$disconnect(),
      reader.$disconnect(),
      migrationOwner.$disconnect(),
    ]);
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

  it('applies least-privilege ownership and grants to the external identity link', async () => {
    const owners = await application.$queryRaw<Array<{ tableowner: string }>>`
      SELECT tableowner FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'ExternalIdentityLink'`;
    expect(owners).toEqual([{ tableowner: 'rems_migration_owner' }]);
    const applicationPrivileges = await application.$queryRaw<Array<{ privilege_type: string }>>`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'rems_application' AND table_name = 'ExternalIdentityLink'
      ORDER BY privilege_type`;
    expect(applicationPrivileges.map(({ privilege_type }) => privilege_type)).toEqual(['SELECT']);
    await expect(
      application.$queryRaw`
        SELECT subject FROM "ExternalIdentityLink"
        WHERE issuer = 'https://security.test' AND subject = ${linkedSubject}`,
    ).resolves.toEqual([{ subject: linkedSubject }]);
    const forbiddenStatements = [
      `INSERT INTO "ExternalIdentityLink" (id, issuer, subject, "executiveId", "updatedAt") VALUES ('${randomUUID()}', 'https://forbidden.test', 'insert', '${linkedExecutiveId}', now())`,
      `UPDATE "ExternalIdentityLink" SET active = false WHERE subject = '${linkedSubject}'`,
      `DELETE FROM "ExternalIdentityLink" WHERE subject = '${linkedSubject}'`,
      'TRUNCATE TABLE "ExternalIdentityLink"',
    ];
    for (const statement of forbiddenStatements)
      await expect(application.$executeRawUnsafe(statement)).rejects.toThrow();
    await expect(
      reader.$queryRawUnsafe('SELECT * FROM "ExternalIdentityLink" LIMIT 1'),
    ).rejects.toThrow();
  });
});
