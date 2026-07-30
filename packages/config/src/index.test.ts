import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';
const valid = {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  PORT: '3001',
  TRUSTED_PROXY: '1',
  DATABASE_URL: 'postgresql://rems_application:controlled@db.internal:5432/rems',
  OIDC_ISSUER: 'https://identity.internal/tenant',
  OIDC_AUDIENCE: 'rems-api',
  OIDC_ALLOWED_ALGORITHMS: 'RS256,ES256',
};
describe('production runtime configuration', () => {
  it('accepts an explicit safe application configuration', () =>
    expect(loadConfig(valid).environment).toBe('production'));
  it.each(['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'HOST'] as const)(
    'rejects missing %s without disclosing values',
    (key) => {
      const env = { ...valid };
      delete env[key];
      expect(() => loadConfig(env)).toThrow(/Unsafe or invalid/);
    },
  );
  it.each(['rems_migration_owner', 'rems_identity_admin', 'rems_backup', 'rems_emergency_admin'])(
    'rejects administrative role %s without echoing its URL',
    (role) => {
      const secret = `postgresql://${role}:never-print-me@db.internal/rems`;
      try {
        loadConfig({ ...valid, DATABASE_URL: secret });
        throw new Error('accepted');
      } catch (error) {
        expect(String(error)).not.toContain('never-print-me');
        expect(String(error)).not.toContain(secret);
      }
    },
  );
  it('preserves convenient test defaults', () =>
    expect(loadConfig({ NODE_ENV: 'test' }).host).toBe('127.0.0.1'));
});
