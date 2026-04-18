// apps/worker/src/campaigns/runner.ts
import type { PrismaClient } from '@prisma/client';
import type { PostResult } from '@app/shared';
import { humanDelay } from '../utils/delays.js';
import { applyJitter, calculateNextRun } from './recurrence.js';
import { logger } from '../logger.js';

export interface CampaignContext {
  postToGroup(input: {
    fbUrl: string;
    content: string;
    mediaFiles: string[];
  }): Promise<PostResult>;
  close(): Promise<void>;
}

export interface PlaywrightAdapter {
  verifySession(userId: string): Promise<{ valid: boolean; reason?: string }>;
  openCampaign(userId: string): Promise<CampaignContext>;
}

export interface RunCampaignInput {
  campaignId: string;
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  /** If true, skip inter-group delays (tests). */
  fastMode?: boolean;
}

export async function runCampaign(input: RunCampaignInput): Promise<void> {
  const { campaignId, prisma, adapter, fastMode = false } = input;
  const log = logger.child({ campaignId });

  // 1. Atomic lock
  const locked = await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'scheduled' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (locked.count === 0) {
    log.warn('campaign not in scheduled state, skipping');
    return;
  }

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      groups: { orderBy: { order: 'asc' }, include: { group: true } },
      logs: true,
    },
  });
  const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: campaign.userId } });

  // 2. Verify session
  const sessionCheck = await adapter.verifySession(campaign.userId);
  if (!sessionCheck.valid) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'paused', lastError: `session_invalid: ${sessionCheck.reason}` },
    });
    log.warn({ reason: sessionCheck.reason }, 'session invalid — paused');
    return;
  }

  // 3. Determine which groups still need posting (resume-aware)
  const alreadySucceeded = new Set(
    campaign.logs.filter((l) => l.status === 'success').map((l) => l.groupId),
  );
  const toPost = campaign.groups.filter((cg) => !alreadySucceeded.has(cg.groupId));

  const mediaFiles: string[] = JSON.parse(campaign.mediaFiles);
  let consecutiveFails = 0;
  let pauseTriggered = false;

  // 4. Open one browser context for the whole campaign run
  const campaignCtx = await adapter.openCampaign(campaign.userId);
  try {
    // 5. Loop groups
    for (const cg of toPost) {
      let attempt = 1;

      while (attempt <= setting.maxRetryPerGroup + 1) {
        const logEntry = await prisma.postLog.create({
          data: {
            campaignId: campaign.id,
            groupId: cg.groupId,
            attempt,
            status: 'pending',
            startedAt: new Date(),
          },
        });

        const result = await campaignCtx.postToGroup({
          fbUrl: cg.group.fbUrl,
          content: campaign.content,
          mediaFiles,
        });

        await prisma.postLog.update({
          where: { id: logEntry.id },
          data: {
            status: result.success ? 'success' : 'failed',
            ...(result.note !== undefined ? { note: result.note } : {}),
            ...(result.error !== undefined ? { error: result.error } : {}),
            ...(result.fbPostUrl !== undefined ? { fbPostUrl: result.fbPostUrl } : {}),
            completedAt: new Date(),
          },
        });

        // Critical failures → abort whole campaign
        if (
          !result.success &&
          (result.errorCategory === 'session_invalid' ||
            result.errorCategory === 'account_locked' ||
            result.errorCategory === 'rate_limited')
        ) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: 'paused',
              lastError: `${result.errorCategory}: ${result.error ?? ''}`,
            },
          });
          log.warn({ category: result.errorCategory }, 'critical failure — pausing entire campaign');
          return;
        }

        if (result.success) {
          await prisma.group.update({
            where: { id: cg.groupId },
            data: { lastPosted: new Date() },
          });
          consecutiveFails = 0;
          break;
        }

        // Retry path
        if (attempt <= setting.maxRetryPerGroup) {
          if (!fastMode) {
            await humanDelay(setting.retryDelayMinMs, setting.retryDelayMaxMs);
          }
          attempt++;
        } else {
          // Max retries exhausted — mark as skipped
          await prisma.postLog.updateMany({
            where: { campaignId: campaign.id, groupId: cg.groupId, status: 'failed' },
            data: { status: 'skipped' },
          });
          consecutiveFails++;
          break;
        }
      }

      if (consecutiveFails >= setting.stopAfterConsecutiveFailures) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'paused',
            lastError: `consecutive_failures=${consecutiveFails}`,
          },
        });
        log.warn({ consecutiveFails }, 'consecutive fail threshold reached — paused');
        pauseTriggered = true;
        break;
      }

      // Inter-group delay
      if (!fastMode && toPost.indexOf(cg) < toPost.length - 1) {
        await humanDelay(setting.delayBetweenGroupsMinMs, setting.delayBetweenGroupsMaxMs);
      }
    }
  } finally {
    await campaignCtx.close();
  }

  if (pauseTriggered) return;

  // 5. Finalize
  if (campaign.recurrence) {
    const base = calculateNextRun(new Date(), campaign.recurrence);
    if (base) {
      const next = applyJitter(base, campaign.jitterMinutes);
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'scheduled', scheduledAt: next, completedAt: new Date() },
      });
      log.info({ next: next.toISOString() }, 'recurring — rescheduled');
      return;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed', completedAt: new Date() },
  });
  log.info('campaign completed');
}
