-- Additive FIP-005E administrative role bootstrap. Run separately as a cluster
-- administrator. Credential creation and custody remain outside this repository.
\set ON_ERROR_STOP on

DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_founder_bootstrap') THEN
    CREATE ROLE rems_founder_bootstrap LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_identity_admin') THEN
    CREATE ROLE rems_identity_admin LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$bootstrap$;

SELECT format('GRANT CONNECT ON DATABASE %I TO rems_founder_bootstrap, rems_identity_admin', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO rems_founder_bootstrap, rems_identity_admin;
