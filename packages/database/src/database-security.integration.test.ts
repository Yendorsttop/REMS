import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaSecurityEvidencePort, type PrismaService } from './index.js';

const databaseSuite =
  process.env['RUN_DATABASE_SECURITY_INTEGRATION'] === '1' ? describe : describe.skip;

databaseSuite('FIP-005C/FIP-005D restricted PostgreSQL roles', () => {
  let application: PrismaClient;
  let reader: PrismaClient;
  let migrationOwner: PrismaClient;
  let identityAdmin: PrismaClient;
  let founderBootstrap: PrismaClient;
  let securityReader: PrismaClient;
  const eventId = randomUUID();
  const linkedExecutiveId = `security-link-${randomUUID().slice(0, 8)}`;
  const linkedSubject = `subject-${randomUUID()}`;

  beforeAll(async () => {
    application = new PrismaClient({ datasourceUrl: process.env['APPLICATION_DATABASE_URL'] });
    reader = new PrismaClient({ datasourceUrl: process.env['AUDIT_READER_DATABASE_URL'] });
    migrationOwner = new PrismaClient({ datasourceUrl: process.env['MIGRATION_DATABASE_URL'] });
    identityAdmin = new PrismaClient({
      datasourceUrl: process.env['IDENTITY_ADMIN_DATABASE_URL'],
    });
    founderBootstrap = new PrismaClient({
      datasourceUrl: process.env['FOUNDER_BOOTSTRAP_DATABASE_URL'],
    });
    securityReader = new PrismaClient({
      datasourceUrl: process.env['SECURITY_READER_DATABASE_URL'],
    });
    await Promise.all([
      application.$connect(),
      reader.$connect(),
      migrationOwner.$connect(),
      identityAdmin.$connect(),
      founderBootstrap.$connect(),
      securityReader.$connect(),
    ]);
    await migrationOwner.$executeRaw`
      INSERT INTO "ExecutiveIdentity" (id, "displayName", "updatedAt")
      VALUES (${linkedExecutiveId}, 'Synthetic Security Link', now())`;
    await migrationOwner.$executeRaw`
      INSERT INTO "ExternalIdentityLink" (id, issuer, subject, "executiveId", "updatedAt")
      VALUES (${randomUUID()}::uuid, 'https://security.test', ${linkedSubject}, ${linkedExecutiveId}, now())`;
  });

  afterAll(async () => {
    await migrationOwner.auditEvent.deleteMany({
      where: { OR: [{ id: eventId }, { actorId: linkedExecutiveId }] },
    });
    await migrationOwner.auditEvent.deleteMany({
      where: { actorId: { startsWith: 'security-bootstrap-' } },
    });
    await migrationOwner.externalIdentityLink.deleteMany({
      where: { executiveId: { startsWith: 'security-bootstrap-' } },
    });
    await migrationOwner.membership.deleteMany({
      where: { executiveId: { startsWith: 'security-bootstrap-' } },
    });
    await migrationOwner.executiveIdentity.deleteMany({
      where: { id: { startsWith: 'security-bootstrap-' } },
    });
    await migrationOwner.organizationUnit.deleteMany({
      where: { id: { startsWith: 'security-bootstrap-' } },
    });
    await migrationOwner.$executeRaw`DELETE FROM "ExternalIdentityLink" WHERE "executiveId" = ${linkedExecutiveId}`;
    await migrationOwner.$executeRaw`DELETE FROM "ExecutiveIdentity" WHERE id = ${linkedExecutiveId}`;
    await migrationOwner.systemSecurityEvidence.deleteMany({
      where: {
        OR: [
          { correlationId: 'security-evidence-ci' },
          { correlationId: { startsWith: 'adapter-' } },
        ],
      },
    });
    await Promise.all([
      application.$disconnect(),
      reader.$disconnect(),
      migrationOwner.$disconnect(),
      identityAdmin.$disconnect(),
      founderBootstrap.$disconnect(),
      securityReader.$disconnect(),
    ]);
  });

  it('enforces the dedicated append-only security-evidence privileges and ownership', async () => {
    const id = randomUUID();
    await application.$executeRaw`
      INSERT INTO "SystemSecurityEvidence"
        ("id", "occurredAt", "eventType", "outcome", "reasonCode", "correlationId")
      VALUES
        (${id}::uuid, ${new Date()}, 'AUTHENTICATION_REJECTED', 'DENIED',
         'MISSING_BEARER_TOKEN', 'security-evidence-ci')`;
    await expect(
      application.systemSecurityEvidence.findUnique({ where: { id } }),
    ).rejects.toThrow();
    await expect(
      securityReader.systemSecurityEvidence.findUnique({ where: { id } }),
    ).resolves.toMatchObject({ id });
    for (const client of [application, securityReader]) {
      await expect(client.$executeRaw`
        UPDATE "SystemSecurityEvidence" SET "reasonCode" = 'MALFORMED_TOKEN'
        WHERE id = ${id}::uuid`).rejects.toThrow();
      await expect(client.$executeRaw`
        DELETE FROM "SystemSecurityEvidence" WHERE id = ${id}::uuid`).rejects.toThrow();
      await expect(client.$executeRaw`TRUNCATE TABLE "SystemSecurityEvidence"`).rejects.toThrow();
    }
    await expect(securityReader.$executeRaw`
      INSERT INTO "SystemSecurityEvidence"
        (id,"eventType",outcome,"reasonCode","correlationId")
      VALUES (${randomUUID()}::uuid,'AUTHENTICATION_REJECTED','DENIED','MALFORMED_TOKEN','forbidden')
    `).rejects.toThrow();
    const state = await migrationOwner.$queryRaw<Array<{ tableowner: string }>>`
      SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='SystemSecurityEvidence'`;
    expect(state).toEqual([{ tableowner: 'rems_migration_owner' }]);
    for (const client of [reader, identityAdmin, founderBootstrap])
      await expect(client.$queryRaw`SELECT * FROM "SystemSecurityEvidence"`).rejects.toThrow();
  });

  it('uses a no-RETURNING insert through the production adapter on the INSERT-only connection', async () => {
    const correlationId = `adapter-${randomUUID()}`;
    const adapter = new PrismaSecurityEvidencePort(application as PrismaService);
    await expect(
      adapter.append({
        eventType: 'AUTHENTICATION_REJECTED',
        reasonCode: 'INVALID_SIGNATURE',
        correlationId,
      }),
    ).resolves.toBeUndefined();
    await expect(
      securityReader.systemSecurityEvidence.findFirst({
        where: { correlationId },
      }),
    ).resolves.toMatchObject({
      eventType: 'AUTHENTICATION_REJECTED',
      outcome: 'DENIED',
      reasonCode: 'INVALID_SIGNATURE',
      correlationId,
    });
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

  it('gives the application SELECT-only access to an administratively seeded link', async () => {
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
  });

  it.each([
    [
      'INSERT',
      `INSERT INTO "ExternalIdentityLink" (id, issuer, subject, "executiveId", "updatedAt") VALUES ('${randomUUID()}', 'https://forbidden.test', 'insert', '${linkedExecutiveId}', now())`,
    ],
    [
      'UPDATE',
      `UPDATE "ExternalIdentityLink" SET active = false WHERE subject = '${linkedSubject}'`,
    ],
    ['DELETE', `DELETE FROM "ExternalIdentityLink" WHERE subject = '${linkedSubject}'`],
    ['TRUNCATE', 'TRUNCATE TABLE "ExternalIdentityLink"'],
  ])('rejects application-role ExternalIdentityLink %s', async (_operation, statement) => {
    await expect(application.$executeRawUnsafe(statement)).rejects.toThrow();
  });

  it('denies the audit reader all ExternalIdentityLink access', async () => {
    await expect(
      reader.$queryRawUnsafe('SELECT * FROM "ExternalIdentityLink" LIMIT 1'),
    ).rejects.toThrow();
  });

  it('limits controlled identity administration and preserves audit immutability', async () => {
    const privileges = await identityAdmin.$queryRaw<
      Array<{ table_name: string; privilege_type: string }>
    >`
      SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'rems_identity_admin'
        AND table_name IN ('ExecutiveIdentity', 'OrganizationUnit', 'Membership', 'PermissionAssignment', 'ExternalIdentityLink', 'AuditEvent')
      ORDER BY table_name, privilege_type`;
    expect(privileges).toEqual([
      { table_name: 'AuditEvent', privilege_type: 'INSERT' },
      { table_name: 'AuditEvent', privilege_type: 'SELECT' },
      { table_name: 'ExecutiveIdentity', privilege_type: 'SELECT' },
      { table_name: 'ExternalIdentityLink', privilege_type: 'DELETE' },
      { table_name: 'ExternalIdentityLink', privilege_type: 'INSERT' },
      { table_name: 'ExternalIdentityLink', privilege_type: 'SELECT' },
      { table_name: 'ExternalIdentityLink', privilege_type: 'UPDATE' },
      { table_name: 'Membership', privilege_type: 'SELECT' },
      { table_name: 'OrganizationUnit', privilege_type: 'SELECT' },
      { table_name: 'PermissionAssignment', privilege_type: 'SELECT' },
    ]);
    for (const statement of [
      `UPDATE "AuditEvent" SET "type" = 'forbidden' WHERE "id" = '${eventId}'`,
      `DELETE FROM "AuditEvent" WHERE "id" = '${eventId}'`,
      'TRUNCATE TABLE "AuditEvent"',
      'TRUNCATE TABLE "ExternalIdentityLink"',
    ])
      await expect(identityAdmin.$executeRawUnsafe(statement)).rejects.toThrow();
    const owners = await identityAdmin.$queryRaw<Array<{ tableowner: string }>>`
      SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN ('ExecutiveIdentity', 'ExternalIdentityLink', 'AuditEvent')`;
    expect(owners).toEqual([{ tableowner: 'rems_migration_owner' }]);
  });

  it('lets identity administration mutate a link and append evidence atomically', async () => {
    const lifecycleEventId = randomUUID();
    await identityAdmin.$transaction(async (tx) => {
      await tx.externalIdentityLink.update({
        where: { issuer_subject: { issuer: 'https://security.test', subject: linkedSubject } },
        data: { active: false },
      });
      await tx.auditEvent.create({
        data: {
          id: lifecycleEventId,
          occurredAt: new Date(),
          actorId: linkedExecutiveId,
          type: 'synthetic.external-link.suspend',
          subjectId: linkedExecutiveId,
          payload: { synthetic: true },
        },
      });
    });
    await expect(
      identityAdmin.auditEvent.findUnique({ where: { id: lifecycleEventId } }),
    ).resolves.toBeTruthy();
    await identityAdmin.externalIdentityLink.update({
      where: { issuer_subject: { issuer: 'https://security.test', subject: linkedSubject } },
      data: { active: true },
    });
  });

  it('allows only the bootstrap role to establish initial records atomically', async () => {
    const suffix = randomUUID().slice(0, 8);
    const executiveId = `security-bootstrap-${suffix}`;
    const unitId = `security-bootstrap-${suffix}`;
    const auditId = randomUUID();
    await founderBootstrap.$transaction(async (tx) => {
      await tx.organizationUnit.create({
        data: { id: unitId, name: 'Synthetic Bootstrap', kind: 'ORGANIZATION' },
      });
      await tx.executiveIdentity.create({
        data: { id: executiveId, displayName: 'Synthetic Bootstrap' },
      });
      await tx.membership.create({
        data: { id: `founder-${suffix}`, executiveId, unitId, role: 'FOUNDER' },
      });
      await tx.externalIdentityLink.create({
        data: { issuer: `https://bootstrap-${suffix}.test`, subject: 'synthetic', executiveId },
      });
      await tx.auditEvent.create({
        data: {
          id: auditId,
          occurredAt: new Date(),
          actorId: executiveId,
          type: 'synthetic.bootstrap',
          subjectId: executiveId,
          payload: {},
        },
      });
    });
    await expect(
      founderBootstrap.auditEvent.findUnique({ where: { id: auditId } }),
    ).resolves.toBeTruthy();
    await expect(
      founderBootstrap.auditEvent.update({ where: { id: auditId }, data: { type: 'forbidden' } }),
    ).rejects.toThrow();
    await expect(
      identityAdmin.executiveIdentity.create({
        data: { id: `forbidden-${suffix}`, displayName: 'Forbidden' },
      }),
    ).rejects.toThrow();
    await expect(
      identityAdmin.organizationUnit.update({ where: { id: unitId }, data: { name: 'Forbidden' } }),
    ).rejects.toThrow();
    await expect(identityAdmin.membership.deleteMany({ where: { executiveId } })).rejects.toThrow();
    await expect(
      identityAdmin.permissionAssignment.create({
        data: { id: `forbidden-${suffix}`, executiveId, permission: 'red001.authorization.manage' },
      }),
    ).rejects.toThrow();
    const rollbackId = `security-bootstrap-rollback-${suffix}`;
    await expect(
      founderBootstrap.$transaction(async (tx) => {
        await tx.executiveIdentity.create({
          data: { id: rollbackId, displayName: 'Synthetic Rollback' },
        });
        throw new Error('synthetic ceremony failure');
      }),
    ).rejects.toThrow('synthetic ceremony failure');
    await expect(
      migrationOwner.executiveIdentity.findUnique({ where: { id: rollbackId } }),
    ).resolves.toBeNull();
  });
});
