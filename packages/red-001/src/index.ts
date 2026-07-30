export type IdentityStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type OrganizationUnitKind = 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM';
export type OrganizationRole = 'FOUNDER' | 'EXECUTIVE' | 'MANAGER' | 'MEMBER';

export class DomainError extends Error {}
export class ExecutiveId {
  private constructor(readonly value: string) {}
  static create(value: string): ExecutiveId {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(value))
      throw new DomainError('Executive id must be a lowercase stable identifier');
    return new ExecutiveId(value);
  }
}
export class DisplayName {
  private constructor(readonly value: string) {}
  static create(value: string): DisplayName {
    const normalized = value.trim();
    if (normalized.length < 2 || normalized.length > 120)
      throw new DomainError('Display name must contain 2 to 120 characters');
    return new DisplayName(normalized);
  }
}
export interface ExecutiveIdentityProps {
  id: ExecutiveId;
  displayName: DisplayName;
  status: IdentityStatus;
  externalSubject?: string;
}
export class ExecutiveIdentity {
  private constructor(private readonly props: ExecutiveIdentityProps) {}
  static create(id: ExecutiveId, name: DisplayName, externalSubject?: string): ExecutiveIdentity {
    return new ExecutiveIdentity({
      id,
      displayName: name,
      status: 'ACTIVE',
      ...(externalSubject ? { externalSubject } : {}),
    });
  }
  static rehydrate(props: ExecutiveIdentityProps): ExecutiveIdentity {
    return new ExecutiveIdentity(props);
  }
  get snapshot(): Readonly<{
    id: string;
    displayName: string;
    status: IdentityStatus;
    externalSubject?: string;
  }> {
    return {
      id: this.props.id.value,
      displayName: this.props.displayName.value,
      status: this.props.status,
      ...(this.props.externalSubject ? { externalSubject: this.props.externalSubject } : {}),
    };
  }
  suspend(): ExecutiveIdentity {
    if (this.props.status !== 'ACTIVE')
      throw new DomainError('Only active identities can be suspended');
    return ExecutiveIdentity.rehydrate({ ...this.props, status: 'SUSPENDED' });
  }
  reactivate(): ExecutiveIdentity {
    if (this.props.status !== 'SUSPENDED')
      throw new DomainError('Only suspended identities can be reactivated');
    return ExecutiveIdentity.rehydrate({ ...this.props, status: 'ACTIVE' });
  }
  deactivate(): ExecutiveIdentity {
    if (this.props.status === 'DEACTIVATED')
      throw new DomainError('Identity is already deactivated');
    return ExecutiveIdentity.rehydrate({ ...this.props, status: 'DEACTIVATED' });
  }
}
export interface OrganizationUnit {
  readonly id: string;
  readonly name: string;
  readonly kind: OrganizationUnitKind;
  readonly parentId?: string;
}
export interface Membership {
  readonly id: string;
  readonly executiveId: string;
  readonly unitId: string;
  readonly role: OrganizationRole;
  readonly managerExecutiveId?: string;
}
export interface PermissionAssignment {
  readonly id: string;
  readonly executiveId: string;
  readonly permission: string;
  readonly organizationUnitId?: string;
}
export interface ExecutiveIdentityRepository {
  findById(id: string): Promise<ExecutiveIdentity | null>;
  findByExternalSubject(subject: string): Promise<ExecutiveIdentity | null>;
  save(identity: ExecutiveIdentity): Promise<void>;
  list(): Promise<ExecutiveIdentity[]>;
}
export interface OrganizationRepository {
  saveUnit(unit: OrganizationUnit): Promise<void>;
  findUnit(id: string): Promise<OrganizationUnit | null>;
  saveMembership(membership: Membership): Promise<void>;
  membershipsFor(executiveId: string): Promise<Membership[]>;
  savePermission(assignment: PermissionAssignment): Promise<void>;
  permissionsFor(executiveId: string): Promise<PermissionAssignment[]>;
}
export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly type: string;
  readonly subjectId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export interface AuditEventPort {
  append(event: AuditEvent): Promise<void>;
}
export interface PersistenceTransactionPort {
  run<T>(operation: () => Promise<T>): Promise<T>;
}
export const directPersistenceTransaction: PersistenceTransactionPort = {
  run: (operation) => operation(),
};
export interface AuthorizationContext {
  readonly actorId: string;
  readonly permissions: ReadonlySet<string>;
}
export interface AuthorizationPort {
  contextFor(actorId: string): Promise<AuthorizationContext>;
}
export interface IdentityProviderPrincipal {
  readonly subject: string;
  readonly issuer: string;
  readonly claims: Readonly<Record<string, unknown>>;
}
export interface IdentityProviderPort {
  verifyBearer(token: string): Promise<IdentityProviderPrincipal>;
}
export type IdGenerator = () => string;
export type Clock = () => Date;
export class Red001Service {
  constructor(
    private readonly identities: ExecutiveIdentityRepository,
    private readonly organizations: OrganizationRepository,
    private readonly audit: AuditEventPort,
    private readonly authorization: AuthorizationPort,
    private readonly id: IdGenerator = () => crypto.randomUUID(),
    private readonly clock: Clock = () => new Date(),
    private readonly transaction: PersistenceTransactionPort = directPersistenceTransaction,
  ) {}
  private async require(actorId: string, permission: string): Promise<void> {
    const context = await this.authorization.contextFor(actorId);
    if (!context.permissions.has(permission))
      throw new DomainError(`Missing permission: ${permission}`);
  }
  async createIdentity(
    actorId: string,
    input: { id: string; displayName: string; externalSubject?: string },
  ): Promise<ExecutiveIdentity> {
    return this.transaction.run(async () => {
      await this.require(actorId, 'red001.identity.create');
      if (await this.identities.findById(input.id))
        throw new DomainError('Executive identity already exists');
      if (
        input.externalSubject &&
        (await this.identities.findByExternalSubject(input.externalSubject))
      )
        throw new DomainError('External subject already assigned');
      const identity = ExecutiveIdentity.create(
        ExecutiveId.create(input.id),
        DisplayName.create(input.displayName),
        input.externalSubject,
      );
      await this.identities.save(identity);
      await this.record(actorId, 'red001.identity.created', input.id, { status: 'ACTIVE' });
      return identity;
    });
  }
  async transitionIdentity(
    actorId: string,
    identityId: string,
    transition: 'suspend' | 'reactivate' | 'deactivate',
  ): Promise<ExecutiveIdentity> {
    return this.transaction.run(async () => {
      await this.require(actorId, 'red001.identity.lifecycle');
      const current = await this.identities.findById(identityId);
      if (!current) throw new DomainError('Executive identity not found');
      const updated =
        transition === 'suspend'
          ? current.suspend()
          : transition === 'reactivate'
            ? current.reactivate()
            : current.deactivate();
      await this.identities.save(updated);
      await this.record(actorId, `red001.identity.${transition}d`, identityId, {});
      return updated;
    });
  }
  async createUnit(actorId: string, unit: OrganizationUnit): Promise<void> {
    await this.transaction.run(async () => {
      await this.require(actorId, 'red001.organization.manage');
      if (unit.parentId && !(await this.organizations.findUnit(unit.parentId)))
        throw new DomainError('Parent organization unit not found');
      await this.organizations.saveUnit(unit);
      await this.record(actorId, 'red001.organization-unit.created', unit.id, { kind: unit.kind });
    });
  }
  async assignMembership(actorId: string, membership: Membership): Promise<void> {
    await this.transaction.run(async () => {
      await this.require(actorId, 'red001.membership.manage');
      if (!(await this.identities.findById(membership.executiveId)))
        throw new DomainError('Executive identity not found');
      if (!(await this.organizations.findUnit(membership.unitId)))
        throw new DomainError('Organization unit not found');
      await this.organizations.saveMembership(membership);
      await this.record(actorId, 'red001.membership.assigned', membership.executiveId, {
        unitId: membership.unitId,
        role: membership.role,
      });
    });
  }
  async assignPermission(actorId: string, assignment: PermissionAssignment): Promise<void> {
    await this.transaction.run(async () => {
      await this.require(actorId, 'red001.authorization.manage');
      if (!(await this.identities.findById(assignment.executiveId)))
        throw new DomainError('Executive identity not found');
      await this.organizations.savePermission(assignment);
      await this.record(actorId, 'red001.permission.assigned', assignment.executiveId, {
        permission: assignment.permission,
      });
    });
  }
  async listIdentities(actorId: string): Promise<ExecutiveIdentity[]> {
    await this.require(actorId, 'red001.identity.read');
    return this.identities.list();
  }
  private async record(
    actorId: string,
    type: string,
    subjectId: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.audit.append({
      id: this.id(),
      occurredAt: this.clock().toISOString(),
      actorId,
      type,
      subjectId,
      payload,
    });
  }
}
