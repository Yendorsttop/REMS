import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { ExecutionContext } from '@nestjs/common';
import { OidcAuthenticationGuard, OidcTokenVerifier } from './auth.js';

describe('provider-neutral OIDC verification', () => {
  let server: Server;
  let issuer: string;
  let currentKeys: unknown[];
  let privateKey: CryptoKey;
  let rotatedPrivateKey: CryptoKey;

  beforeAll(async () => {
    const first = await generateKeyPair('RS256');
    const second = await generateKeyPair('RS256');
    privateKey = first.privateKey;
    rotatedPrivateKey = second.privateKey;
    currentKeys = [
      { ...(await exportJWK(first.publicKey)), kid: 'first', alg: 'RS256', use: 'sig' },
      { ...(await exportJWK(second.publicKey)), kid: 'rotated', alg: 'RS256', use: 'sig' },
    ];
    server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: currentKeys }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test issuer failed to listen');
    issuer = `http://127.0.0.1:${address.port}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.OIDC_AUDIENCE = 'rems-api';
    process.env.OIDC_ALLOWED_ALGORITHMS = 'RS256';
  });
  afterAll(
    () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  );

  const token = async (
    overrides: {
      issuer?: string;
      audience?: string;
      kid?: string;
      expires?: number;
      nbf?: number;
      key?: CryptoKey;
    } = {},
  ) =>
    new SignJWT({ groups: ['founder'], roles: ['FOUNDER'] })
      .setProtectedHeader({ alg: 'RS256', kid: overrides.kid ?? 'first' })
      .setIssuer(overrides.issuer ?? issuer)
      .setSubject('external-immutable-subject')
      .setAudience(overrides.audience ?? 'rems-api')
      .setIssuedAt()
      .setExpirationTime(overrides.expires ?? '5m')
      .setNotBefore(overrides.nbf ?? 0)
      .sign(overrides.key ?? privateKey);

  it('accepts a correctly signed token without deriving authority from provider claims', async () => {
    await expect(new OidcTokenVerifier().verify(await token())).resolves.toEqual({
      issuer,
      subject: 'external-immutable-subject',
    });
  });
  it.each([
    ['unknown issuer', { issuer: 'https://unknown.invalid' }],
    ['incorrect audience', { audience: 'other-api' }],
    ['expired token', { expires: 1 }],
    ['future not-before', { nbf: Math.floor(Date.now() / 1000) + 600 }],
    ['invalid signature', { key: undefined, kid: 'rotated' }],
    ['unknown signing key', { kid: 'absent' }],
  ])('rejects %s', async (_name, options) => {
    const effective = _name === 'invalid signature' ? { ...options, key: privateKey } : options;
    await expect(new OidcTokenVerifier().verify(await token(effective))).rejects.toThrow(
      'Bearer token verification failed',
    );
  });
  it('supports a recognized rotated signing key through JWKS', async () => {
    await expect(
      new OidcTokenVerifier().verify(await token({ kid: 'rotated', key: rotatedPrivateKey })),
    ).resolves.toMatchObject({ subject: 'external-immutable-subject' });
  });
  it('rejects unsigned and disallowed-algorithm tokens', async () => {
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"x"}').toString('base64url')}.`;
    await expect(new OidcTokenVerifier().verify(unsigned)).rejects.toThrow();
  });
});

describe('system-security evidence integration', () => {
  const context = (authorization?: string, correlation?: string) => {
    const request = {
      path: '/v1/red-001/identities',
      header: (name: string) =>
        name === 'authorization'
          ? authorization
          : name === 'x-correlation-id'
            ? correlation
            : undefined,
    };
    return {
      request,
      execution: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  it('records one bounded actor-free reason and returns a generic denial', async () => {
    const evidence = { append: vi.fn().mockResolvedValue(undefined) };
    const { execution } = context(undefined, 'safe-correlation-1');
    const guard = new OidcAuthenticationGuard({ verify: vi.fn() } as never, {} as never, evidence);
    await expect(guard.canActivate(execution)).rejects.toMatchObject({ message: 'Unauthorized' });
    expect(evidence.append).toHaveBeenCalledOnce();
    expect(evidence.append).toHaveBeenCalledWith({
      eventType: 'AUTHENTICATION_REJECTED',
      reasonCode: 'MISSING_BEARER_TOKEN',
      correlationId: 'safe-correlation-1',
    });
    expect(JSON.stringify(evidence.append.mock.calls)).not.toContain('actor');
  });

  it('denies safely when evidence persistence fails without logging token material', async () => {
    const evidence = { append: vi.fn().mockRejectedValue(new Error('unavailable')) };
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rawToken = 'sensitive.raw.token';
    const { execution } = context(`Bearer ${rawToken}`, 'safe-correlation-2');
    const verifier = { verify: vi.fn().mockRejectedValue(new Error('bad token')) };
    const guard = new OidcAuthenticationGuard(verifier as never, {} as never, evidence);
    await expect(guard.canActivate(execution)).rejects.toMatchObject({ message: 'Unauthorized' });
    expect(JSON.stringify(log.mock.calls)).not.toContain(rawToken);
    log.mockRestore();
  });

  it('replaces unsafe or overlong requester correlation data', async () => {
    const evidence = { append: vi.fn().mockResolvedValue(undefined) };
    const { execution } = context(undefined, `unsafe header ${'x'.repeat(200)}`);
    const guard = new OidcAuthenticationGuard({ verify: vi.fn() } as never, {} as never, evidence);
    await expect(guard.canActivate(execution)).rejects.toThrow('Unauthorized');
    const recorded = evidence.append.mock.calls[0]?.[0] as { correlationId: string };
    expect(recorded.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
