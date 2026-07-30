-- Additive administrative bootstrap. Run only as a cluster/database administrator
-- after migrations. Credential provisioning remains external to this repository.
\set ON_ERROR_STOP on
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_backup') THEN
    CREATE ROLE rems_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$bootstrap$;
SELECT format('GRANT CONNECT ON DATABASE %I TO rems_backup', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO rems_backup;
REVOKE CREATE ON SCHEMA public FROM rems_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rems_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO rems_backup;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM rems_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public GRANT SELECT ON TABLES TO rems_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE rems_migration_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO rems_backup;
