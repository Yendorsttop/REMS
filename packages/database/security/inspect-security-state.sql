-- Deterministic metadata projection used only to compare fresh and upgrade CI paths.
SELECT 'table', tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ExecutiveIdentity', 'OrganizationUnit', 'Membership', 'PermissionAssignment', 'AuditEvent', 'ExternalIdentityLink', 'SystemSecurityEvidence')
ORDER BY tablename;

SELECT 'privilege', role_name, table_name, privilege,
       has_table_privilege(role_name, format('public.%I', table_name), privilege)
FROM unnest(ARRAY['rems_application', 'rems_audit_reader', 'rems_founder_bootstrap', 'rems_identity_admin', 'rems_security_reader']) AS role_name,
     unnest(ARRAY['ExecutiveIdentity', 'OrganizationUnit', 'Membership', 'PermissionAssignment', 'AuditEvent', 'ExternalIdentityLink', 'SystemSecurityEvidence']) AS table_name,
     unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege
ORDER BY role_name, table_name, privilege;

SELECT 'type', typname, pg_get_userbyid(typowner)
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typname IN ('IdentityStatus', 'OrganizationUnitKind', 'OrganizationRole')
ORDER BY typname;

SELECT 'schema', role_name,
       has_schema_privilege(role_name, 'public', 'USAGE'),
       has_schema_privilege(role_name, 'public', 'CREATE')
FROM unnest(ARRAY['rems_application', 'rems_audit_reader', 'rems_founder_bootstrap', 'rems_identity_admin', 'rems_security_reader', 'rems_migration_owner']) AS role_name
ORDER BY role_name;
