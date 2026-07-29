import type {
  AuditEvent,
  AuditEventPort,
  AuthorizationContext,
  AuthorizationPort,
  ExecutiveIdentity,
  ExecutiveIdentityRepository,
  Membership,
  OrganizationRepository,
  OrganizationUnit,
  PermissionAssignment,
} from '@rems/red-001';
export class InMemoryExecutiveIdentityRepository implements ExecutiveIdentityRepository {
  readonly records = new Map<string, ExecutiveIdentity>();
  async findById(id: string) {
    return this.records.get(id) ?? null;
  }
  async findByExternalSubject(subject: string) {
    return [...this.records.values()].find((x) => x.snapshot.externalSubject === subject) ?? null;
  }
  async save(identity: ExecutiveIdentity) {
    this.records.set(identity.snapshot.id, identity);
  }
  async list() {
    return [...this.records.values()];
  }
}
export class InMemoryOrganizationRepository implements OrganizationRepository {
  readonly units = new Map<string, OrganizationUnit>();
  readonly memberships: Membership[] = [];
  readonly permissions: PermissionAssignment[] = [];
  async saveUnit(unit: OrganizationUnit) {
    this.units.set(unit.id, unit);
  }
  async findUnit(id: string) {
    return this.units.get(id) ?? null;
  }
  async saveMembership(value: Membership) {
    this.memberships.push(value);
  }
  async membershipsFor(id: string) {
    return this.memberships.filter((x) => x.executiveId === id);
  }
  async savePermission(value: PermissionAssignment) {
    this.permissions.push(value);
  }
  async permissionsFor(id: string) {
    return this.permissions.filter((x) => x.executiveId === id);
  }
}
export class InMemoryAuditEventPort implements AuditEventPort {
  readonly events: AuditEvent[] = [];
  async append(event: AuditEvent) {
    this.events.push(Object.freeze({ ...event }));
  }
}
export class StaticAuthorizationPort implements AuthorizationPort {
  constructor(private readonly contexts: ReadonlyMap<string, ReadonlySet<string>>) {}
  async contextFor(actorId: string): Promise<AuthorizationContext> {
    return { actorId, permissions: this.contexts.get(actorId) ?? new Set() };
  }
}
