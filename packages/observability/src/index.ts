import { trace } from '@opentelemetry/api';
import pino, { type Logger } from 'pino';
export const tracer = trace.getTracer('rems');
export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    base: { service: 'rems' },
    redact: ['req.headers.authorization', '*.password', '*.token'],
  });
}
