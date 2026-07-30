import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const describeDatabase = runDatabaseIntegration ? describe : describe.skip;
let prisma: PrismaClient | undefined;

describeDatabase('PostgreSQL persistence', () => {
  beforeAll(async () => {
    const { PrismaClient: DatabaseClient } = await import('@prisma/client');
    prisma = new DatabaseClient();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('persists and relates governed RED-001 records', async () => {
    const suffix = randomUUID();
    const executiveId = `executive-${suffix}`;
    const unitId = `unit-${suffix}`;
    const membershipId = `membership-${suffix}`;

    await prisma!.$transaction(async (database) => {
      await database.executiveIdentity.create({
        data: { id: executiveId, displayName: 'CI Executive' },
      });
      await database.organizationUnit.create({
        data: { id: unitId, name: 'CI Organization', kind: 'ORGANIZATION' },
      });
      await database.membership.create({
        data: {
          id: membershipId,
          executiveId,
          unitId,
          role: 'FOUNDER',
        },
      });

      const membership = await database.membership.findUniqueOrThrow({
        where: { id: membershipId },
        include: { executive: true, unit: true },
      });

      expect(membership.executive.id).toBe(executiveId);
      expect(membership.unit.id).toBe(unitId);

      await database.membership.delete({ where: { id: membershipId } });
      await database.organizationUnit.delete({ where: { id: unitId } });
      await database.executiveIdentity.delete({ where: { id: executiveId } });
    });
  });
});
