import 'dotenv/config';
import { prisma } from '@app/db';
import { startScheduler } from './scheduler.js';
import { createRealAdapter } from './playwright/adapter.js';
import { logger } from './logger.js';

async function main() {
  logger.info('worker starting');
  const adapter = createRealAdapter(prisma);
  const stop = startScheduler({ prisma, adapter, intervalMs: 30_000 });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  logger.fatal({ err }, 'worker crashed');
  process.exit(1);
});
