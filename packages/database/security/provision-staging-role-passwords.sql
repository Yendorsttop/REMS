-- Additive credential provisioning for the controlled staging initializer only.
-- Values enter psql through its process environment and are never stored here.
\set ON_ERROR_STOP on
\set QUIET on
\getenv migration_password REMS_STAGING_MIGRATION_ROLE_PASSWORD
\getenv application_password REMS_STAGING_APPLICATION_ROLE_PASSWORD
\getenv audit_reader_password REMS_STAGING_AUDIT_READER_ROLE_PASSWORD
\getenv emergency_admin_password REMS_STAGING_EMERGENCY_ADMIN_ROLE_PASSWORD
\getenv founder_bootstrap_password REMS_STAGING_FOUNDER_BOOTSTRAP_ROLE_PASSWORD
\getenv identity_admin_password REMS_STAGING_IDENTITY_ADMIN_ROLE_PASSWORD
\getenv security_reader_password REMS_STAGING_SECURITY_READER_ROLE_PASSWORD
\getenv backup_password REMS_STAGING_BACKUP_ROLE_PASSWORD

SELECT format('ALTER ROLE rems_migration_owner PASSWORD %L', :'migration_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_migration_owner') \gexec
SELECT format('ALTER ROLE rems_application PASSWORD %L', :'application_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_application') \gexec
SELECT format('ALTER ROLE rems_audit_reader PASSWORD %L', :'audit_reader_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_audit_reader') \gexec
SELECT format('ALTER ROLE rems_emergency_admin PASSWORD %L', :'emergency_admin_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_emergency_admin') \gexec
SELECT format('ALTER ROLE rems_founder_bootstrap PASSWORD %L', :'founder_bootstrap_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_founder_bootstrap') \gexec
SELECT format('ALTER ROLE rems_identity_admin PASSWORD %L', :'identity_admin_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_identity_admin') \gexec
SELECT format('ALTER ROLE rems_security_reader PASSWORD %L', :'security_reader_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_security_reader') \gexec
SELECT format('ALTER ROLE rems_backup PASSWORD %L', :'backup_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'rems_backup') \gexec
