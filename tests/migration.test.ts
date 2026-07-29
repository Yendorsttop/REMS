import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('RED-001 migration artifact', () => {
  it('creates all governed records and foreign keys', () => {
    const sql = readFileSync(
      'packages/database/prisma/migrations/20260729000000_red_001_foundation/migration.sql',
      'utf8',
    );
    for (const table of [
      'ExecutiveIdentity',
      'OrganizationUnit',
      'Membership',
      'PermissionAssignment',
      'AuditEvent',
    ])
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    expect(sql.match(/FOREIGN KEY/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
