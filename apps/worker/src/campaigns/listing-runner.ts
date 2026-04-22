import type { PrismaClient } from '@prisma/client';
import type { PostResult } from '@app/shared';
import { humanDelay } from '../utils/delays.js';
import { cleanGroupName } from '../groups/groupName.js';
import { logger } from '../logger.js';
import { notifyDesktop } from '../notify.js';

// Extract the list of share-group names Playwright couldn't find from the
// PostResult.note field (format: "partial_share:name1,name2").
function parseMissingShareNames(note: string | undefined): Set<string> {
  if (!note || !note.startsWith('partial_share:')) return new Set();
  return new Set(note.slice('partial_share:'.length).split(',').map((s) => s.trim()).filter(Boolean));
}

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

  // 3. Open browser context and post. Before the actual FB call, materialize
  //    one PostLog row per group in the batch so the Activity / Batch / Dashboard
  //    views have something to show — status will be updated based on result.
  const postLogs = await Promise.all(
    batch.groups.map((bg) =>
      prisma.postLog.create({
        data: {
          campaignId: campaign.id,
          groupId: bg.groupId,
          attempt: batch.attempt + 1,
          status: 'pending',
          startedAt: new Date(),
        },
      }),
    ),
  );
  const postLogByGroupId = new Map(postLogs.map((pl, i) => [batch.groups[i]!.groupId, pl]));

  const ctx = await adapter.openCampaign(campaign.userId);
  let result: PostResult;
  try {
    const primary = batch.groups.find((bg) => bg.isPrimary)!;
    const shares = batch.groups.filter((bg) => !bg.isPrimary);
    const mediaFiles: string[] = JSON.parse(campaign.mediaFiles);

    result = await ctx.postListingBatch({
      primaryGroupFbUrl: primary.group.fbUrl,
      // Strip FB's dynamic activity suffix (e.g. "Last active X ago") from stored
      // names — the checkbox on the share-groups panel uses the bare title.
      shareGroupNames: shares.map((s) => cleanGroupName(s.group.name ?? s.group.fbGroupId) || s.group.fbGroupId),
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

    // Finalize per-group PostLogs: primary + successfully-shared groups → success.
    // Share groups Playwright couldn't find (partial_share note) → skipped.
    const missing = parseMissingShareNames(result.note);
    const now = new Date();
    let successCount = 0;
    let skippedCount = 0;
    for (const bg of batch.groups) {
      const pl = postLogByGroupId.get(bg.groupId)!;
      const groupDisplayName = cleanGroupName(bg.group.name ?? bg.group.fbGroupId) || bg.group.fbGroupId;
      const wasMissing = !bg.isPrimary && missing.has(groupDisplayName);
      if (wasMissing) skippedCount++;
      else successCount++;
      await prisma.postLog.update({
        where: { id: pl.id },
        data: {
          status: wasMissing ? 'skipped' : 'success',
          note: wasMissing ? 'group_not_found_in_share_list' : null,
          fbPostUrl: wasMissing ? null : (result.fbPostUrl ?? null),
          completedAt: now,
        },
      });
    }

    // Update lastPosted for each group in batch
    for (const bg of batch.groups) {
      await prisma.group.update({ where: { id: bg.groupId }, data: { lastPosted: new Date() } });
    }
    await finalizeCampaignIfDone(prisma, campaign.id);

    // Surface native OS notification
    const title = campaign.title || 'Campaign';
    const body =
      skippedCount > 0
        ? `โพสต์สำเร็จ ${successCount} กลุ่ม (ข้าม ${skippedCount} กลุ่มที่หาไม่เจอ)`
        : `โพสต์สำเร็จ ${successCount} กลุ่ม`;
    notifyDesktop(title, body);

    log.info('batch completed');
    return;
  }

  // Critical failure → pause campaign
  if (result.errorCategory && CRITICAL_CATEGORIES.has(result.errorCategory)) {
    const errMsg = `${result.errorCategory}: ${result.error ?? ''}`;
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'failed', lastError: errMsg },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused', lastError: `${result.errorCategory}` },
    });
    await prisma.postLog.updateMany({
      where: { id: { in: postLogs.map((p) => p.id) } },
      data: { status: 'failed', error: errMsg, completedAt: new Date() },
    });
    notifyDesktop(
      campaign.title || 'Campaign',
      `หยุดชั่วคราว — ${result.errorCategory}`,
    );
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
    const errMsg = `${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`;
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: {
        status: 'scheduled',
        attempt: nextAttempt,
        scheduledAt: nextAt,
        lastError: errMsg,
      },
    });
    // Mark this attempt's PostLogs as failed — a fresh set will be created on
    // the retry run. This keeps the Activity view showing the real history.
    await prisma.postLog.updateMany({
      where: { id: { in: postLogs.map((p) => p.id) } },
      data: {
        status: 'failed',
        error: `transient_will_retry: ${errMsg}`,
        completedAt: new Date(),
      },
    });
    log.warn({ attempt: nextAttempt, retryDelayMs: retryDelay }, 'batch retry scheduled');
    if (!fastMode) await humanDelay(100, 200); // yield
    return;
  }

  // Out of retries → skip
  const finalErrMsg = `max_retries_exceeded: ${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`;
  await prisma.listingBatch.update({
    where: { id: batchId },
    data: {
      status: 'skipped',
      lastError: finalErrMsg,
    },
  });
  await prisma.postLog.updateMany({
    where: { id: { in: postLogs.map((p) => p.id) } },
    data: { status: 'skipped', error: finalErrMsg, completedAt: new Date() },
  });
  await finalizeCampaignIfDone(prisma, campaign.id);
  notifyDesktop(
    campaign.title || 'Campaign',
    `ข้ามหลังพยายามครบ — ${result.errorCategory ?? 'transient'}`,
  );
  log.warn('batch skipped after max retries');
}
