-- This migration must be applied as rems_migration_owner after the separate
-- security/bootstrap-roles.sql administrative bootstrap has created the roles.
DO $preflight$
BEGIN
  IF current_user <> 'rems_migration_owner' THEN
    RAISE EXCEPTION 'FIP-005C migration must run as rems_migration_owner after security/bootstrap-roles.sql';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_application')
    OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_audit_reader') THEN
    RAISE EXCEPTION 'FIP-005C roles are missing; run security/bootstrap-roles.sql as an administrator first';
  END IF;
  IF (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'AuditEvent')
    <> 'rems_migration_owner' THEN
    RAISE EXCEPTION 'AuditEvent is not owned by rems_migration_owner; rerun the administrative bootstrap before migration';
  END IF;
END
$preflight$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rems_application, rems_audit_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rems_application, rems_audit_reader;

GRANT USAGE ON SCHEMA public TO rems_application, rems_audit_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "ExecutiveIdentity", "OrganizationUnit", "Membership", "PermissionAssignment"
TO rems_application;
GRANT SELECT, INSERT ON TABLE "AuditEvent" TO rems_application;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rems_application;

GRANT SELECT ON TABLE "AuditEvent" TO rems_audit_reader;

-- Future objects created by the migration owner retain the same least-privilege
-- posture. Audit-table grants remain explicit and are never included here.
ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rems_application;
ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rems_application;

-- Explicit revocation documents and enforces the append-only boundary even if a
-- role previously received broader table rights. TRUNCATE is a separate privilege.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent" FROM rems_application, rems_audit_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent" FROM rems_audit_reader;
