import { describe, expect, it } from 'vitest';
import { Red001Service } from './index.js';
import {
  InMemoryAuditEventPort,
  InMemoryExecutiveIdentityRepository,
  InMemoryOrganizationRepository,
  StaticAuthorizationPort,
} from '../../testing/src/index.js';
const all = new Set([
  'red001.identity.create',
  'red001.identity.lifecycle',
  'red001.identity.read',
  'red001.organization.manage',
  'red001.membership.manage',
  'red001.authorization.manage',
]);
describe('RED-001 application service', () => {
  it('enforces authorization and records identity and organizational decisions', async () => {
    const identities = new InMemoryExecutiveIdentityRepository();
    const orgs = new InMemoryOrganizationRepository();
    const audit = new InMemoryAuditEventPort();
    const service = new Red001Service(
      identities,
      orgs,
      audit,
      new StaticAuthorizationPort(new Map([['synthetic-founder', all]])),
      () => `event-${audit.events.length + 1}`,
      () => new Date('2026-01-01T00:00:00Z'),
    );
    await service.createIdentity('synthetic-founder', {
      id: 'synthetic-executive',
      displayName: 'Synthetic Executive',
    });
    await service.createUnit('synthetic-founder', {
      id: 'synthetic-org',
      name: 'Synthetic Organization',
      kind: 'ORGANIZATION',
    });
    await service.assignMembership('synthetic-founder', {
      id: 'synthetic-membership',
      executiveId: 'synthetic-executive',
      unitId: 'synthetic-org',
      role: 'EXECUTIVE',
    });
    expect(audit.events).toHaveLength(3);
    expect((await orgs.membershipsFor('synthetic-executive'))[0]?.role).toBe('EXECUTIVE');
  });
  it('denies unauthorized commands', async () => {
    const service = new Red001Service(
      new InMemoryExecutiveIdentityRepository(),
      new InMemoryOrganizationRepository(),
      new InMemoryAuditEventPort(),
      new StaticAuthorizationPort(new Map()),
    );
    await expect(
      service.createIdentity('unknown', {
        id: 'synthetic-executive',
        displayName: 'Synthetic Executive',
      }),
    ).rejects.toThrow('Missing permission');
  });
});
