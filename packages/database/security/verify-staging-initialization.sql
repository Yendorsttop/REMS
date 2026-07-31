\set ON_ERROR_STOP on
SELECT (
  (SELECT count(*) = 8 FROM pg_tables WHERE schemaname = 'public' AND tablename IN
    ('_prisma_migrations','ExecutiveIdentity','OrganizationUnit','Membership','PermissionAssignment','AuditEvent','ExternalIdentityLink','SystemSecurityEvidence')
    AND tableowner = 'rems_migration_owner')
  AND (SELECT count(*) = 3 FROM pg_type WHERE typnamespace = 'public'::regnamespace
    AND typname IN ('IdentityStatus','OrganizationUnitKind','OrganizationRole')
    AND pg_get_userbyid(typowner) = 'rems_migration_owner')
  AND has_table_privilege('rems_application','public."AuditEvent"','SELECT,INSERT')
  AND NOT has_table_privilege('rems_application','public."AuditEvent"','UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_application','public."SystemSecurityEvidence"','INSERT')
  AND NOT has_table_privilege('rems_application','public."SystemSecurityEvidence"','SELECT,UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_application','public."ExternalIdentityLink"','SELECT')
  AND NOT has_table_privilege('rems_application','public."ExternalIdentityLink"','INSERT,UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_audit_reader','public."AuditEvent"','SELECT')
  AND NOT has_table_privilege('rems_audit_reader','public."AuditEvent"','INSERT,UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_security_reader','public."SystemSecurityEvidence"','SELECT')
  AND NOT has_table_privilege('rems_security_reader','public."SystemSecurityEvidence"','INSERT,UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_backup','public."ExternalIdentityLink"','SELECT')
  AND NOT has_table_privilege('rems_backup','public."ExternalIdentityLink"','INSERT,UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_founder_bootstrap','public."ExecutiveIdentity"','SELECT,INSERT')
  AND NOT has_table_privilege('rems_founder_bootstrap','public."ExecutiveIdentity"','UPDATE,DELETE,TRUNCATE')
  AND has_table_privilege('rems_identity_admin','public."ExternalIdentityLink"','SELECT,INSERT,UPDATE,DELETE')
  AND NOT pg_has_role('rems_application','rems_migration_owner','MEMBER')
  AND NOT pg_has_role('rems_application','rems_emergency_admin','MEMBER')
  AND NOT EXISTS (
    SELECT FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
    WHERE n.nspname = 'public' AND acl.grantee = 0 AND acl.privilege_type = 'CREATE'
  )
  AND NOT EXISTS (
    SELECT FROM pg_database d, LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) acl
    WHERE d.datname = current_database() AND acl.grantee = 0 AND acl.privilege_type IN ('CONNECT','TEMPORARY')
  )
  AND NOT EXISTS (SELECT FROM information_schema.role_table_grants WHERE grantee = 'PUBLIC' AND table_schema = 'public')
  AND (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'rems_founder_bootstrap')
)::text;
