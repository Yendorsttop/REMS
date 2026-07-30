export type RuntimeEnvironment = 'development' | 'test' | 'production';
export interface RuntimeConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly trustedProxy: false | number;
  readonly logLevel: string;
  readonly oidcIssuer?: string;
  readonly oidcAudience?: string;
  readonly oidcAlgorithms: readonly string[];
  readonly databaseUrl?: string;
}

const administrativeRoles = new Set([
  'rems_migration_owner',
  'rems_audit_reader',
  'rems_security_reader',
  'rems_identity_admin',
  'rems_founder_bootstrap',
  'rems_backup',
  'rems_emergency_admin',
]);
const placeholders = /(?:change[-_]?me|example|placeholder|todo|your[-_]|<[^>]+>)/i;
const fail = (name: string): never => {
  throw new Error(`Unsafe or invalid ${name}`);
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const runtime = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(runtime)) fail('NODE_ENV');
  const production = runtime === 'production';
  const host = environment.HOST ?? (production ? '' : '127.0.0.1');
  const portText = environment.PORT ?? '3001';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT');
  if (!host || placeholders.test(host)) fail('HOST');
  const proxyText = environment.TRUSTED_PROXY ?? 'false';
  const trustedProxy: false | number = proxyText === 'false' ? false : Number(proxyText);
  if (
    trustedProxy !== false &&
    (!Number.isInteger(trustedProxy) || trustedProxy < 1 || trustedProxy > 10)
  )
    fail('TRUSTED_PROXY');

  const databaseUrl = environment.DATABASE_URL;
  const issuer = environment.OIDC_ISSUER;
  const audience = environment.OIDC_AUDIENCE;
  const algorithms = (environment.OIDC_ALLOWED_ALGORITHMS ?? 'RS256')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (production) {
    if (!databaseUrl || !issuer || !audience || !algorithms.length)
      fail('production configuration');
    if (
      placeholders.test(databaseUrl!) ||
      placeholders.test(issuer!) ||
      placeholders.test(audience!)
    )
      fail('production configuration');
    let database: URL;
    try {
      database = new URL(databaseUrl!);
    } catch {
      return fail('DATABASE_URL');
    }
    if (
      !['postgresql:', 'postgres:'].includes(database.protocol) ||
      database.username !== 'rems_application' ||
      !database.password
    )
      fail('DATABASE_URL application role');
    if (administrativeRoles.has(decodeURIComponent(database.username)))
      fail('DATABASE_URL application role');
    let issuerUrl: URL;
    try {
      issuerUrl = new URL(issuer!);
    } catch {
      return fail('OIDC_ISSUER');
    }
    if (
      issuerUrl.protocol !== 'https:' ||
      issuerUrl.username ||
      issuerUrl.password ||
      issuerUrl.search ||
      issuerUrl.hash
    )
      fail('OIDC_ISSUER');
    if (!/^[A-Za-z0-9._:/-]{1,256}$/.test(audience!)) fail('OIDC_AUDIENCE');
    if (
      algorithms.some(
        (value) =>
          ![
            'RS256',
            'RS384',
            'RS512',
            'ES256',
            'ES384',
            'ES512',
            'PS256',
            'PS384',
            'PS512',
          ].includes(value),
      )
    )
      fail('OIDC_ALLOWED_ALGORITHMS');
  }
  return {
    environment: runtime as RuntimeEnvironment,
    host,
    port,
    trustedProxy,
    logLevel: environment.LOG_LEVEL ?? 'info',
    oidcAlgorithms: algorithms,
    ...(issuer ? { oidcIssuer: issuer } : {}),
    ...(audience ? { oidcAudience: audience } : {}),
    ...(databaseUrl ? { databaseUrl } : {}),
  };
}
