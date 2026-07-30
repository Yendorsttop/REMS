import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  DisplayName,
  ExecutiveId,
  ExecutiveIdentity,
  type AuditEvent,
  type AuditEventPort,
  type AuthorizationContext,
  type AuthorizationPort,
  type ExecutiveIdentityRepository,
  type Membership,
  type OrganizationRepository,
  type OrganizationUnit,
  type PermissionAssignment,
  type PersistenceTransactionPort,
} from '@rems/red-001';

export const RED_001_DATABASE_BOUNDARY = 'red-001' as const;
export const SECURITY_EVIDENCE_BOUNDARY = 'system-security-evidence' as const;
export const SECURITY_REASON_CODES = [
  'MISSING_BEARER_TOKEN',
  'MALFORMED_TOKEN',
  'INVALID_SIGNATURE',
  'UNKNOWN_SIGNING_KEY',
  'DISALLOWED_ALGORITHM',
  'WRONG_ISSUER',
  'WRONG_AUDIENCE',
  'EXPIRED_TOKEN',
  'FUTURE_NOT_BEFORE',
  'MISSING_SUBJECT',
  'UNKNOWN_OR_UNLINKED_SUBJECT',
  'INACTIVE_LINK',
  'INACTIVE_EXECUTIVE_IDENTITY',
  'SUSPENDED_EXECUTIVE_IDENTITY',
  'PROVIDER_AUTHORITY_ELEVATION',
  'VERIFICATION_NOT_CONFIGURED',
  'OTHER_GOVERNED_REJECTION',
] as const;
export type SecurityReasonCode = (typeof SECURITY_REASON_CODES)[number];
export type SecurityEvidence = Readonly<{
  eventType: 'AUTHENTICATION_REJECTED' | 'AUTHORITY_ELEVATION_REJECTED';
  reasonCode: SecurityReasonCode;
  correlationId: string;
}>;
export interface SecurityEvidencePort {
  append(event: SecurityEvidence): Promise<void>;
}
type DatabaseClient = PrismaClient | Prisma.TransactionClient;
type IdentityRecord = {
  id: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  externalSubject: string | null;
};
type MembershipRecord = {
  id: string;
  executiveId: string;
  unitId: string;
  role: 'FOUNDER' | 'EXECUTIVE' | 'MANAGER' | 'MEMBER';
  managerExecutiveId: string | null;
};
type PermissionRecord = {
  id: string;
  executiveId: string;
  permission: string;
  organizationUnitId: string | null;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Injectable()
export class PrismaTransactionContext implements PersistenceTransactionPort {
  private readonly storage = new AsyncLocalStorage<Prisma.TransactionClient>();
  constructor(private readonly prisma: PrismaService) {}
  get client(): DatabaseClient {
    return this.storage.getStore() ?? this.prisma;
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) return operation();
    return this.prisma.$transaction((client: Prisma.TransactionClient) =>
      this.storage.run(client, operation),
    );
  }
}

@Injectable()
export class PrismaExecutiveIdentityRepository implements ExecutiveIdentityRepository {
  constructor(private readonly context: PrismaTransactionContext) {}
  private rehydrate(record: IdentityRecord): ExecutiveIdentity {
    return ExecutiveIdentity.rehydrate({
      id: ExecutiveId.create(record.id),
      displayName: DisplayName.create(record.displayName),
      status: record.status,
      ...(record.externalSubject !== null ? { externalSubject: record.externalSubject } : {}),
    });
  }
  async findById(id: string): Promise<ExecutiveIdentity | null> {
    const record = await this.context.client.executiveIdentity.findUnique({ where: { id } });
    return record ? this.rehydrate(record) : null;
  }
  async findByExternalSubject(subject: string): Promise<ExecutiveIdentity | null> {
    const record = await this.context.client.executiveIdentity.findUnique({
      where: { externalSubject: subject },
    });
    return record ? this.rehydrate(record) : null;
  }
  async save(identity: ExecutiveIdentity): Promise<void> {
    const value = identity.snapshot;
    await this.context.client.executiveIdentity.upsert({
      where: { id: value.id },
      create: value,
      update: {
        displayName: value.displayName,
        status: value.status,
        externalSubject: value.externalSubject ?? null,
      },
    });
  }
  async list(): Promise<ExecutiveIdentity[]> {
    const records = await this.context.client.executiveIdentity.findMany({
      orderBy: { id: 'asc' },
    });
    return records.map((record: IdentityRecord) => this.rehydrate(record));
  }
}

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly context: PrismaTransactionContext) {}
  async saveUnit(unit: OrganizationUnit): Promise<void> {
    await this.context.client.organizationUnit.upsert({
      where: { id: unit.id },
      create: { ...unit, parentId: unit.parentId ?? null },
      update: { name: unit.name, kind: unit.kind, parentId: unit.parentId ?? null },
    });
  }
  async findUnit(id: string): Promise<OrganizationUnit | null> {
    const unit = await this.context.client.organizationUnit.findUnique({ where: { id } });
    return unit
      ? {
          id: unit.id,
          name: unit.name,
          kind: unit.kind,
          ...(unit.parentId !== null ? { parentId: unit.parentId } : {}),
        }
      : null;
  }
  async saveMembership(value: Membership): Promise<void> {
    await this.context.client.membership.upsert({
      where: { id: value.id },
      create: { ...value, managerExecutiveId: value.managerExecutiveId ?? null },
      update: {
        executiveId: value.executiveId,
        unitId: value.unitId,
        role: value.role,
        managerExecutiveId: value.managerExecutiveId ?? null,
      },
    });
  }
  async membershipsFor(executiveId: string): Promise<Membership[]> {
    const records = await this.context.client.membership.findMany({
      where: { executiveId },
      orderBy: { id: 'asc' },
    });
    return records.map((value: MembershipRecord) => ({
      id: value.id,
      executiveId: value.executiveId,
      unitId: value.unitId,
      role: value.role,
      ...(value.managerExecutiveId !== null
        ? { managerExecutiveId: value.managerExecutiveId }
        : {}),
    }));
  }
  async savePermission(value: PermissionAssignment): Promise<void> {
    await this.context.client.permissionAssignment.upsert({
      where: { id: value.id },
      create: { ...value, organizationUnitId: value.organizationUnitId ?? null },
      update: {
        executiveId: value.executiveId,
        permission: value.permission,
        organizationUnitId: value.organizationUnitId ?? null,
      },
    });
  }
  async permissionsFor(executiveId: string): Promise<PermissionAssignment[]> {
    const records = await this.context.client.permissionAssignment.findMany({
      where: { executiveId },
      orderBy: { id: 'asc' },
    });
    return records.map((value: PermissionRecord) => ({
      id: value.id,
      executiveId: value.executiveId,
      permission: value.permission,
      ...(value.organizationUnitId !== null
        ? { organizationUnitId: value.organizationUnitId }
        : {}),
    }));
  }
}

@Injectable()
export class PrismaAuditEventPort implements AuditEventPort {
  constructor(private readonly context: PrismaTransactionContext) {}
  async append(event: AuditEvent): Promise<void> {
    await this.context.client.auditEvent.create({
      data: {
        ...event,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload as never,
      },
    });
  }
}

@Injectable()
export class PrismaSecurityEvidencePort implements SecurityEvidencePort {
  constructor(private readonly prisma: PrismaService) {}
  async append(event: SecurityEvidence): Promise<void> {
    await this.prisma.systemSecurityEvidence.create({
      data: {
        id: randomUUID(),
        occurredAt: new Date(),
        eventType: event.eventType,
        outcome: 'DENIED',
        reasonCode: event.reasonCode,
        correlationId: event.correlationId.slice(0, 128),
      },
    });
  }
}

@Injectable()
export class PrismaAuthorizationPort implements AuthorizationPort {
  constructor(private readonly organizations: PrismaOrganizationRepository) {}
  async contextFor(actorId: string): Promise<AuthorizationContext> {
    const assignments = await this.organizations.permissionsFor(actorId);
    return { actorId, permissions: new Set(assignments.map(({ permission }) => permission)) };
  }
}

@Injectable()
export class PrismaExternalIdentityResolver {
  constructor(private readonly context: PrismaTransactionContext) {}
  async resolve(issuer: string, subject: string): Promise<string | null> {
    const links = await this.context.client.$queryRaw<Array<{ executiveId: string }>>`
      SELECT link."executiveId"
      FROM "ExternalIdentityLink" link
      JOIN "ExecutiveIdentity" executive ON executive.id = link."executiveId"
      WHERE link.issuer = ${issuer} AND link.subject = ${subject}
        AND link.active = true AND executive.status = 'ACTIVE'
      LIMIT 1`;
    return links[0]?.executiveId ?? null;
  }
  async resolveForAuthentication(
    issuer: string,
    subject: string,
  ): Promise<
    | { executiveId: string }
    | {
        reason:
          | 'UNKNOWN_OR_UNLINKED_SUBJECT'
          | 'INACTIVE_LINK'
          | 'INACTIVE_EXECUTIVE_IDENTITY'
          | 'SUSPENDED_EXECUTIVE_IDENTITY';
      }
  > {
    const rows = await this.context.client.$queryRaw<
      Array<{ executiveId: string; active: boolean; status: string }>
    >`
      SELECT link."executiveId", link.active, executive.status::text
      FROM "ExternalIdentityLink" link JOIN "ExecutiveIdentity" executive ON executive.id = link."executiveId"
      WHERE link.issuer = ${issuer} AND link.subject = ${subject} LIMIT 1`;
    const row = rows[0];
    if (!row) return { reason: 'UNKNOWN_OR_UNLINKED_SUBJECT' };
    if (!row.active) return { reason: 'INACTIVE_LINK' };
    if (row.status === 'SUSPENDED') return { reason: 'SUSPENDED_EXECUTIVE_IDENTITY' };
    if (row.status !== 'ACTIVE') return { reason: 'INACTIVE_EXECUTIVE_IDENTITY' };
    return { executiveId: row.executiveId };
  }
}
