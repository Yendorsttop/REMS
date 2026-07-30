import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import pino from 'pino';
describe('structured logging', () => {
  it('redacts prohibited request and credential fields', () => {
    let output = '';
    const sink = new Writable({
      write(chunk, _encoding, done) {
        output += String(chunk);
        done();
      },
    });
    const logger = pino(
      {
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.token',
            '*.databaseUrl',
          ],
          censor: '[REDACTED]',
        },
      },
      sink,
    );
    logger.info({
      req: { headers: { authorization: 'Bearer token-value', cookie: 'session=secret' } },
      account: {
        password: 'password-value',
        token: 'token-value',
        databaseUrl: 'postgresql://admin:secret@db/rems',
      },
    });
    expect(output).not.toContain('token-value');
    expect(output).not.toContain('password-value');
    expect(output).not.toContain('session=secret');
    expect(output).not.toContain('postgresql://');
  });
});
