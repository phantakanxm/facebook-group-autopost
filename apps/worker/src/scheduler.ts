import type { PrismaClient } from '@prisma/client';
import { runCampaign, type PlaywrightAdapter } from './campaigns/runner.js';
import { runListingBatch } from './campaigns/listing-runner.js';
import { logger } from './logger.js';
import { handleSessionRequests } from './session/requests.js';

export interface PollOpts {
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  fastMode?: boolean;
}

/**
 * Find the earliest due work (regular post campaign OR listing batch) and run it.
 * Returns a tag string describing what ran ('post:<id>' or 'listing:<batchId>'),
 * or null if nothing was due.
 */
export async function pollAndRunOnce(opts: PollOpts): Promise<string | null> {
  const now = new Date();

  const duePost = await opts.prisma.campaign.findFirst({
    where: { status: 'scheduled', scheduledAt: { lte: now }, type: 'post' },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true },
  });

  const dueBatch = await opts.prisma.listingBatch.findFirst({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      campaign: { type: 'listing', status: { notIn: ['paused', 'completed', 'failed'] } },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true },
  });

  // Pick whichever is earliest; tie-break to post.
  let chosen: { kind: 'post' | 'listing'; id: string } | null = null;
  if (duePost && dueBatch) {
    chosen = duePost.scheduledAt <= dueBatch.scheduledAt
      ? { kind: 'post', id: duePost.id }
      : { kind: 'listing', id: dueBatch.id };
  } else if (duePost) {
    chosen = { kind: 'post', id: duePost.id };
  } else if (dueBatch) {
    chosen = { kind: 'listing', id: dueBatch.id };
  }

  if (!chosen) return null;

  if (chosen.kind === 'post') {
    logger.info({ campaignId: chosen.id }, 'picked up due campaign (post)');
    const runOpts = opts.fastMode !== undefined
      ? { campaignId: chosen.id, prisma: opts.prisma, adapter: opts.adapter, fastMode: opts.fastMode }
      : { campaignId: chosen.id, prisma: opts.prisma, adapter: opts.adapter };
    await runCampaign(runOpts);
    return `post:${chosen.id}`;
  }

  logger.info({ batchId: chosen.id }, 'picked up due listing batch');
  const runOpts = opts.fastMode !== undefined
    ? { batchId: chosen.id, prisma: opts.prisma, adapter: opts.adapter, fastMode: opts.fastMode }
    : { batchId: chosen.id, prisma: opts.prisma, adapter: opts.adapter };
  await runListingBatch(runOpts);
  return `listing:${chosen.id}`;
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
      // Session setup/verify/auto-sync/capability-scan flags — existing behavior
      await handleSessionRequests('default-user');
      await pollAndRunOnce(opts);
    } catch (err) {
      logger.error({ err }, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, interval);
  void tick();

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
