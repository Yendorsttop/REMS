-- Controlled post-restoration grant reconciliation. Run as rems_migration_owner
-- only after the administrative role bootstraps have recreated cluster roles.
-- Native dumps deliberately omit ACLs; this artifact reapplies the exact ordinary
-- role boundaries without granting ownership or restoration authority.
\set ON_ERROR_STOP on

DO $preflight$
DECLARE
  governed_table text;
BEGIN
  IF current_user <> 'rems_migration_owner' THEN
    RAISE EXCEPTION 'Restored grants must be reconciled by rems_migration_owner';
  END IF;
  FOREACH governed_table IN ARRAY ARRAY[
    '_prisma_migrations',
    'ExecutiveIdentity',
    'OrganizationUnit',
    'Membership',
    'PermissionAssignment',
    'AuditEvent',
    'ExternalIdentityLink',
    'SystemSecurityEvidence'
  ]
  LOOP
    IF (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = governed_table)
      IS DISTINCT FROM 'rems_migration_owner' THEN
      RAISE EXCEPTION 'A required restored table is missing or has unsafe ownership';
    END IF;
  END LOOP;
END
$preflight$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM
  rems_application, rems_audit_reader, rems_founder_bootstrap,
  rems_identity_admin, rems_security_reader;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM
  rems_application, rems_audit_reader, rems_founder_bootstrap,
  rems_identity_admin, rems_security_reader;

GRANT USAGE ON SCHEMA public TO
  rems_application, rems_audit_reader, rems_founder_bootstrap,
  rems_identity_admin, rems_security_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "ExecutiveIdentity", "OrganizationUnit", "Membership", "PermissionAssignment"
TO rems_application;
GRANT SELECT, INSERT ON TABLE "AuditEvent" TO rems_application;
GRANT SELECT ON TABLE "ExternalIdentityLink" TO rems_application;
GRANT INSERT ON TABLE "SystemSecurityEvidence" TO rems_application;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rems_application;

GRANT SELECT ON TABLE "AuditEvent" TO rems_audit_reader;

GRANT SELECT, INSERT ON TABLE
  "ExecutiveIdentity", "OrganizationUnit", "Membership",
  "ExternalIdentityLink", "AuditEvent"
TO rems_founder_bootstrap;
GRANT SELECT ON TABLE "_prisma_migrations" TO rems_founder_bootstrap;

GRANT SELECT ON TABLE
  "ExecutiveIdentity", "OrganizationUnit", "Membership",
  "PermissionAssignment", "ExternalIdentityLink", "AuditEvent"
TO rems_identity_admin;
GRANT INSERT, UPDATE, DELETE ON TABLE "ExternalIdentityLink" TO rems_identity_admin;
GRANT INSERT ON TABLE "AuditEvent" TO rems_identity_admin;

GRANT SELECT ON TABLE "SystemSecurityEvidence" TO rems_security_reader;

ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rems_application;
ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rems_application;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditEvent"
  FROM rems_application, rems_audit_reader, rems_founder_bootstrap, rems_identity_admin;
REVOKE INSERT ON TABLE "AuditEvent" FROM rems_audit_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "ExternalIdentityLink" FROM rems_application;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON TABLE "SystemSecurityEvidence" FROM rems_application;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "SystemSecurityEvidence" FROM rems_security_reader;
