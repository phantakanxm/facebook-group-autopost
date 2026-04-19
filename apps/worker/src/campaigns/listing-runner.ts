import type { PrismaClient } from '@prisma/client';
import type { PostResult } from '@app/shared';
import { humanDelay } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface CampaignContext {
  postToGroup(input: unknown): Promise<PostResult>;
  postListingBatch(input: {
    primaryGroupFbUrl: string;
    shareGroupNames: string[];
    listingKind: 'sale' | 'rent';
    propertyType: 'flat' | 'house' | 'townhouse';
    bedrooms: number;
    bathrooms: number;
    priceBaht: number;
    squareMetres?: number | null;
    location: string;
    description: string;
    mediaFiles: string[];
  }): Promise<PostResult>;
  close(): Promise<void>;
}

export interface PlaywrightAdapter {
  verifySession(userId: string): Promise<{ valid: boolean; reason?: string }>;
  openCampaign(userId: string): Promise<CampaignContext>;
}

export interface RunListingBatchInput {
  batchId: string;
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  /** Skip retry-delay sleeps in tests. */
  fastMode?: boolean;
}

const MAX_RETRIES = 2; // 0,1,2 → three attempts before skip
const CRITICAL_CATEGORIES = new Set(['session_invalid', 'account_locked', 'rate_limited']);

async function finalizeCampaignIfDone(prisma: PrismaClient, campaignId: string): Promise<void> {
  const pending = await prisma.listingBatch.count({
    where: { campaignId, status: { in: ['scheduled', 'running'] } },
  });
  if (pending > 0) return;
  // Don't overwrite a campaign the user already finalized (e.g. via cancel).
  const current = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (current && current.status !== 'running') return;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed', completedAt: new Date() },
  });
}

export async function runListingBatch(input: RunListingBatchInput): Promise<void> {
  const { batchId, prisma, adapter, fastMode = false } = input;
  const log = logger.child({ batchId });

  // 1. Atomic lock (if not already claimed)
  const lock = await prisma.listingBatch.updateMany({
    where: { id: batchId, status: 'scheduled' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (lock.count === 0) {
    log.warn('batch not in scheduled state, skipping');
    return;
  }

  const batch = await prisma.listingBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { groups: { orderBy: { order: 'asc' }, include: { group: true } } },
  });
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: batch.campaignId } });
  const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: campaign.userId } });

  // Respect user cancellation — if the campaign was cancelled between scheduling and
  // pickup, unlock this batch and bail out without touching Facebook.
  if (campaign.status === 'completed' || campaign.status === 'failed') {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'skipped', lastError: 'campaign_cancelled_before_batch' },
    });
    log.info({ campaignStatus: campaign.status }, 'campaign already finalized — skipping batch');
    return;
  }

  // Mark campaign running (idempotent)
  if (campaign.status !== 'running') {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'running', startedAt: campaign.startedAt ?? new Date() },
    });
  }

  // 2. Verify session
  const sessionCheck = await adapter.verifySession(campaign.userId);
  if (!sessionCheck.valid) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'failed', lastError: `session_invalid: ${sessionCheck.reason ?? ''}` },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused', lastError: 'session_invalid' },
    });
    log.warn('session invalid — paused');
    return;
  }

  // 3. Open browser context and post
  const ctx = await adapter.openCampaign(campaign.userId);
  let result: PostResult;
  try {
    const primary = batch.groups.find((bg) => bg.isPrimary)!;
    const shares = batch.groups.filter((bg) => !bg.isPrimary);
    const mediaFiles: string[] = JSON.parse(campaign.mediaFiles);

    result = await ctx.postListingBatch({
      primaryGroupFbUrl: primary.group.fbUrl,
      shareGroupNames: shares.map((s) => s.group.name ?? s.group.fbGroupId),
      listingKind: campaign.listingKind as 'sale' | 'rent',
      propertyType: campaign.propertyType as 'flat' | 'house' | 'townhouse',
      bedrooms: campaign.bedrooms!,
      bathrooms: campaign.bathrooms!,
      priceBaht: campaign.priceBaht!,
      squareMetres: campaign.squareMetres,
      location: campaign.location!,
      description: campaign.content,
      mediaFiles,
    });
  } finally {
    await ctx.close();
  }

  // 4. Handle result
  if (result.success) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(result.fbPostUrl !== undefined ? { fbPostUrl: result.fbPostUrl } : {}),
        ...(result.note !== undefined ? { note: result.note } : {}),
      },
    });
    // Update lastPosted for each group in batch
    for (const bg of batch.groups) {
      await prisma.group.update({ where: { id: bg.groupId }, data: { lastPosted: new Date() } });
    }
    await finalizeCampaignIfDone(prisma, campaign.id);
    log.info('batch completed');
    return;
  }

  // Critical failure → pause campaign
  if (result.errorCategory && CRITICAL_CATEGORIES.has(result.errorCategory)) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'failed', lastError: `${result.errorCategory}: ${result.error ?? ''}` },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused', lastError: `${result.errorCategory}` },
    });
    log.warn({ category: result.errorCategory }, 'critical failure — paused');
    return;
  }

  // Transient failure → retry or skip
  const nextAttempt = batch.attempt + 1;
  if (nextAttempt <= MAX_RETRIES) {
    const delayMin = 3 * 60_000;
    const delayMax = 10 * 60_000;
    const retryDelay = delayMin + Math.floor(Math.random() * (delayMax - delayMin));
    const nextAt = fastMode ? new Date() : new Date(Date.now() + retryDelay);
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: {
        status: 'scheduled',
        attempt: nextAttempt,
        scheduledAt: nextAt,
        lastError: `${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`,
      },
    });
    log.warn({ attempt: nextAttempt, retryDelayMs: retryDelay }, 'batch retry scheduled');
    if (!fastMode) await humanDelay(100, 200); // yield
    return;
  }

  // Out of retries → skip
  await prisma.listingBatch.update({
    where: { id: batchId },
    data: {
      status: 'skipped',
      lastError: `max_retries_exceeded: ${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`,
    },
  });
  await finalizeCampaignIfDone(prisma, campaign.id);
  log.warn('batch skipped after max retries');
}
