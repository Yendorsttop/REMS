-- Additive administrative bootstrap; run as an authorized cluster administrator.
-- It creates no password and changes no previously committed bootstrap artifact.
\set ON_ERROR_STOP on
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_security_reader') THEN
    CREATE ROLE rems_security_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$bootstrap$;
SELECT format('GRANT CONNECT ON DATABASE %I TO rems_security_reader', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO rems_security_reader;
REVOKE ALL ON TABLE "SystemSecurityEvidence" FROM rems_security_reader;
GRANT SELECT ON TABLE "SystemSecurityEvidence" TO rems_security_reader;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "SystemSecurityEvidence" FROM rems_security_reader;
