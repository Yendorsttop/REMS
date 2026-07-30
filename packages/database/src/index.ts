import { AsyncLocalStorage } from 'node:async_hooks';
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
export class PrismaAuthorizationPort implements AuthorizationPort {
  constructor(private readonly organizations: PrismaOrganizationRepository) {}
  async contextFor(actorId: string): Promise<AuthorizationContext> {
    const assignments = await this.organizations.permissionsFor(actorId);
    return { actorId, permissions: new Set(assignments.map(({ permission }) => permission)) };
  }
}
