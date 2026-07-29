import { describe, expect, it } from 'vitest';
import { DisplayName, DomainError, ExecutiveId, ExecutiveIdentity } from './index.js';
describe('executive identity lifecycle', () => {
  it('normalizes names and follows active-suspended-active-deactivated lifecycle', () => {
    let identity = ExecutiveIdentity.create(
      ExecutiveId.create('synthetic-executive'),
      DisplayName.create('  Synthetic Executive  '),
    );
    expect(identity.snapshot).toMatchObject({
      displayName: 'Synthetic Executive',
      status: 'ACTIVE',
    });
    identity = identity.suspend().reactivate().deactivate();
    expect(identity.snapshot.status).toBe('DEACTIVATED');
  });
  it('rejects illegal transitions', () => {
    const identity = ExecutiveIdentity.create(
      ExecutiveId.create('synthetic-executive'),
      DisplayName.create('Synthetic Executive'),
    ).deactivate();
    expect(() => identity.reactivate()).toThrow(DomainError);
  });
});
