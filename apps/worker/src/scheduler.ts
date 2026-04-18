// apps/worker/src/scheduler.ts
import type { PrismaClient } from '@prisma/client';
import { runCampaign, type PlaywrightAdapter } from './campaigns/runner.js';
import { logger } from './logger.js';

export interface PollOpts {
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  fastMode?: boolean;
}

/**
 * Find the earliest due campaign and run it. Returns the campaign id that ran,
 * or null if nothing was due.
 */
export async function pollAndRunOnce(opts: PollOpts): Promise<string | null> {
  const now = new Date();
  const due = await opts.prisma.campaign.findFirst({
    where: { status: 'scheduled', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true },
  });
  if (!due) return null;

  logger.info({ campaignId: due.id }, 'picked up due campaign');
  const runInput: Parameters<typeof runCampaign>[0] = {
    campaignId: due.id,
    prisma: opts.prisma,
    adapter: opts.adapter,
  };
  if (opts.fastMode !== undefined) {
    runInput.fastMode = opts.fastMode;
  }
  await runCampaign(runInput);
  return due.id;
}

/**
 * Long-running loop. Polls every `intervalMs` (default 30s).
 * Returns a stop() function.
 */
export function startScheduler(opts: PollOpts & { intervalMs?: number }): () => void {
  const interval = opts.intervalMs ?? 30_000;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await pollAndRunOnce(opts);
    } catch (err) {
      logger.error({ err }, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, interval);
  // Kick off immediately once
  void tick();

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
