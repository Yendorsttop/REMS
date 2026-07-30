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

  it('keeps FIP-005E identity administration separate and audit append-only', () => {
    const sql = readFileSync(
      'packages/database/prisma/migrations/20260730020000_fip_005e_founder_identity_governance/migration.sql',
      'utf8',
    );
    expect(sql).toContain('SELECT, INSERT, UPDATE, DELETE ON TABLE "ExternalIdentityLink"');
    expect(sql).toContain('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent"');
    expect(sql).toContain('REVOKE TRUNCATE ON TABLE "ExternalIdentityLink"');
    expect(sql).toContain('REVOKE ALL ON TABLE "ExternalIdentityLink" FROM rems_audit_reader');
    expect(sql).toContain('TO rems_founder_bootstrap');
    expect(sql).toContain('PermissionAssignment" FROM rems_identity_admin');
    expect(sql).not.toMatch(/OWNER TO rems_identity_admin/);
    expect(sql).not.toMatch(/OWNER TO rems_founder_bootstrap/);
  });

  it('adds constrained actor-free FIP-005F evidence without changing prior migrations', () => {
    const sql = readFileSync(
      'packages/database/prisma/migrations/20260730030000_fip_005f_security_evidence/migration.sql',
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE "SystemSecurityEvidence"');
    expect(sql).toContain('OWNER TO rems_migration_owner');
    expect(sql).toContain('GRANT INSERT ON TABLE "SystemSecurityEvidence" TO rems_application');
    expect(sql).toContain('REVOKE SELECT, UPDATE, DELETE, TRUNCATE');
    expect(sql).not.toMatch(/"(actorId|email|token|claims|authorization)"\s+/i);
  });
});
