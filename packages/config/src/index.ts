export interface RuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  readonly oidcIssuer?: string;
  readonly databaseUrl?: string;
}
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const port = Number(environment.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be a valid TCP port');
  return {
    port,
    logLevel: environment.LOG_LEVEL ?? 'info',
    ...(environment.OIDC_ISSUER ? { oidcIssuer: environment.OIDC_ISSUER } : {}),
    ...(environment.DATABASE_URL ? { databaseUrl: environment.DATABASE_URL } : {}),
  };
}
