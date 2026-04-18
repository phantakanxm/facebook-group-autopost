import pino from 'pino';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_DIR = resolve(process.cwd(), 'logs');
mkdirSync(LOG_DIR, { recursive: true });

const dateStamp = new Date().toISOString().slice(0, 10);
const logFile = resolve(LOG_DIR, `worker-${dateStamp}.log`);

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.multistream([
    { stream: pino.destination({ dest: logFile, sync: false, mkdir: true }) },
    {
      stream: pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      }),
    },
  ]),
);

export function childLogger(ctx: Record<string, unknown>) {
  return logger.child(ctx);
}
