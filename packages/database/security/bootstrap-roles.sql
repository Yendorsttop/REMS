-- Administrative bootstrap for PostgreSQL roles. Run as a database superuser or
-- equivalent cluster administrator, separately from Prisma migrations.
-- No passwords are defined here; approved deployment tooling must inject them.
\set ON_ERROR_STOP on

DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_migration_owner') THEN
    CREATE ROLE rems_migration_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_application') THEN
    CREATE ROLE rems_application LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_audit_reader') THEN
    CREATE ROLE rems_audit_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_emergency_admin') THEN
    CREATE ROLE rems_emergency_admin LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$bootstrap$;

-- Emergency use is procedural, Founder-authorized recovery. Membership permits
-- an explicitly authenticated emergency administrator to SET ROLE to the owner;
-- it is not an application credential and does not defeat PostgreSQL superusers.
GRANT rems_migration_owner TO rems_emergency_admin;

-- Upgrade path: objects created by a pre-FIP-005C migrator must be transferred
-- by the administrator before Prisma reconnects as rems_migration_owner. The
-- same block is a no-op when bootstrapping a fresh database before migrations.
DO $ownership$
DECLARE
  object_name text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY[
    '_prisma_migrations',
    'ExecutiveIdentity',
    'OrganizationUnit',
    'Membership',
    'PermissionAssignment',
    'AuditEvent'
  ]
  LOOP
    IF to_regclass(format('public.%I', object_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I OWNER TO rems_migration_owner', object_name);
    END IF;
  END LOOP;

  FOREACH object_name IN ARRAY ARRAY[
    'IdentityStatus',
    'OrganizationUnitKind',
    'OrganizationRole'
  ]
  LOOP
    IF to_regtype(format('public.%I', object_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TYPE public.%I OWNER TO rems_migration_owner', object_name);
    END IF;
  END LOOP;
END
$ownership$;

SELECT format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO rems_migration_owner', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO rems_application, rems_audit_reader, rems_emergency_admin', current_database()) \gexec
GRANT USAGE, CREATE ON SCHEMA public TO rems_migration_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
