import { pino } from 'pino';
import path from 'node:path';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';
const logFilePath = path.join(process.cwd(), 'logs', 'app.log');

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  // Tests stay quiet; everywhere else logs go to stdout (pretty in dev) AND a file for debugging.
  transport: isTest
    ? undefined
    : {
        targets: [
          isDev
            ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard' }, level: env.LOG_LEVEL }
            : { target: 'pino/file', options: { destination: 1 }, level: env.LOG_LEVEL },
          { target: 'pino/file', options: { destination: logFilePath, mkdir: true }, level: env.LOG_LEVEL },
        ],
      },
});
