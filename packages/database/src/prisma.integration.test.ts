import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Red001Service } from '@rems/red-001';
import {
  PrismaAuditEventPort,
  PrismaAuthorizationPort,
  PrismaExecutiveIdentityRepository,
  PrismaOrganizationRepository,
  PrismaService,
  PrismaTransactionContext,
} from './index.js';

const databaseSuite = process.env['RUN_DATABASE_INTEGRATION'] === '1' ? describe : describe.skip;
databaseSuite('RED-001 Prisma/PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let transaction: PrismaTransactionContext;
  let identities: PrismaExecutiveIdentityRepository;
  let organizations: PrismaOrganizationRepository;
  let audit: PrismaAuditEventPort;
  let authorization: PrismaAuthorizationPort;
  const prefix = `integration-${randomUUID().slice(0, 8)}`;
  const founderId = `${prefix}-founder`;
  let eventNumber = 0;
  let service: Red001Service;

  beforeAll(async () => {
    prisma = new PrismaService();
    transaction = new PrismaTransactionContext(prisma);
    identities = new PrismaExecutiveIdentityRepository(transaction);
    organizations = new PrismaOrganizationRepository(transaction);
    audit = new PrismaAuditEventPort(transaction);
    authorization = new PrismaAuthorizationPort(organizations);
    service = new Red001Service(
      identities,
      organizations,
      audit,
      authorization,
      () => randomUUID(),
      () => new Date('2026-07-30T00:00:00.000Z'),
      transaction,
    );
    await prisma.$connect();
    await prisma.executiveIdentity.create({
      data: { id: founderId, displayName: 'Synthetic Founder' },
    });
    await prisma.permissionAssignment.createMany({
      data: [
        'red001.identity.create',
        'red001.identity.lifecycle',
        'red001.organization.manage',
        'red001.membership.manage',
        'red001.authorization.manage',
      ].map((permission) => ({
        id: `${prefix}-permission-${++eventNumber}`,
        executiveId: founderId,
        permission,
      })),
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { subjectId: { startsWith: prefix } } });
    await prisma.permissionAssignment.deleteMany({
      where: { executiveId: { startsWith: prefix } },
    });
    await prisma.membership.deleteMany({ where: { executiveId: { startsWith: prefix } } });
    await prisma.organizationUnit.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.executiveIdentity.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  });

  it('persists identities, hierarchy, memberships, roles, reporting, permissions, and audit events', async () => {
    const managerId = `${prefix}-manager`;
    const memberId = `${prefix}-member`;
    const organizationId = `${prefix}-organization`;
    const departmentId = `${prefix}-department`;
    const teamId = `${prefix}-team`;
    await service.createIdentity(founderId, {
      id: managerId,
      displayName: 'Synthetic Manager',
      externalSubject: `${prefix}-external-manager`,
    });
    await service.createIdentity(founderId, { id: memberId, displayName: 'Synthetic Member' });
    await service.createUnit(founderId, {
      id: organizationId,
      name: 'Synthetic Organization',
      kind: 'ORGANIZATION',
    });
    await service.createUnit(founderId, {
      id: departmentId,
      name: 'Synthetic Department',
      kind: 'DEPARTMENT',
      parentId: organizationId,
    });
    await service.createUnit(founderId, {
      id: teamId,
      name: 'Synthetic Team',
      kind: 'TEAM',
      parentId: departmentId,
    });
    await service.assignMembership(founderId, {
      id: `${prefix}-manager-membership`,
      executiveId: managerId,
      unitId: teamId,
      role: 'MANAGER',
    });
    await service.assignMembership(founderId, {
      id: `${prefix}-member-membership`,
      executiveId: memberId,
      unitId: teamId,
      role: 'MEMBER',
      managerExecutiveId: managerId,
    });
    await service.assignPermission(founderId, {
      id: `${prefix}-scoped-permission`,
      executiveId: memberId,
      permission: 'red001.identity.read',
      organizationUnitId: teamId,
    });

    expect(
      (await identities.findByExternalSubject(`${prefix}-external-manager`))?.snapshot.id,
    ).toBe(managerId);
    expect(await organizations.membershipsFor(memberId)).toEqual([
      expect.objectContaining({ role: 'MEMBER', managerExecutiveId: managerId }),
    ]);
    expect(await organizations.permissionsFor(memberId)).toEqual([
      expect.objectContaining({ organizationUnitId: teamId }),
    ]);
    expect(await prisma.auditEvent.count({ where: { subjectId: { startsWith: prefix } } })).toBe(8);
  });

  it('rolls the governed record back when its audit append fails', async () => {
    const duplicateEventId = randomUUID();
    await prisma.auditEvent.create({
      data: {
        id: duplicateEventId,
        occurredAt: new Date(),
        actorId: founderId,
        type: 'synthetic.preexisting',
        subjectId: `${prefix}-preexisting`,
        payload: {},
      },
    });
    const failingService = new Red001Service(
      identities,
      organizations,
      audit,
      authorization,
      () => duplicateEventId,
      undefined,
      transaction,
    );
    const identityId = `${prefix}-rolled-back`;
    await expect(
      failingService.createIdentity(founderId, {
        id: identityId,
        displayName: 'Rolled Back Identity',
      }),
    ).rejects.toThrow();
    expect(await identities.findById(identityId)).toBeNull();
  });

  it('enforces restrictive deletion for governed relationships', async () => {
    await expect(prisma.executiveIdentity.delete({ where: { id: founderId } })).rejects.toThrow();
    const organization = await prisma.organizationUnit.findFirstOrThrow({
      where: { id: { startsWith: prefix }, kind: 'ORGANIZATION' },
    });
    await expect(
      prisma.organizationUnit.delete({ where: { id: organization.id } }),
    ).rejects.toThrow();
  });
});
