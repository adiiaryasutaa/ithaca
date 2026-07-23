import { pino } from 'pino';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  // Pretty output only in local dev; production emits raw JSON, tests stay quiet.
  transport: isDev
    ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } }
    : undefined,
});
