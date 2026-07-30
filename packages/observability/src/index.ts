import { trace } from '@opentelemetry/api';
import pino, { type Logger } from 'pino';
export const tracer = trace.getTracer('rems');
export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    base: { service: 'rems' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'authorization',
        'cookie',
        '*.authorization',
        '*.cookie',
        '*.password',
        '*.token',
        '*.secret',
        '*.claims',
        '*.databaseUrl',
        'DATABASE_URL',
      ],
      censor: '[REDACTED]',
    },
  });
}
