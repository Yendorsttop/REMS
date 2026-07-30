import 'reflect-metadata';
import crypto from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { loadConfig } from '@rems/config';
import { createLogger } from '@rems/observability';
import { AppModule, RuntimeState, configureOpenApi } from './app.js';
const config = loadConfig();
const logger = createLogger(config.logLevel);
const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
const runtimeState = app.get(RuntimeState);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.prependOnceListener(signal, () => runtimeState.beginShutdown());
app.enableShutdownHooks();
app.getHttpAdapter().getInstance().set('trust proxy', config.trustedProxy);
app.use(
  (
    request: {
      headers: Record<string, string | string[] | undefined>;
      method: string;
      path: string;
    },
    response: {
      setHeader(name: string, value: string): void;
      on(name: string, callback: () => void): void;
      statusCode: number;
    },
    next: () => void,
  ) => {
    const supplied = request.headers['x-correlation-id'];
    const candidate = typeof supplied === 'string' ? supplied : '';
    const correlationId = /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)
      ? candidate
      : crypto.randomUUID();
    response.setHeader('x-correlation-id', correlationId);
    response.on('finish', () =>
      logger.info(
        {
          correlationId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
        },
        'request completed',
      ),
    );
    next();
  },
);
configureOpenApi(app);
await app.listen(config.port, config.host);
logger.info({ port: config.port, host: config.host }, 'REMS API listening');
