import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';

const root = new URL('../../../', import.meta.url);
const required = [
  'REMS_STAGING_ADMIN_DATABASE_URL',
  'REMS_STAGING_MIGRATION_DATABASE_URL',
  'REMS_STAGING_APPLICATION_DATABASE_URL',
  'REMS_STAGING_MIGRATION_ROLE_PASSWORD',
  'REMS_STAGING_APPLICATION_ROLE_PASSWORD',
  'REMS_STAGING_AUDIT_READER_ROLE_PASSWORD',
  'REMS_STAGING_EMERGENCY_ADMIN_ROLE_PASSWORD',
  'REMS_STAGING_FOUNDER_BOOTSTRAP_ROLE_PASSWORD',
  'REMS_STAGING_IDENTITY_ADMIN_ROLE_PASSWORD',
  'REMS_STAGING_SECURITY_READER_ROLE_PASSWORD',
  'REMS_STAGING_BACKUP_ROLE_PASSWORD',
];
const fail = (message) => {
  process.stderr.write(`Staging initialization failed: ${message}\n`);
  process.exit(1);
};
for (const name of required)
  if (!process.env[name]) fail(`required environment secret ${name} is absent`);

function parse(name, expectedUser) {
  let url;
  try {
    url = new URL(process.env[name]);
  } catch {
    fail(`${name} is not a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail(`${name} is not PostgreSQL`);
  if (decodeURIComponent(url.pathname.slice(1)) !== 'rems_staging')
    fail(`${name} does not select rems_staging`);
  const username = decodeURIComponent(url.username);
  if (expectedUser && username !== expectedUser) fail(`${name} does not use its governed role`);
  return { url, username };
}
const governed = new Set([
  'rems_migration_owner',
  'rems_application',
  'rems_audit_reader',
  'rems_emergency_admin',
  'rems_founder_bootstrap',
  'rems_identity_admin',
  'rems_security_reader',
  'rems_backup',
]);
const admin = parse('REMS_STAGING_ADMIN_DATABASE_URL');
if (governed.has(admin.username)) fail('administrative connection uses a REMS specialized role');
const migration = parse('REMS_STAGING_MIGRATION_DATABASE_URL', 'rems_migration_owner');
const application = parse('REMS_STAGING_APPLICATION_DATABASE_URL', 'rems_application');

function pgEnv(connection) {
  return {
    ...process.env,
    PGHOST: connection.url.hostname,
    PGPORT: connection.url.port || '5432',
    PGDATABASE: decodeURIComponent(connection.url.pathname.slice(1)),
    PGUSER: connection.username,
    PGPASSWORD: decodeURIComponent(connection.url.password),
    PGSSLMODE: connection.url.searchParams.get('sslmode') || 'require',
  };
}
function run(command, args, env, input, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    input,
    encoding: 'utf8',
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'ignore', 'ignore'],
  });
  if (result.status !== 0)
    fail(
      `controlled ${command} step was rejected; inspect provider authority without weakening REMS roles`,
    );
  return (result.stdout || '').trim();
}
const psql = (connection, args, input, capture) =>
  run(
    '/usr/lib/postgresql/17/bin/psql',
    ['-X', '-v', 'ON_ERROR_STOP=1', ...args],
    pgEnv(connection),
    input,
    capture,
  );

if (
  !run('/usr/lib/postgresql/17/bin/psql', ['--version'], process.env, undefined, true).startsWith(
    'psql (PostgreSQL) 17.',
  )
)
  fail('PostgreSQL 17 client is required');
const authority = psql(
  admin,
  [
    '-Atc',
    "SELECT current_database() = 'rems_staging' AND current_user = session_user AND (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user)",
  ],
  undefined,
  true,
);
if (authority !== 't')
  fail('provider administrative principal lacks required role-creation authority');
process.stdout.write('Sanitized preflight passed.\n');

const security = (name) => new URL(`security/${name}`, new URL('../', import.meta.url)).pathname;
psql(admin, ['-f', security('bootstrap-roles.sql')]);
psql(admin, ['-f', security('bootstrap-identity-admin-role.sql')]);
psql(admin, ['-f', security('provision-staging-role-passwords.sql')]);
process.stdout.write('Administrative base-role bootstrap completed.\n');

run('pnpm', ['--filter', '@rems/database', 'prisma:migrate:deploy'], {
  ...process.env,
  DATABASE_URL: process.env.REMS_STAGING_MIGRATION_DATABASE_URL,
});
process.stdout.write('Immutable Prisma migrations applied by rems_migration_owner.\n');
psql(admin, ['-f', security('bootstrap-security-reader-role.sql')]);
psql(admin, ['-f', security('bootstrap-backup-role.sql')]);
psql(admin, ['-f', security('provision-staging-role-passwords.sql')]);

const verification = psql(
  admin,
  ['-Atf', security('verify-staging-initialization.sql')],
  undefined,
  true,
);
if (verification !== 'true') fail('governed security-state verification did not pass');
const migrationsDir = new URL('../prisma/migrations/', import.meta.url);
const expected = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort()
  .map((entry) => {
    const sql = readFileSync(new URL(`${entry.name}/migration.sql`, migrationsDir));
    return [entry.name, createHash('sha256').update(sql).digest('hex')];
  });
const rows = psql(
  migration,
  [
    '-AtF',
    '|',
    '-c',
    'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  ],
  undefined,
  true,
)
  .split('\n')
  .filter(Boolean)
  .map((row) => row.split('|'));
if (JSON.stringify(rows) !== JSON.stringify(expected))
  fail('migration set or an immutable migration checksum differs');
const appIdentity = psql(application, ['-Atc', 'SELECT current_user'], undefined, true);
if (appIdentity !== 'rems_application') fail('application connection authentication failed');
process.stdout.write(
  'Sanitized post-migration verification passed; no Founder ceremony or lockdown was performed.\n',
);
